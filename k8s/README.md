# Comprobación privada en Kubernetes

El manifiesto [`demo/`](demo/) levanta el cliente Nginx y **una sola réplica** del servidor. Ambos servicios son internos; Nginx resuelve el servicio `server:8000` y sirve HTTP y WebSocket en el mismo origen. Se usa port-forward para la prueba. Este manifiesto no publica el juego, no usa Agones y no es una plantilla de autoescalado.

## Publicar las imágenes de una revisión

Con una revisión limpia ya guardada en Git, un registro de equipo y permisos de escritura. El ejemplo supone que se aplicó la [base de GCP](../infra/README.md). Para otro proveedor usar su registro y su método de autenticación.

```powershell
$pogoRepo = terraform -chdir=infra/gcp output -raw image_repository
$pogoTag = git rev-parse --short=12 HEAD
$pogoRegistry = ($pogoRepo -split '/')[0]
gcloud auth configure-docker $pogoRegistry
docker build --platform linux/amd64 -t "${pogoRepo}/server:${pogoTag}" -f server/Dockerfile .
docker build --platform linux/amd64 -t "${pogoRepo}/client:${pogoTag}" -f client/Dockerfile .
docker push "${pogoRepo}/server:${pogoTag}"
docker push "${pogoRepo}/client:${pogoTag}"
```

## Probar en el clúster del equipo

En la misma sesión de PowerShell, tras confirmar los valores anteriores, obtener las credenciales del clúster de demostración. Revisar `kubectl config current-context` antes de continuar. Detenerse si falla cualquier comando; no usar un contexto compartido ajeno.

```powershell
$pogoCluster = terraform -chdir=infra/gcp output -raw cluster_name
$pogoZone = terraform -chdir=infra/gcp output -raw cluster_zone
gcloud container clusters get-credentials $pogoCluster --zone $pogoZone --project $pogoProject
kubectl config current-context
```

```powershell
$pogoManifest = kubectl kustomize k8s/demo | ForEach-Object {
  $_.Replace('example.invalid/pogo/server:replace-me', "${pogoRepo}/server:${pogoTag}").Replace('example.invalid/pogo/client:replace-me', "${pogoRepo}/client:${pogoTag}")
}
kubectl create namespace pogo-demo --dry-run=client -o yaml | kubectl apply -f -
$pogoManifest | kubectl apply --dry-run=server -f -
# Si el manifiesto es válido, aplicar y esperar:
$pogoManifest | kubectl apply -f -
kubectl -n pogo-demo rollout status deployment/server --timeout=120s
kubectl -n pogo-demo rollout status deployment/client --timeout=120s
kubectl -n pogo-demo port-forward service/client 8080:80
```

En un segundo terminal:

```powershell
.\.venv\Scripts\python.exe loadtest/smoke.py --check-web --output evidence/local/smoke-kubernetes.json
```

Si el puerto local 8080 está ocupado, usar otro en el port-forward y pasar el origen correspondiente con `--url`. Conservar el JSON y las versiones. Detener port-forward y retirar el manifiesto de demo cuando termine la comprobación (`$pogoManifest | kubectl delete -f -`, solo en el contexto de demostración).

**Para publicar varias salas:** implementar el ciclo de vida Agones, la asignación y el enrutado WSS de la [guía de traspaso](../docs/TRASPASO.md). Cambiar `replicas: 1` por un número mayor perdería reservas porque el token solo existe en la memoria del servidor que lo emitió.
