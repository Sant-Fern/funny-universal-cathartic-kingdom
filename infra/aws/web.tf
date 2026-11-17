variable "origin_dns" {
  type    = string
  default = ""
}

data "aws_cloudfront_cache_policy" "disabled" {
  count = var.origin_dns == "" ? 0 : 1
  name  = "Managed-CachingDisabled"
}
data "aws_cloudfront_cache_policy" "media" {
  count = var.origin_dns == "" ? 0 : 1
  name  = "Managed-CachingOptimized"
}

resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${var.resource_prefix}-hls"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_cloudfront_origin_request_policy" "viewer" {
  count = var.origin_dns == "" ? 0 : 1
  name  = "Managed-AllViewer"
}

data "aws_cloudfront_response_headers_policy" "security" {
  count = var.origin_dns == "" ? 0 : 1
  name  = "Managed-SecurityHeadersPolicy"
}

resource "aws_cloudfront_distribution" "game" {
  count           = var.origin_dns == "" ? 0 : 1
  enabled         = true
  is_ipv6_enabled = true
  comment         = "Pogo Arena demo - HTTPS and WebSockets"
  price_class     = "PriceClass_100"
  origin {
    domain_name              = aws_s3_bucket.artifacts.bucket_regional_domain_name
    origin_id                = "pogo-hls"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }
  origin {
    domain_name = var.origin_dns
    origin_id   = "pogo-alb"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
    }
  }
  default_cache_behavior {
    target_origin_id           = "pogo-alb"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled[0].id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.viewer[0].id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security[0].id
  }
  ordered_cache_behavior {
    path_pattern               = "/hls/*"
    target_origin_id           = "pogo-hls"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = data.aws_cloudfront_cache_policy.media[0].id
    compress                   = false
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security[0].id
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate { cloudfront_default_certificate = true }
  depends_on = [terraform_data.free_plan_required]
}

resource "aws_s3_bucket_policy" "media" {
  count  = var.origin_dns == "" ? 0 : 1
  bucket = aws_s3_bucket.artifacts.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Sid    = "CloudFrontReadOnlyHLS", Effect = "Allow", Principal = { Service = "cloudfront.amazonaws.com" },
    Action = "s3:GetObject", Resource = "${aws_s3_bucket.artifacts.arn}/hls/*",
    Condition = { StringEquals = {
      "AWS:SourceArn"     = aws_cloudfront_distribution.game[0].arn,
      "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
    } }
  }] })
}

output "game_url" {
  value = var.origin_dns == "" ? null : "https://${aws_cloudfront_distribution.game[0].domain_name}"
}
