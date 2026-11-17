# Clasificación en AWS

`handler.py` corre en Lambda (Python 3.14, arm64, 256 MB). API Gateway HTTP publica exclusivamente `GET /leaderboard?mode=eliminations|race`. El menú consulta la misma ruta a través de `/api/leaderboard` del gateway del juego.

Los servidores de Agones envían el resultado al terminar una partida mediante IAM InvokeFunction y EKS Pod Identity. El navegador no puede escribir puntuaciones. `server/results.py` reintenta en segundo plano y mantiene vivo el GameServer mientras quedan resultados pendientes. La cola es de memoria: una caída abrupta del proceso puede perder un resultado todavía no confirmado.

DynamoDB usa claves `pk/sk`: un marcador por `MATCH#{match_id}` y entradas `BOARD#{mode}` ordenadas por puntuación. Una transacción guarda marcador y jugadores juntos. Repetir el mismo resultado es idempotente; cambiar un resultado ya registrado se rechaza. Solo se guardan humanos, con apodos sin verificar. Es una tabla de las mejores partidas, no puntuación acumulada de cuentas. Eliminación: globos restantes x 100 + globos reventados. Carrera: puntos de llegada del juego.

Los nombres `LT-`/`QA-` separan las partidas sintéticas en `#TEST`, consultable con `test=1`. Retención lógica: clasificación 30 días, marcador de idempotencia 365 días, logs 7 días. DynamoDB TTL elimina físicamente de forma asíncrona. IAM limita el acceso a la tabla del proyecto y a su función. La API pública es de lectura.

Infraestructura: `infra/aws/serverless.tf`. Pruebas: `.venv/Scripts/python.exe -m pytest serverless/test_handler.py -q` con Moto. Las evidencias de una partida completa y las pruebas de carga se conservan bajo `evidence/`.
