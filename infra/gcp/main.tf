resource "google_project_service" "api" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

resource "google_compute_network" "demo" {
  name                    = "pogo-demo"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.api]
}

resource "google_compute_subnetwork" "demo" {
  name                     = "pogo-demo"
  network                  = google_compute_network.demo.id
  region                   = var.region
  ip_cidr_range            = "10.80.0.0/24"
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.84.0.0/20"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.88.0.0/24"
  }
}

resource "google_compute_router" "egress" {
  name    = "pogo-demo-egress"
  region  = var.region
  network = google_compute_network.demo.id
}

resource "google_compute_router_nat" "egress" {
  name                               = "pogo-demo-egress"
  router                             = google_compute_router.egress.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.demo.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }
}

resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = "pogo-demo"
  format        = "DOCKER"
  depends_on    = [google_project_service.api]
}

resource "google_service_account" "nodes" {
  account_id   = "pogo-demo-nodes"
  display_name = "Pogo demo GKE nodes"
  depends_on   = [google_project_service.api]
}

resource "google_project_iam_member" "node_role" {
  project = var.project_id
  role    = "roles/container.defaultNodeServiceAccount"
  member  = "serviceAccount:${google_service_account.nodes.email}"
}

resource "google_artifact_registry_repository_iam_member" "node_pull" {
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.nodes.email}"
}

resource "google_container_cluster" "demo" {
  name                     = "pogo-demo"
  location                 = var.zone
  network                  = google_compute_network.demo.id
  subnetwork               = google_compute_subnetwork.demo.id
  remove_default_node_pool = true
  initial_node_count       = 1
  deletion_protection      = var.protect_cluster

  node_config {
    machine_type    = var.machine_type
    disk_type       = "pd-standard"
    disk_size_gb    = 30
    service_account = google_service_account.nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  release_channel {
    channel = "REGULAR"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.20.0/28"
  }

  master_authorized_networks_config {
    gcp_public_cidrs_access_enabled = false

    cidr_blocks {
      cidr_block   = var.admin_cidr
      display_name = "admin"
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  depends_on = [google_compute_router_nat.egress, google_project_iam_member.node_role]
}

resource "google_container_node_pool" "demo" {
  name               = "pogo-demo"
  location           = var.zone
  cluster            = google_container_cluster.demo.name
  initial_node_count = 1

  autoscaling {
    min_node_count = 1
    max_node_count = var.max_nodes
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type    = var.machine_type
    disk_type       = "pd-standard"
    disk_size_gb    = 30
    service_account = google_service_account.nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  depends_on = [google_artifact_registry_repository_iam_member.node_pull]
}
