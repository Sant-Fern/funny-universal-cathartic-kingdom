resource "aws_dynamodb_table" "results" {
  name         = "${var.resource_prefix}-results"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
  on_demand_throughput {
    max_read_request_units  = 1000
    max_write_request_units = 1000
  }
  depends_on = [terraform_data.free_plan_required]
}

resource "aws_iam_role" "leaderboard" {
  name = "${var.resource_prefix}-leaderboard"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "lambda.amazonaws.com" }
  }] })
}

resource "aws_iam_role_policy_attachment" "leaderboard_logs" {
  role       = aws_iam_role.leaderboard.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Generated from the SDK source by IAM Policy Autopilot. Only resource ARNs
# are substituted for the isolated validation copy / another account.
resource "aws_iam_role_policy" "leaderboard" {
  role   = aws_iam_role.leaderboard.id
  policy = replace(replace(replace(file("${path.module}/results-policy.json"), "933605931561", data.aws_caller_identity.current.account_id), "us-east-2", var.region), "pogo-results", aws_dynamodb_table.results.name)
}

data "archive_file" "leaderboard" {
  type        = "zip"
  source_file = "${path.module}/../../serverless/handler.py"
  output_path = "${path.module}/.terraform/leaderboard.zip"
}

resource "aws_cloudwatch_log_group" "leaderboard" {
  name              = "/aws/lambda/${var.resource_prefix}-leaderboard"
  retention_in_days = 7
}

resource "aws_lambda_function" "leaderboard" {
  function_name    = "${var.resource_prefix}-leaderboard"
  role             = aws_iam_role.leaderboard.arn
  runtime          = "python3.14"
  handler          = "handler.handler"
  architectures    = ["arm64"]
  memory_size      = 256
  timeout          = 10
  filename         = data.archive_file.leaderboard.output_path
  source_code_hash = data.archive_file.leaderboard.output_base64sha256
  environment { variables = { RESULTS_TABLE = aws_dynamodb_table.results.name } }
  depends_on = [aws_iam_role_policy.leaderboard, aws_iam_role_policy_attachment.leaderboard_logs, aws_cloudwatch_log_group.leaderboard]
}

resource "aws_iam_role" "results_writer" {
  name = "${var.resource_prefix}-result-writer"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Action = ["sts:AssumeRole", "sts:TagSession"], Principal = { Service = "pods.eks.amazonaws.com" },
    Condition = { StringEquals = {
      "aws:RequestTag/kubernetes-namespace"       = "pogo",
      "aws:RequestTag/kubernetes-service-account" = "agones-sdk",
      "aws:RequestTag/eks-cluster-name"           = aws_eks_cluster.demo.name
    } }
  }] })
}

resource "aws_iam_role_policy" "results_writer" {
  role   = aws_iam_role.results_writer.id
  policy = replace(replace(replace(file("${path.module}/results-writer-policy.json"), "933605931561", data.aws_caller_identity.current.account_id), "us-east-2", var.region), "pogo-leaderboard", aws_lambda_function.leaderboard.function_name)
}

resource "aws_eks_pod_identity_association" "results" {
  cluster_name    = aws_eks_cluster.demo.name
  namespace       = "pogo"
  service_account = "agones-sdk"
  role_arn        = aws_iam_role.results_writer.arn
  depends_on      = [aws_eks_addon.pod_identity]
}

resource "aws_apigatewayv2_api" "leaderboard" {
  name          = "${var.resource_prefix}-leaderboard"
  protocol_type = "HTTP"
}
resource "aws_apigatewayv2_integration" "leaderboard" {
  api_id                 = aws_apigatewayv2_api.leaderboard.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.leaderboard.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "leaderboard" {
  api_id    = aws_apigatewayv2_api.leaderboard.id
  route_key = "GET /leaderboard"
  target    = "integrations/${aws_apigatewayv2_integration.leaderboard.id}"
}
resource "aws_apigatewayv2_stage" "leaderboard" {
  api_id      = aws_apigatewayv2_api.leaderboard.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 500
    throttling_rate_limit  = 300
  }
}
resource "aws_lambda_permission" "leaderboard_api" {
  statement_id   = "PublicLeaderboardReadOnly"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.leaderboard.function_name
  principal      = "apigateway.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
  source_arn     = "${aws_apigatewayv2_api.leaderboard.execution_arn}/*/GET/leaderboard"
}

output "results_function" { value = aws_lambda_function.leaderboard.function_name }
output "leaderboard_url" { value = "${aws_apigatewayv2_api.leaderboard.api_endpoint}/leaderboard" }
