# Despliegue del integrador en AWS

El estado consolidado está en [INTEGRADOR.md](INTEGRADOR.md), la guía para entregar y operar está en [OPERACION_INTEGRADOR.md](OPERACION_INTEGRADOR.md), y el guion de diez minutos está en [GUION_INTEGRADOR.md](GUION_INTEGRADOR.md). Las seis prácticas individuales se realizan aparte.

**Juego publicado:** https://d1oif12lvr7c7k.cloudfront.net

## Requisitos del material

Las páginas internas 44-45 (hojas físicas 45-46) piden repositorio organizado, Terraform con estado remoto y ciclo de creación/eliminación, contenedores y Agones, CI/CD, clasificación persistente, Prometheus/Grafana, tres capas de escalado, cargas de jugadores y espectadores, informe de hasta seis páginas y presentación de diez minutos. El profesor debe aceptar la adaptación de Nebula Arena a los dos modos del videojuego.

## Implementación comprobada

- Versión fuente: ZIP de cambios de mapa elegido por el usuario. SHA-256 del ZIP: `4E1A635032C122599FB4137F701EB39219161DE4F190C9C5E9E30AAAA476A851`.
- EKS 1.35 en Ohio, VPC propia con dos subredes, sin NAT Gateway. Agones 1.62.0 y dos Fleets con diez espacios por sala.
- ECR con etiquetas inmutables del commit. El pipeline prueba, publica tres imágenes, actualiza Fleet y comprueba HTTP/WSS y clasificación desde el dominio público.
- Ready/Health/Shutdown, reserva atómica de puestos y enrutamiento de WebSocket por GameServer. Se conservan las partidas Allocated al actualizar Fleet.
- FleetAutoscaler por modo, HPA del gateway y Cluster Autoscaler. Configuración habitual: dos salas libres por modo, HPA 2-6 y nodos 2-8. La prueba preparada usa temporalmente diez nodos y seis gateways. El cierre real queda en `evidence/aws/final-status.json`.
- API Gateway, Lambda y DynamoDB para clasificación. Escritura IAM desde los GameServers, transacciones e idempotencia por partida. Los nombres LT-/QA- separan las pruebas de los resultados normales.
- Prometheus y Grafana privados, PodMonitor y tablero exportado. Las mediciones originales sobreviven en JSON/CSV, además de capturas. Prometheus retiene 24 horas sin disco persistente.
- 119 pruebas automatizadas: 96 servidor, 20 cliente, 3 clasificación. La advertencia de deprecación de Starlette/httpx no hizo fallar los checks.

## Evidencias

- `evidence/aws-ci/`: ejecución exitosa, prueba pública, imágenes del commit, menú/clasificación y Grafana. La reversión de Fleet mantuvo una conexión durante 100 s, con 2,002 snapshots y 97 respuestas de ping.
- `evidence/aws-terraform-cycle/`: plan revisado y ciclo de 55 recursos en un estado y nombres separados. Clúster operativo, contenedor de prueba, destroy de 55 recursos y estado final vacío. Solo quedó el clúster principal `pogo-demo`.
- `evidence/aws-load/`: generadores EC2 separados del clúster, metadatos, CSV, HTML, logs y Prometheus. Se preservan también los ensayos fallidos. `summary.json` distingue usuarios solicitados, conexiones activas, errores y latencias.
- `evidence/aws/integrator-costs.json`: cálculo reproducible de precios de lista, costo por hora/jugador y extrapolación de video. No es una factura.

La primera rampa completa alcanzó 843 conexiones activas; el pico posterior alcanzó 987 y mostró la espera de crear capacidad. La rampa final preparada y la repetición de clasificación se incorporan al informe con sus cifras finales. Un pico de CCU no demuestra estabilidad ni un SLO. Los generadores no miden FPS ni mil navegadores gráficos.

## Cuenta y condición de costo

Se verificó plan **FREE / ACTIVE**, vencimiento el 16 de abril de 2027 y cuota regional estándar de 32 vCPU. Las cuatro instancias de otros proyectos comparten la cuota y el crédito; no se modificaron.

El objetivo USD 0 corresponde al cobro al usuario mientras conserve Free. Los servicios consumen crédito y el acceso termina al agotarlo o vencer el plan. No cambiar a Paid ni activar acciones que cambien automáticamente de plan. El guard de Terraform exige al menos USD 40 de crédito antes de crear/actualizar y no constituye un apagado automático. Consultar el saldo antes de repetir cargas.

La cuenta rechazó crear OIDC por una política de servicio. Se utilizó EKS Pod Identity sin modificar esa restricción. La administración del clúster se restringe a la IP del operador. Grafana y Prometheus no tienen entrada pública.

Fuentes: [plan Free](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html), [EKS](https://aws.amazon.com/eks/pricing/), [CloudFront pay-as-you-go](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/), [IPv4](https://aws.amazon.com/vpc/pricing/), [EBS](https://aws.amazon.com/ebs/pricing/).

## Revisión del equipo

El [PR 1](https://github.com/Sant-Fern/funny-universal-cathartic-kingdom/pull/1) conserva los cambios para revisión humana antes de fusionar. La exposición debe realizarla el equipo. El juego principal permanece publicado para esa demostración; los recursos temporales se retiran al terminar las mediciones. Para la retirada completa seguir `OPERACION_INTEGRADOR.md` y `infra/aws/README.md`, conservando antes los datos necesarios.
