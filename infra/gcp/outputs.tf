output "cluster_name" {
  value = google_container_cluster.demo.name
}

output "cluster_zone" {
  value = google_container_cluster.demo.location
}

output "image_repository" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}
