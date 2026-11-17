terraform {
  required_version = ">= 1.13, < 2.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }
  backend "s3" {
    key          = "pogo/demo.tfstate"
    use_lockfile = true
    encrypt      = true
  }
}

variable "profile" { type = string }
variable "admin_cidr" { type = string }
variable "operator_arn" { type = string }
variable "python_executable" { type = string }
variable "resource_prefix" {
  type    = string
  default = "pogo"
}
variable "region" {
  type    = string
  default = "us-east-2"
}
variable "max_nodes" {
  type    = number
  default = 8
  validation {
    condition     = var.max_nodes >= 2 && var.max_nodes <= 8
    error_message = "La demostración permite entre dos y ocho nodos."
  }
}
variable "min_nodes" {
  type    = number
  default = 2
  validation {
    condition     = var.min_nodes >= 1 && var.min_nodes <= 2
    error_message = "Usar uno o dos nodos mínimos para esta demostración."
  }
}

provider "aws" {
  profile = var.profile
  region  = var.region
  default_tags {
    tags = { Project = "pogo-arena", ManagedBy = "Terraform" }
  }
}

data "external" "cost_guard" {
  program = [var.python_executable, "${path.module}/cost_guard.py", var.profile]
}

resource "terraform_data" "free_plan_required" {
  input = data.external.cost_guard.result
  lifecycle {
    precondition {
      condition     = data.external.cost_guard.result.allowed == "true"
      error_message = "El despliegue exige plan Free activo y al menos USD 40 de crédito. Revisar el plan antes de continuar."
    }
  }
}

data "aws_availability_zones" "available" { state = "available" }

resource "aws_vpc" "demo" {
  cidr_block           = "10.176.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  depends_on           = [terraform_data.free_plan_required]
}

resource "aws_internet_gateway" "demo" { vpc_id = aws_vpc.demo.id }

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.demo.id
  cidr_block              = cidrsubnet(aws_vpc.demo.cidr_block, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { "kubernetes.io/role/elb" = "1" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.demo.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.demo.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_iam_role" "cluster" {
  name = "${var.resource_prefix}-eks-control-plane"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "eks.amazonaws.com" } }]
  })
  depends_on = [terraform_data.free_plan_required]
}

resource "aws_iam_role_policy_attachment" "cluster" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role" "nodes" {
  name = "${var.resource_prefix}-eks-nodes"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "ec2.amazonaws.com" } }]
  })
  depends_on = [terraform_data.free_plan_required]
}

resource "aws_iam_role_policy_attachment" "nodes" {
  for_each   = toset(["AmazonEKSWorkerNodePolicy", "AmazonEKS_CNI_Policy", "AmazonEC2ContainerRegistryReadOnly"])
  role       = aws_iam_role.nodes.name
  policy_arn = "arn:aws:iam::aws:policy/${each.key}"
}

resource "aws_eks_cluster" "demo" {
  name     = "${var.resource_prefix}-demo"
  version  = "1.35"
  role_arn = aws_iam_role.cluster.arn
  access_config {
    authentication_mode                         = "API_AND_CONFIG_MAP"
    bootstrap_cluster_creator_admin_permissions = false
  }
  vpc_config {
    subnet_ids              = aws_subnet.public[*].id
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = [var.admin_cidr]
  }
  upgrade_policy { support_type = "STANDARD" }
  depends_on = [aws_iam_role_policy_attachment.cluster]
}

resource "aws_eks_access_entry" "operator" {
  cluster_name  = aws_eks_cluster.demo.name
  principal_arn = var.operator_arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "operator" {
  cluster_name  = aws_eks_cluster.demo.name
  principal_arn = aws_eks_access_entry.operator.principal_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
  access_scope { type = "cluster" }
}

resource "aws_eks_node_group" "game" {
  cluster_name    = aws_eks_cluster.demo.name
  node_group_name = "${var.resource_prefix}-games"
  node_role_arn   = aws_iam_role.nodes.arn
  subnet_ids      = aws_subnet.public[*].id
  instance_types  = ["m7i-flex.large"]
  capacity_type   = "ON_DEMAND"
  disk_size       = 20
  scaling_config {
    desired_size = var.min_nodes
    min_size     = var.min_nodes
    max_size     = var.max_nodes
  }
  update_config { max_unavailable = 1 }
  lifecycle { ignore_changes = [scaling_config[0].desired_size] }
  depends_on = [aws_iam_role_policy_attachment.nodes, aws_route_table_association.public]
}

resource "aws_ecr_repository" "image" {
  for_each             = toset(["server", "client", "gateway", "loadtest"])
  name                 = "${var.resource_prefix}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true
  image_scanning_configuration { scan_on_push = false }
  depends_on = [terraform_data.free_plan_required]
}

output "cluster" { value = aws_eks_cluster.demo.name }
output "repositories" { value = { for key, repo in aws_ecr_repository.image : key => repo.repository_url } }
output "node_security_group" { value = aws_eks_cluster.demo.vpc_config[0].cluster_security_group_id }
