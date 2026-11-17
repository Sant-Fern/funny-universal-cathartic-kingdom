variable "loadgen_count" {
  type    = number
  default = 0
  validation {
    condition     = var.loadgen_count >= 0 && var.loadgen_count <= 2
    error_message = "La carga usa como máximo dos generadores dedicados."
  }
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.resource_prefix}-artifacts-${data.aws_caller_identity.current.account_id}-${var.region}"
}
resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_iam_role" "loadgen" {
  name = "${var.resource_prefix}-loadgen"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "ec2.amazonaws.com" }
  }] })
}
resource "aws_iam_role_policy_attachment" "loadgen" {
  for_each   = toset(["AmazonSSMManagedInstanceCore", "AmazonEC2ContainerRegistryReadOnly"])
  role       = aws_iam_role.loadgen.name
  policy_arn = "arn:aws:iam::aws:policy/${each.key}"
}
resource "aws_iam_role_policy" "loadgen_upload" {
  role   = aws_iam_role.loadgen.id
  policy = replace(replace(replace(file("${path.module}/loadgen-policy.json"), "933605931561", data.aws_caller_identity.current.account_id), "us-east-2", var.region), "pogo-artifacts-", "${var.resource_prefix}-artifacts-")
}
resource "aws_iam_role_policy" "loadgen_results" {
  role   = aws_iam_role.loadgen.id
  policy = replace(replace(replace(file("${path.module}/results-writer-policy.json"), "933605931561", data.aws_caller_identity.current.account_id), "us-east-2", var.region), "pogo-leaderboard", aws_lambda_function.leaderboard.function_name)
}
resource "aws_iam_instance_profile" "loadgen" {
  name = "${var.resource_prefix}-loadgen"
  role = aws_iam_role.loadgen.name
}
resource "aws_security_group" "loadgen" {
  name   = "${var.resource_prefix}-loadgen"
  vpc_id = aws_vpc.demo.id
  ingress {
    from_port = 5557
    to_port   = 5557
    protocol  = "tcp"
    self      = true
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
data "aws_ssm_parameter" "loadgen_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}
resource "aws_instance" "loadgen" {
  count                       = var.loadgen_count
  ami                         = data.aws_ssm_parameter.loadgen_ami.value
  instance_type               = "c7i-flex.large"
  subnet_id                   = aws_subnet.public[count.index].id
  vpc_security_group_ids      = [aws_security_group.loadgen.id]
  iam_instance_profile        = aws_iam_instance_profile.loadgen.name
  associate_public_ip_address = true
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 16
    encrypted             = true
    delete_on_termination = true
  }
  user_data  = <<-EOT
    #!/bin/bash
    set -euo pipefail
    dnf install -y docker
    systemctl enable --now docker
    mkdir -p /var/lib/pogo-results
  EOT
  tags       = { Name = "${var.resource_prefix}-loadgen-${count.index}" }
  depends_on = [aws_route_table_association.public, terraform_data.free_plan_required]
}
output "load_generators" { value = [for vm in aws_instance.loadgen : { id = vm.id, private_ip = vm.private_ip }] }
output "artifacts_bucket" { value = aws_s3_bucket.artifacts.id }
