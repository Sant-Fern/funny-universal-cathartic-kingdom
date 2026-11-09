# Infraestructura de referencia: Google Cloud

[`gcp/`](gcp/) define una VPC, subred, salida NAT, Artifact Registry y un clúster GKE Standard zonal con nodos privados. El pool empieza con un nodo y tiene un máximo configurable de hasta tres. El plano de control limita la administración a la red indicada en `admin_cidr`. No se abre un puerto público para el juego. La configuración sigue el proveedor del plan original; no se ha comprobado una cuenta ni aplicado el plan.

Si el equipo solo consigue Azure, confirmar primero que la rúbrica permita el cambio. Esta carpeta es específica de GCP; para Azure habría que definir AKS, ACR y estado remoto en Azure Storage. Los Dockerfiles, la prueba de integración y el manifiesto privado de Kubernetes son reutilizables.

## Preparación y revisión

Desde la raíz, con Terraform, Google Cloud CLI, `gke-gcloud-auth-plugin`, Docker y `kubectl` instalados. Confirmar proyecto, facturación, cuota en la zona, permisos de creación y presupuesto. Usar un proyecto de demostración y una cuenta autorizada; no copiar credenciales al repositorio. NAT, nodos, discos y registro pueden tener costo aun sin jugadores. El máximo de nodos no limita el costo total.

```powershell
terraform -chdir=infra/gcp fmt -check -recursive
terraform -chdir=infra/gcp init -backend=false -input=false -lockfile=readonly
terraform -chdir=infra/gcp validate
```

Estos tres pasos no requieren cuenta ni crean recursos. `init` sí requiere descargar el proveedor la primera vez. La configuración fija la versión de proveedor en `.terraform.lock.hcl`.

### Arranque del estado remoto (una sola vez)

El operador autorizado puede usar un bucket privado existente bajo control del equipo o crear uno exclusivo con este bloque. Sustituir los tres marcadores primero. El bucket tiene vida separada del clúster. Versionar el contenido, restringir IAM y conservar una copia del estado antes de eliminar el bucket. [Backend GCS de Terraform](https://developer.hashicorp.com/terraform/language/backend/gcs).

```powershell
$pogoProject = 'ID_REAL_DEL_PROYECTO'
$pogoRegion = 'REGION_REAL'
$pogoStateBucket = 'NOMBRE_GLOBALMENTE_UNICO'
gcloud auth login
gcloud auth application-default login
gcloud services enable serviceusage.googleapis.com storage.googleapis.com --project $pogoProject
gcloud storage buckets create "gs://$pogoStateBucket" --project $pogoProject --location $pogoRegion --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update "gs://$pogoStateBucket" --versioning
```

Copiar `gcp/demo.auto.tfvars.example` a `gcp/demo.auto.tfvars` y `gcp/backend.hcl.example` a `gcp/backend.hcl`. Editar el proyecto, la región y zona, el CIDR de administración (preferiblemente una IP pública `/32`) y el nombre del bucket. Ambos archivos locales están excluidos del repositorio. No incluir claves. Si ya existe un estado local con recursos, acordar cómo migrarlo antes de reinicializar; las siguientes órdenes son para el primer despliegue del equipo.

```powershell
terraform -chdir=infra/gcp init -reconfigure -backend-config=backend.hcl -lockfile=readonly
terraform -chdir=infra/gcp plan -out=demo.tfplan
terraform -chdir=infra/gcp show demo.tfplan
# Solo tras revisar costos, cuota y el plan:
terraform -chdir=infra/gcp apply demo.tfplan
```

Guardar una salida revisada y sin datos sensibles como evidencia, no el estado ni el archivo binario del plan. Las APIs habilitadas se dejan activas al destruir el entorno para no cortar servicios del proyecto por accidente. Referencias: [GKE con Terraform](https://registry.terraform.io/providers/hashicorp/google/7.16.0/docs/resources/container_cluster), [permisos de los nodos](https://docs.cloud.google.com/kubernetes-engine/security/configure-node-service-accounts).

## Desde el clúster hasta la demo

1. Probar el contenedor actual como una sola instancia privada siguiendo [`k8s/README.md`](../k8s/README.md). Sirve para verificar imágenes, DNS, HTTP y WebSocket. Esta configuración no instala Agones ni demuestra asignación o escalado.
2. Elegir una versión de Agones compatible con la versión de Kubernetes obtenida. Instalarla por separado y verificarla primero con sus pruebas. Confirmar acceso del plano de control al webhook (puerto TCP 8081 por defecto) y la ruta interna hacia los GameServers; evitar abrir rangos a todo internet si el gateway interno es quien los contacta. [Instalación con Helm](https://agones.dev/site/docs/installation/install-agones/helm/).
3. Completar el ciclo de partida, el gateway y HTTPS/WSS según el [traspaso](../docs/TRASPASO.md) antes de publicar. El proceso local guarda las reservas en memoria; varias réplicas detrás del mismo Service enviarían algunas reservas al pod incorrecto.

## Retiro

Conservar primero las mediciones y el inventario. Quitar los workloads, Agones y cualquier balanceador o disco asociado creado fuera de este Terraform. Para desactivar la protección de GKE, poner `protect_cluster = false` en las variables locales, revisar el plan resultante y aplicar solo ese cambio. Después:

```powershell
terraform -chdir=infra/gcp plan -destroy -out=destroy.tfplan
terraform -chdir=infra/gcp show destroy.tfplan
# Solo después de revisar qué se eliminará:
terraform -chdir=infra/gcp apply destroy.tfplan
terraform -chdir=infra/gcp state list
```

Verificar en el proveedor que no queden clúster, nodos, NAT, IP reservada, balanceador, discos ni imágenes cobrables del entorno. El bucket de estado está fuera del plan de destrucción; manejar sus versiones y su eventual eliminación por separado, cuando el equipo ya no necesite recuperar el estado. Guardar evidencia de la revisión y del costo observado.
