# LBC policy is the upstream v3.6.3 policy, downloaded without modification.
data "aws_caller_identity" "current" {}

locals {
  controller_accounts = {
    load_balancer = "aws-load-balancer-controller"
    autoscaler    = "cluster-autoscaler"
  }
}

resource "aws_iam_role" "controller" {
  for_each = local.controller_accounts
  name     = "${var.resource_prefix}-${each.key}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow", Action = ["sts:AssumeRole", "sts:TagSession"]
      Principal = { Service = "pods.eks.amazonaws.com" }
      Condition = { StringEquals = {
        "aws:RequestTag/kubernetes-namespace"       = "kube-system"
        "aws:RequestTag/kubernetes-service-account" = each.value
        "aws:RequestTag/eks-cluster-name"           = aws_eks_cluster.demo.name
      } }
    }]
  })
}

data "aws_eks_addon_version" "pod_identity" {
  addon_name         = "eks-pod-identity-agent"
  kubernetes_version = aws_eks_cluster.demo.version
  most_recent        = true
}

resource "aws_eks_addon" "pod_identity" {
  cluster_name  = aws_eks_cluster.demo.name
  addon_name    = "eks-pod-identity-agent"
  addon_version = data.aws_eks_addon_version.pod_identity.version
}

resource "aws_eks_pod_identity_association" "controller" {
  for_each        = local.controller_accounts
  cluster_name    = aws_eks_cluster.demo.name
  namespace       = "kube-system"
  service_account = each.value
  role_arn        = aws_iam_role.controller[each.key].arn
  depends_on      = [aws_eks_addon.pod_identity]
}

resource "aws_iam_role_policy" "load_balancer" {
  role   = aws_iam_role.controller["load_balancer"].id
  policy = file("${path.module}/load-balancer-policy.json")
}

# AWS EKS Cluster Autoscaler best-practices policy, with writes scoped to our ASG.
resource "aws_iam_role_policy" "autoscaler" {
  role = aws_iam_role.controller["autoscaler"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["autoscaling:SetDesiredCapacity", "autoscaling:TerminateInstanceInAutoScalingGroup"]
        Resource = "arn:aws:autoscaling:${var.region}:${data.aws_caller_identity.current.account_id}:autoScalingGroup:*:autoScalingGroupName/${aws_eks_node_group.game.resources[0].autoscaling_groups[0].name}"
      },
      {
        Effect = "Allow"
        Action = ["autoscaling:DescribeAutoScalingGroups", "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations", "autoscaling:DescribeScalingActivities", "autoscaling:DescribeTags",
          "ec2:DescribeImages", "ec2:DescribeInstanceTypes", "ec2:DescribeLaunchTemplateVersions",
        "ec2:GetInstanceTypesFromInstanceRequirements", "eks:DescribeNodegroup"]
        Resource = "*"
      }
    ]
  })
}

output "controller_roles" { value = { for key, role in aws_iam_role.controller : key => role.arn } }
output "vpc_id" { value = aws_vpc.demo.id }
