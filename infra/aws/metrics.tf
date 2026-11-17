data "aws_eks_addon_version" "metrics" {
  addon_name         = "metrics-server"
  kubernetes_version = aws_eks_cluster.demo.version
  most_recent        = true
}

resource "aws_eks_addon" "metrics" {
  cluster_name  = aws_eks_cluster.demo.name
  addon_name    = "metrics-server"
  addon_version = data.aws_eks_addon_version.metrics.version
}
