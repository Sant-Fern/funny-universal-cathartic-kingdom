# Kubernetes del despliegue AWS

Versiones probadas: EKS/Kubernetes 1.35, Agones 1.62.0, AWS Load Balancer Controller/chart 3.6.3, kube-prometheus-stack 93.3.1 y Cluster Autoscaler 1.35.3 (chart 9.60.0).

Configurar siempre `KUBECONFIG` con el archivo específico de `pogo-demo`. No usar por accidente el contexto de Docker Desktop u otro proyecto.

```powershell
.tools/helm/windows-amd64/helm.exe repo add agones https://agones.dev/chart/stable
.tools/helm/windows-amd64/helm.exe repo add eks https://aws.github.io/eks-charts
.tools/helm/windows-amd64/helm.exe repo add prometheus-community https://prometheus-community.github.io/helm-charts
.tools/helm/windows-amd64/helm.exe repo add autoscaler https://kubernetes.github.io/autoscaler
kubectl create namespace pogo
.tools/helm/windows-amd64/helm.exe upgrade --install agones agones/agones --version 1.62.0 -n agones-system --create-namespace -f k8s/aws/agones-values.yaml --wait
.tools/helm/windows-amd64/helm.exe upgrade --install monitoring prometheus-community/kube-prometheus-stack --version 93.3.1 -n monitoring --create-namespace -f k8s/aws/monitoring-values.yaml --wait
# Sustituir VPC_ID por la salida vpc_id de Terraform.
.tools/helm/windows-amd64/helm.exe upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller --version 3.6.3 -n kube-system --set clusterName=pogo-demo --set region=us-east-2 --set vpcId=VPC_ID --set serviceAccount.name=aws-load-balancer-controller --set replicaCount=1 --wait
.tools/helm/windows-amd64/helm.exe upgrade --install cluster-autoscaler autoscaler/cluster-autoscaler --version 9.60.0 -n kube-system -f k8s/aws/autoscaler-values.yaml --wait
```

La identidad de los dos controladores se establece con Terraform mediante Pod Identity, sin anotaciones IRSA en sus cuentas de servicio.

## Publicación de imágenes y partidas

Construir las imágenes locales `pogo-server:aws`, `pogo-client:aws` y `pogo-gateway:aws` con sus respectivos Dockerfiles. `scripts/aws-push.ps1 -Tag ETIQUETA` publica esas tres imágenes mediante una autorización temporal de ECR que elimina al terminar. El registro tiene etiquetas inmutables: usar una etiqueta nueva para cada revisión.

```powershell
.venv/Scripts/python.exe scripts/aws-manifests.py --registry CUENTA.dkr.ecr.us-east-2.amazonaws.com --tag ETIQUETA --output k8s/aws/rendered.json
kubectl apply -f k8s/aws/rendered.json
.venv/Scripts/python.exe scripts/aws-dashboard.py
kubectl apply -f k8s/aws/dashboard-configmap.json
```

`rendered.json` conserva los valores exactos del despliegue de este equipo. Regenerarlo para otra cuenta. Contiene dos flotas y sus FleetAutoscalers, gateway con HPA, cliente, RBAC limitado, Ingress y PodMonitors. Cada GameServer atiende un modo y diez humanos como máximo. El gateway conecta por la IP privada del pod; los puertos del juego no se publican directamente en Internet.

Agones mantiene dos servidores listos por modo y admite hasta 110 réplicas por flota. El grupo EC2 está limitado a ocho nodos. Estos límites son protecciones de capacidad, **no evidencia de que se sostengan 1 000 jugadores**. El límite real requiere la carga larga y sus mediciones.

Los servidores llaman Ready y Health, publican su ocupación y solicitan Shutdown tras 90 segundos sin reservas ni conexiones después de haberse ocupado. Las actualizaciones de Fleet conservan las partidas Allocated según el ciclo de vida de Agones. Evitar reaplicar continuamente el campo `replicas` mientras el FleetAutoscaler lo administra.

## Monitoreo privado

Grafana y Prometheus son servicios internos; no tienen entrada pública.

```powershell
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80 --address 127.0.0.1
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090 --address 127.0.0.1
```

El chart genera la contraseña de Grafana en su Secret. Consultarla localmente al iniciar sesión y no agregarla a archivos de evidencia ni a Git. El tablero `Pogo · Integrador AWS` se provisiona mediante ConfigMap y también está exportado en `dashboard.json`.

El histograma `pogo_tick_seconds` mide trabajo de simulación y serialización durante ticks con jugadores; excluye salas vacías y la espera programada entre ticks. No equivale a FPS del navegador ni a latencia de red. Las muestras históricas de la primera revisión incluían ticks vacíos; identificar la versión al comparar resultados.
