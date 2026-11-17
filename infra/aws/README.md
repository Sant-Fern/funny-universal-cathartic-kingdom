# AWS: entorno temporal del integrador

El estado y el despliegue reales están documentados en [DESPLIEGUE_AWS.md](../../docs/DESPLIEGUE_AWS.md).

## Componentes

- `bootstrap/`: bucket privado, cifrado y versionado para el estado remoto.
- `main.tf`: red sin NAT Gateway, EKS, dos nodos iniciales y ECR privado.
- `controllers.tf`: Pod Identity y permisos de Load Balancer Controller y Cluster Autoscaler. Las escrituras del escalador se limitan al grupo de nodos de este proyecto.
- `load-balancer-policy.json`: política oficial de AWS Load Balancer Controller **v3.6.3**, descargada de su repositorio oficial.
- `metrics.tf`: complemento metrics-server.
- `web.tf`: dirección HTTPS de CloudFront hacia el ALB del Ingress.
- `cost_guard.py`: consulta el plan y el crédito antes de planificar. Exige Free activo y un saldo de al menos USD 40 para crear o actualizar. No es un apagado automático ni un presupuesto rígido del saldo compartido.

La cuenta utilizada rechazó la creación de un proveedor OIDC mediante una política de servicio. El despliegue utiliza **EKS Pod Identity**, el mecanismo nativo alternativo de AWS. Esa restricción no se modificó.

## Reproducción en Windows

1. Instalar AWS CLI, Terraform 1.13.5, Helm 3.19 y kubectl compatible con Kubernetes 1.35. En este equipo Terraform y Helm están bajo `.tools/`; esa carpeta no se publica.
2. Iniciar sesión en el perfil autorizado. Comprobar `aws freetier get-account-plan-state` y la identidad con `aws sts get-caller-identity`. Usar `aws iam get-role` para obtener el ARN completo del rol; el ARN de STS no conserva su ruta IAM.
3. Crear el bucket con Terraform en `bootstrap/`. El nombre incluye cuenta y región. Revisar el plan antes de aplicarlo.
4. Copiar `terraform.tfvars.example` a `local.auto.tfvars`, con valores reales. Si se prefiere `local.auto.tfvars.json`, convertir el contenido a JSON válido. No versionar esos archivos.
5. Crear `backend.hcl` con `bucket` y `region` del estado remoto. No incluir contraseñas ni claves.
6. Inicializar y planificar con la sesión temporal del perfil:

```powershell
& ./scripts/aws-terraform.ps1 -Directory infra/aws -Profile TU_PERFIL -TerraformArguments @('init','-input=false','-backend-config=backend.hcl')
& ./scripts/aws-terraform.ps1 -Directory infra/aws -Profile TU_PERFIL -TerraformArguments @('plan','-input=false','-out=demo.tfplan')
# Después de revisar ese plan:
& ./scripts/aws-terraform.ps1 -Directory infra/aws -Profile TU_PERFIL -TerraformArguments @('apply','-input=false','demo.tfplan')
```

El wrapper crea un perfil temporal de configuración con `credential_process` del AWS CLI y lo elimina al terminar. Así el backend S3 puede renovar la credencial durante operaciones largas de EKS, sin escribir claves en archivos. El proveedor conserva el perfil de navegador autorizado.

7. Conectar kubectl usando un archivo propio: `aws eks update-kubeconfig --profile TU_PERFIL --region us-east-2 --name pogo-demo --kubeconfig .tools/pogo.kubeconfig`. Para cada sesión, asignar `$env:KUBECONFIG` a la ruta absoluta de ese archivo.
8. Instalar las versiones fijadas en `k8s/aws/README.md`. Renderizar el manifiesto con `scripts/aws-manifests.py` e imágenes de ECR.
9. Cuando el Ingress tenga DNS, guardar ese valor en `origin_dns`, revisar y aplicar un nuevo plan para crear CloudFront.

## Retiro del entorno

El juego queda disponible al terminar el despliegue. **Todavía no se ejecutó el `destroy` final.** Para retirarlo, primero conservar los JSON y métricas de evidencia; luego eliminar el Ingress y esperar a que su controlador elimine el ALB y sus recursos. Después desinstalar los componentes Kubernetes y revisar/aplicar un plan `terraform plan -destroy` de `infra/aws`. No retirar antes el controlador del balanceador: debe poder completar esa limpieza.

El bucket del estado se administra por separado en `bootstrap/` y conserva versiones. Antes de eliminarlo, respaldar el estado y revisar todas las versiones. No borrar recursos de otros proyectos de la cuenta. Verificar al final ALB, grupos de destino, nodos, volúmenes, IP, clúster, ECR y CloudFront para este proyecto.
