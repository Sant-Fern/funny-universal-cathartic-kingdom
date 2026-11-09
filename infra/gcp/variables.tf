variable "project_id" {
  description = "ID de un proyecto de demostración con facturación activa."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Indica un ID válido de proyecto de Google Cloud."
  }
}

variable "region" {
  description = "Región del registro, la subred y el NAT."
  type        = string
}

variable "zone" {
  description = "Zona del clúster de demostración."
  type        = string

  validation {
    condition     = startswith(var.zone, "${var.region}-")
    error_message = "La zona debe pertenecer a la región."
  }
}

variable "admin_cidr" {
  description = "IPv4 pública del operador o de su VPN para administrar el API de Kubernetes, en formato CIDR."
  type        = string

  validation {
    condition = (
      can(cidrnetmask(var.admin_cidr)) &&
      try(tonumber(split("/", var.admin_cidr)[1]) >= 24, false)
    )
    error_message = "Indica una red IPv4 acotada entre /24 y /32; usa /32 para una IP."
  }
}

variable "machine_type" {
  description = "Tamaño inicial de los nodos. Confirmar disponibilidad, cuota y costo."
  type        = string
  default     = "e2-standard-2"
}

variable "max_nodes" {
  description = "Máximo de nodos del pool zonal de demostración. Un nodo permanece activo."
  type        = number
  default     = 2

  validation {
    condition     = var.max_nodes >= 1 && var.max_nodes <= 3 && floor(var.max_nodes) == var.max_nodes
    error_message = "Para esta plantilla de demostración, el máximo es de 1 a 3 nodos."
  }
}

variable "protect_cluster" {
  description = "Cambiar a false y aplicar ese cambio antes de destruir el entorno."
  type        = bool
  default     = true
}
