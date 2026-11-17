# Pruebas de integración y carga

## Integración local

`smoke.py` comprueba HTTP/WebSocket, diez espacios, reemplazo de bots y aislamiento del contrato externo. Con Docker Compose en ejecución:

```powershell
.venv/Scripts/python.exe loadtest/smoke.py --check-web --output evidence/local/smoke-compose.json
```

La prueba no certifica capacidad de nube, FPS ni latencia de jugadores remotos.

## Mediciones del integrador en AWS

`locustfile.py` implementa tres cargas, ejecutadas en dos EC2 c7i-flex.large separadas del clúster (cuatro procesos trabajadores):

- `PogoUser`: humanos de protocolo, controles a 20 Hz, snapshots y ping. Reserva una sala y abre su WebSocket público. Al terminar una partida vuelve a entrar. Los reintentos usan espera creciente. No cuenta bots como CCU.
- `SpectatorUser`: receptores de HLS de un clip propio 640x360/800 kbps. Descarga segmentos TS de cuatro segundos a ritmo de reproducción, modela buffer y registra faltantes. No decodifica video ni implementa ABR o transmisión en vivo.
- `LeaderboardUser`: mezcla ponderada 80 % lectura de la API y 20 % escritura con IAM InvokeFunction. Los datos van al tablero de prueba. La versión final distribuye el primer acceso entre 0-12 s y espera 8-12 s entre consultas. Esos límites respetan las diez ejecuciones concurrentes de Lambda de esta cuenta; 500 usuarios virtuales no equivalen a 500 ejecuciones simultáneas.

## Escenarios conservados

| Directorio en evidence/aws-load | Escenario |
| --- | --- |
| distributed-preflight | 20 clientes, integración inicial sin errores |
| ramp-1000 | Primera tentativa interrumpida al detectar bloqueo de admisión; no acredita veinte minutos |
| ramp-1000-fixed | 1,000 clientes solicitados a 2/s, 1,200 s. Máximo 843 conexiones activas y errores preservados |
| spike-1000 | 1,000 solicitados a 50/s, 620 s. Crecimiento desde cuatro a diez nodos, máximo 987 conexiones |
| ramp-1000-optimized | 1,000 a 2/s, 1,200 s, diez nodos y seis gateways preparados. CPU de gateway 400m y distribución entre hosts |
| hls-500 | 500 receptores, 310 s, cero errores observados |
| leaderboard-500 | Pausas fijas de 6 s, cuota de Lambda alcanzada |
| leaderboard-500-paced | Pausas de 8-12 s; errores concentrados en la ráfaga inicial de los primeros diez segundos |
| leaderboard-500-steady | Primer acceso distribuido, pausas de 8-12 s, 330 s. Siete lecturas rechazadas y cero escrituras fallidas en 16,199 operaciones |

Cada ejecución conserva `commands.json`, `run.json`, CSV agregados, historia, fallos, excepciones, HTML y logs. Los datos de Prometheus originales tienen paso de 15 s. `summary.json` separa clientes solicitados, conexiones de receptores, gauge de servidor, errores y latencias. Los gauges de distintas salas se muestrean en momentos distintos; durante reconexiones pueden sumar brevemente conexiones antiguas y nuevas. Ese exceso no significa clientes únicos adicionales.

El runner usa salida 0 para conservar el informe aunque fallen solicitudes: **revisar Failure Count**, no solo el estado de SSM/Locust. La duración del runner incluye arranque, parada y exportación. El tiempo solicitado de Locust se conserva por separado.

## Reproducción controlada

Requiere cuenta FREE / ACTIVE, crédito mínimo USD 40, cuota regional suficiente y `loadgen_count=2` aplicado tras revisar el plan. No modificar recursos de otros proyectos. El script limita usuarios a 1,000 y duración a 1,300 s.

```powershell
# Construir el generador y publicar una etiqueta nueva e inmutable antes de usarla.
docker build -f loadtest/Dockerfile -t pogo-loadtest:aws .
& ./scripts/aws-push.ps1 -Tag ETIQUETA_NUEVA -Images @('loadtest')
& ./scripts/aws-run-load.ps1 -Label nueva-rampa -Users 1000 -Rate 2 -Duration 1200 -Tag ETIQUETA_NUEVA
# No iniciar dos cargas simultáneas: usan el mismo puerto maestro de los generadores.
```

Consultar el estado de ambos comandos SSM de `commands.json`. Al terminar, descargar `s3://pogo-artifacts-933605931561-us-east-2/runs/ETIQUETA/` a `evidence/aws-load/ETIQUETA/`. Con port-forward de Prometheus:

```powershell
.venv/Scripts/python.exe scripts/collect-load-metrics.py --label nueva-rampa
.venv/Scripts/python.exe scripts/summarize-load.py
```

`collect-cloud-cost-inputs.py` consulta CloudWatch y Price List, no Cost Explorer. Para ejecutarlo con el perfil de navegador local se necesita `botocore[crt]` en el entorno del operador. `integrator-costs.py` realiza los cálculos con Decimal y separa precios de lista, supuestos y condición de cobro cero.

Al terminar: exportar evidencia, poner `loadgen_count=0`, restaurar mínimos y buffer, revisar/aplicar el plan y verificar que solo desaparecen los dos generadores. Consultar `docs/OPERACION_INTEGRADOR.md` para la demostración pequeña y el retiro completo.
