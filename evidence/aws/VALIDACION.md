# Validación del despliegue AWS — 16 de noviembre de 2026

URL: https://d1oif12lvr7c7k.cloudfront.net

- Fuente elegida: ZIP con cambios de mapa; SHA-256 registrado en `docs/DESPLIEGUE_AWS.md`.
- Revisión final de imágenes: `zip-aws-20261116-02`. `final-images.json` registra imagen solicitada y digest observado por Kubernetes. Un tag de estado puede mostrar un alias anterior si los bytes de la imagen son idénticos; el digest identifica el contenido.
- `npm test`: 94 pruebas Python y 20 JavaScript aprobadas. Una advertencia de deprecación de Starlette/httpx.
- `npm run build` y construcción de las tres imágenes Docker: aprobados. Advertencia de tamaño del paquete gráfico del cliente.
- Terraform AWS y bootstrap: `fmt -check` y `validate` aprobados con los proveedores instalados. `plan` final: **No changes. Your infrastructure matches the configuration.**
- Terraform se aplicó realmente con estado remoto. El plan inicial de acceso usaba una ruta IAM incompleta; se corrigió con el ARN obtenido de IAM y se registró el grupo de nodos ya creado. El plan final no intenta duplicar nodos.
- La política de la cuenta rechazó OIDC. Se utilizó EKS Pod Identity, sin modificar esa política.
- Dos nodos Kubernetes Ready. Agones 1.62.0, flotas y FleetAutoscalers por modo, HPA, Cluster Autoscaler y metrics-server activos.
- Grafana: consulta autenticada de la API confirmó el tablero `Pogo · Integrador AWS`, ocho paneles (`grafana-check.json`).
- Conexión real en Chrome al menú y al mapa por HTTPS. No es una certificación de FPS ni de respuesta del ratón físico.

## Pruebas del protocolo

| Archivo | Revisión | Alcance |
| --- | --- | --- |
| `../aws-smoke-race.json` | -01 | Dos jugadores, Carrera, origen HTTP. |
| `../aws-smoke-eliminations-10.json` | -01 | Diez jugadores, Eliminación, origen HTTP. |
| `../aws-smoke-https-race-10.json` | -01 | Diez jugadores, Carrera, dominio HTTPS/WSS. |
| `../aws-multi-room.json` | -01 | Cuarenta CCU, veinte segundos de coincidencia, dos partidas por modo; cero errores. |
| `smoke-final-02.json` | -02 | Dos jugadores, Carrera, seis segundos, HTTPS/WSS; cero fallos de la comprobación. |

En la prueba de cuarenta jugadores las flotas llegaron a cuatro GameServers por modo y regresaron a dos por modo al retirar las sesiones vacías. Los dos nodos y las dos réplicas del gateway fueron suficientes para esa prueba; no se acredita escalado de nodos ni HPA bajo carga.

## Datos originales y costos

`prometheus.json` conserva respuestas de la API de Prometheus, con un intervalo de extracción de quince segundos. `orchestration.json` y `final-orchestration.json` conservan recursos de flota y HPA. `nodes.json` conserva el inventario de nodos de este clúster.

La primera revisión incluía ticks sin jugadores en su histograma. La revisión final solo cuenta ticks activos; las series históricas de ambas revisiones deben interpretarse con esa diferencia. No confundir tick p99, RTT de red y FPS.

`account-plan.json`: Free activo y saldo informado de USD 142,39 después del despliegue. AWS puede actualizar el saldo con retraso. No se verificó consumo nulo; el entorno tiene costo bruto y utiliza créditos. No se cambió la cuenta a Paid.

`ec2-prices.json`, `alb-prices.json` y `cost-baseline.json` conservan tarifas y el cálculo base. Excluyen varios componentes del costo total, identificados dentro del cálculo. La protección de cobro USD 0 depende de conservar Free activo.

Este registro no sustituye las cargas de 1 000 jugadores/500 espectadores, la clasificación serverless, el CI/CD completo, el informe final ni la evidencia futura de retiro de recursos. El detalle de pendientes del PDF está en `docs/DESPLIEGUE_AWS.md`.
