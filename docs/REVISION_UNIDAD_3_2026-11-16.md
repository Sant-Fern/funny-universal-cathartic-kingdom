# Revisión de entregables de la Unidad 3

**Revisión inicial, conservada como historial.** El estado posterior del despliegue, clasificación, CI/CD y mediciones se encuentra en [INTEGRADOR.md](INTEGRADOR.md) y [DESPLIEGUE_AWS.md](DESPLIEGUE_AWS.md). Las tablas siguientes describen lo encontrado antes de realizar ese trabajo.

Fecha de revisión: 16 de noviembre de 2026.

## Resultado

El PDF corresponde al mismo proyecto integrador que sirvió de base al plan de trabajo. Coinciden las carpetas exigidas, Terraform, Kubernetes/Agones, CI/CD, serverless, métricas, carga de jugadores/espectadores y los seis criterios con sus pesos. Funny Universal Cathartic Kingdom aporta el videojuego que puede usarse como base de esa infraestructura.

El PDF también contiene seis prácticas con entregables independientes. Falta confirmar con el profesor si se entregan todas además del integrador. El nombre Nebula Arena y el combate 5 contra 5 son el caso del material. Nuestro juego tiene Eliminación individual y Carrera por equipos; conviene confirmar que acepta esa adaptación. La rúbrica publicada se centra en infraestructura y evidencia técnica.

**El integrador completo todavía está pendiente.** Hay una base jugable, contenedores y validaciones locales. Los entregables de nube, escalado, clasificación persistente y carga masiva siguen abiertos.

## Fuentes y alcance

- PDF recibido: `C:/Users/santi/Downloads/Unidad3_Infraestructura_y_despliegue_material_de_estudio (1).pdf`.
- ZIP recibido: `C:/Users/santi/Downloads/funny-universal-cathartic-kingdom-cambios-en-mapa.zip`.
- Copia local del repositorio en el commit `a05a5f0`, con árbol de trabajo limpio al comenzar la revisión.
- Se inspeccionaron el contenido del ZIP, el código, los manifiestos, la automatización y la evidencia almacenada. Se compararon archivos normalizando finales de línea.
- Esta revisión no ejecutó el código del ZIP, no repitió las pruebas del juego y no aprovisionó recursos. Las cifras de pruebas del ZIP se consideran resultados declarados en sus registros, no una nueva certificación.
- Se intentó consultar las últimas ejecuciones de GitHub Actions mediante la API pública. Respondió HTTP 404. El estado actual del pipeline remoto queda sin verificar.

El PDF tiene 49 hojas físicas, incluida la portada. En esta revisión las páginas citadas son las numeradas dentro del documento. El integrador está en la página 44, hoja física 45. La rúbrica está en la página 45, hoja física 46.

## Qué contiene el ZIP

Es otra versión del mismo proyecto. Agrega el mapa surrealista, estructuras transitables más grandes, rebote continuo, ajustes de carga, globos inclinados, empujones corporales y puntuación de Carrera por puestos y aportes del equipo.

Los 16 archivos presentes bajo `infra/`, `k8s/`, `loadtest/`, `gateway/`, `serverless/` y `.github/` son iguales a sus equivalentes locales después de normalizar finales de línea. El ZIP conserva los pendientes de infraestructura de la copia local.

Sus registros de juego más recientes declaran 112 pruebas aprobadas, 92 de servidor y 20 de cliente. Ese número corresponde a lógica y cliente del juego. Los cambios de puntuación y los resultados mostrados al final de una partida todavía viven en memoria, sin clasificación global persistente.

## Comparación con los entregables del integrador

Fuente de requisitos: página 44 del PDF.

| Entregable | Estado encontrado | Qué falta para entregarlo |
| --- | --- | --- |
| Repositorio con `infra/`, `server/`, `k8s/`, `serverless/` y `loadtest/` | Parcial. Existen las carpetas. `server/` contiene aplicación, pruebas y Dockerfile. `infra/gcp/` contiene Terraform base. | Completar la funcionalidad de las carpetas pendientes, especialmente Agones, serverless y Locust. La existencia de una carpeta no acredita su requisito. |
| Infraestructura con Terraform | Parcial. Red, subred, NAT, registro de imágenes, cuenta de servicio, GKE y node pool con límites de escalado definidos. Hay validación local registrada. | Estado remoto realmente configurado, `plan` revisado en PR, `apply`, clúster funcionando e instalación de Agones. Completar los recursos del alcance elegido y demostrar `destroy` y revisión de recursos residuales. |
| Contenedores y flota Agones | Parcial. Dockerfiles para cliente y servidor, Compose y evidencia histórica de ejecución en Kubernetes local con requests/limits. | Instalar Agones, crear Fleet, integrar Ready/Health/Shutdown y probar GameServerAllocation con estados Ready y Allocated. Preparar el enrutamiento de cada sala. |
| Pipeline CI/CD en verde que prueba, publica imagen y actualiza Fleet | Parcial. GitHub Actions contiene tests, build, integración Compose y validación Terraform. | Publicación en Artifact Registry/ECR con etiqueta del commit, actualización de la flota y evidencia de una ejecución exitosa. Comprobar rollback y conservación de partidas ocupadas. |
| Tablero Grafana | Pendiente. El servidor tiene `/health` y variables internas de tick. | Exponer métricas Prometheus, instalar monitoreo, crear PodMonitor y tablero con CCU, tick p99, GameServers por estado y nodos. Conservar exportación y capturas. |
| Autoescalado de flota, pods y nodos | Pendiente de demostración. Terraform contiene configuración de escalado del pool. | FleetAutoscaler, HPA para un servicio sin estado y Cluster Autoscaler funcionando. Generar demanda y registrar cambios reales y tiempo de reacción de cada capa. |
| Rampa y pico de 1 000 jugadores | Pendiente. Hay `smoke.py` para una sala y JSON históricos de dos y diez conexiones. | Implementar Locust con asignación de varias partidas y diez conexiones por partida. Ejecutar rampa y pico, guardar CSV, métricas y errores. |
| 500 espectadores y extrapolación a 20 000 | Pendiente. No se encontraron implementación HLS/CDN ni generador de espectadores. | Preparar video HLS de prueba, publicarlo en almacenamiento/CDN, ejecutar 500 espectadores y documentar egress, errores, rebuffering y extrapolación a 20 000. |
| Tabla de líderes serverless | Pendiente. `serverless/` solo tiene un README. | Servicio de resultados y top global con almacenamiento persistente, despliegue, URL y pruebas de lectura/escritura bajo carga. |
| Reporte técnico de máximo seis páginas | Pendiente. Hay plan, guías y registros locales. | Informe final con arquitectura real, resultados medidos, capacidad, reacción de escalado, costos por hora/jugador y recomendaciones. |
| Presentación de diez minutos con autoescalado en vivo | Pendiente. No se encontraron presentación ni evidencia de esa demostración. | Preparar presentación, entorno demostrable, secuencia ensayada y evidencia de escalado. |

## Estado frente a la rúbrica

Fuente de criterios y pesos: página 45 del PDF. Esto no asigna una calificación.

| Criterio | Peso | Evaluación del material disponible |
| --- | --- | --- |
| Infraestructura como código | 20 % | Preparación parcial. `validate` acredita sintaxis; falta demostrar creación y eliminación de recursos reales y uso del estado remoto. |
| Contenedores y orquestación | 20 % | Es el bloque con más evidencia local. Los JSON y registros documentan Compose y Kubernetes local. Falta la flota Agones sana y el SDK que exige el nivel Excelente. La aceptación de la demostración local corresponde al profesor. |
| Autoescalado | 20 % | Sin evidencia de cambios reales de capacidad. Definir `autoscaling` en Terraform no demuestra que escaló. |
| Métricas y pruebas de carga | 20 % | Pruebas pequeñas de integración. Falta curva CCU/latencia, carga de jugadores/espectadores y conclusiones de capacidad. |
| CI/CD y serverless | 10 % | CI definido. Publicación/despliegue de flota y tabla de líderes están pendientes. Estado remoto del CI sin verificar. |
| Comunicación | 10 % | Documentación de trabajo disponible. Reporte final, análisis de costos y demo de diez minutos pendientes. |

El 80 % corresponde a los primeros cuatro criterios. El trabajo visual del videojuego permite construir la demostración, pero los indicadores que puntúa esta rúbrica requieren infraestructura y mediciones.

## Entregables de cada práctica

Aplican si el profesor solicita las prácticas individuales además del integrador.

| Práctica | Qué pide el PDF | Situación |
| --- | --- | --- |
| 3.1 Entrenar y servir un bot, páginas 7–8 | Notebook PPO/CartPole, comparación de entrenamiento CPU/GPU, latencia de inferencia, decisiones/s por núcleo, dimensionamiento para 2 000 bots a 10 Hz y costo por hora. | Pendiente. Los bots del juego usan decisiones programadas; no se encontraron notebook de entrenamiento, modelo PPO ni esas mediciones. |
| 3.2 CI/CD, páginas 10–12 | Captura del pipeline verde, imagen publicada con etiqueta del commit y explicación de rollback. El procedimiento incluye actualizar Fleet. | Parcial por el workflow de comprobaciones. Faltan publicación, despliegue y evidencia del flujo completo. |
| 3.3 Contenerización y orquestación, páginas 14–19 | Capturas de Docker, `/metrics` y GameServers antes/después de asignar. Explicación del efecto de borrar un pod Allocated. | Docker y Kubernetes local tienen evidencia histórica. Faltan `/metrics`, Agones, asignación y la explicación solicitada. |
| 3.4 Carga y métricas, páginas 26–32 | Reporte de 2–3 páginas con tres gráficas, capacidad medida por nodo, reacción del escalado y configuración justificada. Rampa, pico y espectadores. | Pendiente. Los registros de smoke test no cubren estas cargas ni las gráficas. |
| 3.5 Tabla de líderes, páginas 35–37 | URL funcionando, captura de concurrencia durante carga y comparación de costo serverless frente a una VM mensual. La prueba usa hasta 500 usuarios, 80 % lecturas y 20 % escrituras. | Pendiente. No hay servicio implementado ni mediciones. |
| 3.6 Terraform, páginas 39–43 | Repositorio `infra/`, plan revisado en PR, captura de clúster operativo y evidencia de `destroy` sin recursos huérfanos. | Parcial por código y validación local. Faltan ejecución y evidencia real del ciclo completo. |

El reporte de 2–3 páginas de la práctica 3.4 y el reporte de máximo seis páginas del integrador son entregables distintos en el PDF. Confirmar si el profesor permite integrarlos en una sola entrega.

## Metas de carga del documento

- Rampa de 1 000 jugadores, dos ingresos por segundo y veinte minutos de ejecución total.
- Pico de 1 000 jugadores, cincuenta ingresos por segundo y diez minutos de ejecución.
- Quinientos espectadores a 360p durante cinco minutos contra la CDN.
- Extrapolación a 20 000 espectadores a 1080p y 6 000 kbps, con egress y costos calculados.
- La práctica 3.4 contempla una variante reducida de 300 jugadores y 200 espectadores por poca cuota. La lista del integrador conserva 1 000 y 500. Confirmar con el profesor cuál alcance acepta para la entrega.

Los bots internos ocupan puestos del juego. Para esas pruebas de jugadores se necesitan conexiones de clientes simulados distribuidas entre servidores.

## Dependencias que faltan resolver

1. Confirmar si se entrega el integrador, las seis prácticas o ambos, y si se acepta nuestro juego como adaptación del caso Nebula Arena.
2. Confirmar proveedor y acceso autorizado. El material propone GCP y AWS. Azure no figura como ruta de prácticas; si se elige, confirmar su aceptación y adaptar Terraform y despliegue.
3. Ejecutar Terraform contra la cuenta real y completar Agones, asignación de salas y entrada de red de la demostración.
4. Completar publicación y despliegue por CI/CD, y la clasificación persistente serverless.
5. Instrumentar Prometheus/Grafana y ejecutar las cargas con escalado medido, conservando los datos originales.
6. Preparar los reportes, costos y presentación con los resultados obtenidos, y documentar el retiro de recursos.

Agregar réplicas al servidor actual requiere cambiar la asignación y el enrutamiento. Ahora mantiene las partidas y las reservas en la memoria del proceso, con una sala por modo. La arquitectura de muchas partidas necesita que cada conexión llegue a su servidor asignado.

## Evidencia concreta inspeccionada

- Aplicación y control de partidas: `server/app.py`, `server/game.py` y `server/tests/`.
- Contenedores: `client/Dockerfile`, `server/Dockerfile`, `compose.yaml` y `client/nginx.conf`.
- Integración local histórica: `evidence/local/VALIDACION.md`, `smoke-compose.json`, `smoke-kubernetes.json`, `smoke-2.json` y `smoke-10.json`.
- Infraestructura y límites de alcance: `infra/gcp/*.tf`, `infra/README.md`, `k8s/demo/demo.yaml` y `k8s/README.md`.
- Automatización: `.github/workflows/checks.yml`.
- Funcionalidad aún pendiente: `gateway/README.md`, `serverless/README.md`, `loadtest/README.md` y `loadtest/smoke.py`.
- Cambios adicionales del ZIP: sus registros `CARRERA_CIMA.md`, `SUENO_REBOTE_CONTINUO.md`, `MAPA_AMPLIADO_CARGA_SUELO.md` y `GLOBOS_INCLINACION_EMPUJONES.md`.

Los registros locales incluyen versiones previas del juego. Acreditan aquellas comprobaciones y su alcance local; la versión finalmente desplegada debe quedar identificada con su commit y su propia evidencia de nube.
