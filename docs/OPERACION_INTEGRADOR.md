# Operación y entrega del integrador

## Qué entregar

- Informe de seis páginas: `output/pdf/Informe_integrador_AWS.pdf`.
- Presentación editable: `output/presentations/Presentacion_integrador_AWS.pptx` y `GUION_INTEGRADOR.md`.
- Repositorio y PR: https://github.com/Sant-Fern/funny-universal-cathartic-kingdom/pull/1 . Revisar el plan antes de fusionar a `main`.
- Evidencias: `evidence/aws-ci/`, `evidence/aws-terraform-cycle/`, `evidence/aws-load/` y `evidence/aws/`. Los CSV/JSON originales acompañan los resúmenes.

Esto cubre el integrador del videojuego. Las seis prácticas individuales se realizan y entregan aparte. El profesor debe aceptar la adaptación de Nebula Arena a los modos de este juego; el informe declara esa diferencia.

## Acceso

Juego: https://d1oif12lvr7c7k.cloudfront.net . Clasificación pública de lectura: https://6jc2etk9n4.execute-api.us-east-2.amazonaws.com/leaderboard?mode=eliminations . No hay un endpoint público que acepte puntuaciones del navegador.

El entorno usa EKS `pogo-demo` en Ohio. El perfil local `neural-chess` pertenece a la cuenta utilizada; su nombre no significa que se deba modificar el proyecto Neural Chess. No tocar las instancias de otros proyectos.

```powershell
# Usar la sesión de AWS autorizada del operador. No copiar claves de otra persona.
aws login --profile neural-chess
aws freetier get-account-plan-state --profile neural-chess --region us-east-1
aws eks update-kubeconfig --profile neural-chess --region us-east-2 --name pogo-demo --kubeconfig .tools/pogo.kubeconfig
$env:KUBECONFIG=(Resolve-Path .tools/pogo.kubeconfig).Path
kubectl get fleet -n pogo
```

Si cambia la IP de administración, actualizar `admin_cidr` en el archivo local de variables y revisar/aplicar el plan. No abrir la administración del clúster a todo Internet.

## Tablero para la exposición

```powershell
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80 --address 127.0.0.1
# Abrir http://127.0.0.1:3000 y el tablero Pogo · Integrador AWS.
```

El chart conserva el usuario y contraseña de Grafana en el Secret `monitoring-grafana`. Consultarlos localmente y no mostrarlos en capturas, archivos de evidencia ni Git. El acceso es privado; no crear una entrada pública solo para exponer.

Prometheus conserva 24 h y usa almacenamiento temporal. Para resultados históricos usar `prometheus.json`, los CSV y `grafana-rampa.jpg` exportados. Los tiempos de `commands.json` están en UTC; Grafana puede mostrarlos en hora de México.

## Demostración pequeña de crecimiento de salas

Confirmar primero que el plan siga FREE y ACTIVE. Esta demostración usa el equipo del expositor como generador; no necesita crear las dos máquinas de la carga grande.

```powershell
.venv/Scripts/python.exe -m pip install -r loadtest/requirements.txt
New-Item -ItemType Directory evidence/demo -Force | Out-Null
$env:LOAD_OUTPUT=(Resolve-Path evidence/demo).Path
.venv/Scripts/python.exe -m locust -f loadtest/locustfile.py PogoUser --headless --host https://d1oif12lvr7c7k.cloudfront.net -u 60 -r 4 -t 90s --csv evidence/demo/locust
Remove-Item Env:LOAD_OUTPUT
```

Observar Fleet y estados en Grafana. Sesenta usuarios pueden hacer crecer salas sin exigir un nodo nuevo. No prometer que las tres capas escalarán en 90 s. Las mediciones de 1,000 usuarios y el crecimiento de nodos ya están preservados.

## Despliegues posteriores

`checks.yml` prueba juego, Compose y Terraform. `integrator.yml` usa un ejecutor local efímero con las etiquetas `Windows`, `X64`, `pogo-aws`. Para repetirlo se necesita registrar un ejecutor propio en este repositorio privado, sesión vigente de AWS y las variables de proceso `POGO_SOURCE_ROOT` (copia local) y `POGO_TOOL_ROOT` (carpeta `.tools` con Terraform). Los archivos `backend.hcl` y `local.auto.tfvars.json` se proporcionan localmente y no se versionan.

La publicación etiqueta imágenes con el SHA del commit. Actualizar Fleet conserva GameServers Allocated de la revisión anterior hasta que terminen. Reiniciar el gateway sí corta sus conexiones, por lo que se debe desplegar fuera de partidas reales o añadir drenado antes de producción. La prueba de reversión preservada corresponde a Fleet, no a una promesa de cero interrupciones del gateway.

## Crédito y retiro

Conservar FREE / ACTIVE y no activar Paid ni acciones que cambien automáticamente de plan. El guard de Terraform exige al menos USD 40 de crédito para crear/actualizar; no es un apagado automático. El crédito se comparte con otros proyectos y el saldo informado puede tener retraso.

Los generadores de carga son temporales (`loadgen_count=0` en operación normal). El buffer normal es dos servidores por modo, HPA mínimo dos y mínimo de nodos dos. El escalador puede conservar más nodos mientras existan pods que impidan consolidar. Consultar `evidence/aws/final-status.json` para el cierre medido de esta entrega.

Para retirar el juego completo cuando termine la evaluación: conservar evidencia, eliminar primero el Ingress y esperar a que AWS Load Balancer Controller retire el ALB. Después retirar los componentes Kubernetes y revisar/aplicar el destroy del estado principal `pogo/demo.tfstate`. Revisar nodos, discos, ALB, grupos de destino, CloudFront, Lambda, DynamoDB, ECR y S3 de este proyecto. Los repositorios y buckets con datos requieren una decisión explícita de conservar o eliminar esos datos. El bucket del estado se administra aparte; no borrar sus versiones ni recursos de otros proyectos por coincidencia de nombre.
