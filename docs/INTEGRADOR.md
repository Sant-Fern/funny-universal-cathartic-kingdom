# Integrador del videojuego en AWS

Las seis prácticas individuales son entregas separadas. Este documento reúne únicamente el integrador de la página 44 del material de la Unidad 3 (hoja física 45).

## Acceso y alcance

- Juego: https://d1oif12lvr7c7k.cloudfront.net
- Clasificación: https://6jc2etk9n4.execute-api.us-east-2.amazonaws.com/leaderboard?mode=eliminations
- Región: Ohio, `us-east-2`. EKS 1.35, Agones 1.62.0, dos modos de diez espacios por sala.
- La fuente del juego es el ZIP de cambios de mapa elegido por el usuario. No se incluyen las seis prácticas en esta entrega.
- La adaptación usa Eliminación individual y Carrera por equipos. El profesor debe aceptar la adaptación del caso Nebula Arena del material.

## Evidencia por requisito

| Requisito | Implementación y evidencia |
| --- | --- |
| Repositorio organizado | `infra/aws`, `server`, `gateway`, `k8s/aws`, `serverless`, `loadtest` |
| IaC y estado remoto | Terraform 1.13.5, backend S3 cifrado, versionado y bloqueo. `evidence/aws/integrator-plan.txt` y ciclo aislado `evidence/aws-terraform-cycle/` |
| Contenedores y Agones | Imágenes ECR, usuario sin privilegios, requests/limits, SDK Ready/Health/Shutdown, dos Fleets y asignación con reserva atómica en la sala |
| CI/CD | `.github/workflows/checks.yml` prueba juego, Compose y Terraform. `integrator.yml` prueba, publica tres imágenes etiquetadas con SHA, actualiza Fleet y verifica conexión pública |
| Métricas | Prometheus y Grafana internos. Tablero importable `k8s/aws/dashboard.json`: CCU, trabajo de tick p99, estados, nodos, CPU y réplicas |
| Autoescalado | FleetAutoscaler por modo, HPA del gateway 2-6, Cluster Autoscaler 2-8 nodos. Buffer temporal de prueba separado del valor normal de dos salas |
| Clasificación persistente | API Gateway, Lambda y DynamoDB. Escritura IAM desde GameServers, transacciones e idempotencia por partida. `serverless/README.md` |
| Carga de jugadores y espectadores | Generadores EC2 separados del clúster. CSV, HTML, logs, metadatos y Prometheus en `evidence/aws-load/`. El informe distingue clientes solicitados de conexiones activas |
| Informe y presentación | [Informe de seis páginas](../output/pdf/Informe_integrador_AWS.pdf), [PowerPoint](../output/presentations/Presentacion_integrador_AWS.pptx) y [guion de diez minutos](GUION_INTEGRADOR.md) |

## Revisión y despliegue automático

La rama `codex/integrador-aws` conserva los cambios para revisión antes de integrarlos a `main`. El plan guardado es revisable: las comprobaciones no aplican automáticamente cambios de Terraform. El pipeline sí publica imágenes y actualiza las aplicaciones, dentro del alcance autorizado de este entorno de demostración.

El ejecutor local de GitHub es temporal y efímero. Usa la sesión temporal de AWS del usuario, nunca claves permanentes en el repositorio ni en GitHub Secrets. Se activa únicamente para código de este repositorio privado y no para cambios externos sin revisar. Otra persona debe registrar su propio ejecutor, iniciar sesión en AWS y proporcionar `POGO_SOURCE_ROOT` y `POGO_TOOL_ROOT` como se documenta en el despliegue. La revisión humana del PR y la exposición oral corresponden al equipo.

## Costo y conservación

La cuenta debe permanecer en plan **FREE / ACTIVE**. AWS garantiza que ese plan no genera cobros; sí consume créditos y cierra el acceso al agotarlos o terminar su vigencia. No cambiar a Paid, no unirse a AWS Organizations ni activar acciones que cambien automáticamente de plan. El guard de Terraform exige un mínimo de USD 40 de crédito antes de crear o actualizar. No es un apagado automático. El saldo se comparte con otros proyectos de la cuenta.

Fuente oficial: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html

Los precios de lista del informe sirven para analizar la arquitectura antes de créditos y franquicias. No representan una factura ni alojamiento gratuito permanente. Los generadores y el entorno de validación se eliminan al terminar las pruebas. El entorno principal queda disponible para la presentación hasta que el usuario solicite retirarlo. Prometheus usa almacenamiento temporal y retención de 24 horas; los JSON/CSV exportados son la evidencia duradera.

## Límites que deben explicarse

La carga usa clientes de protocolo en Ohio y no mide FPS, experiencia gráfica ni latencia desde las casas de jugadores. Las conexiones cuentan humanos simulados, nunca los bots internos. HLS usa un clip sintético propio a 360p/800 kbps y un modelo de buffer, sin decodificador ni transmisión en vivo. La clasificación utiliza 500 usuarios con pausas de 8-12 s y primer acceso distribuido por la cuota de diez ejecuciones concurrentes de Lambda; conserva también las pruebas previas que encontraron throttling. El resultado publicado clasifica mejores partidas por apodo, sin cuentas verificadas.
