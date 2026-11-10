# Protocolo local v0.2

HTTP y WebSocket comparten origen a través del proxy de Vite o Nginx. No hay URL de nube compilada dentro del cliente.

1. `POST /api/join` con `{"name":"Huesitos","mode":"race"}` devuelve token de un solo uso con 30 segundos de vigencia y `websocketPath`. Omitir el modo selecciona `eliminations`. Cada modo tiene su propia sala local. observation se acepta como alias de race al ingresar.
2. Abrir `/ws?token=...`. El servidor valida origen de navegador, vigencia, token y cupo. Las reservas no conectadas también ocupan cupo hasta vencer.
3. Recibir `welcome` con `playerId`, `team` (0 menta, 1 coral o null en globos), yaw inicial y configuración.
4. Enviar `input` a 20 Hz y recibir `snapshot` a 20 Hz. Los renderizados interpolan los dos últimos snapshots.
5. Cuando `status` sea `finished`, mostrar resultados y volver al inicio cerrando la conexión.

```json
{"type":"input","seq":1,"moveX":0,"moveZ":1,"yaw":0,"pitch":0,"fire":false,"jumpPower":null,"power":0.6,"bottle":"standard"}
```

`moveX` y `moveZ` van de -1 a 1 en coordenadas de mundo. El servidor normaliza diagonales y aplica el desplazamiento solo durante el salto. `yaw` y `pitch` son radianes. La secuencia debe aumentar. Los controles caducan después de 0.5 segundos sin renovación. No se aceptan coordenadas ni daño decididos por el cliente.

`jumpPower` es `null` durante el movimiento o una fuerza de 0 a 1 enviada una sola vez al soltar Espacio. El servidor solo acepta la solicitud en suelo, conserva el evento ante nuevos paquetes de movimiento y aplica la velocidad cuando termina la recuperación del aterrizaje. Se descarta si vence tras 0.2 segundos o el jugador deja de estar apoyado.

`fire=true` es un evento de soltar la carga, no un disparo continuo. `power` es la fuerza normalizada de 0 a 1. La simulación conserva una solicitud de lanzamiento aunque llegue un paquete de movimiento antes del próximo tick. El servidor aplica su cadencia, calcula la parábola con gravedad y resuelve el primer contacto de la botella. El cliente predice la misma parábola contra la geometría del mapa. Un oponente en movimiento puede interceptarla.

`bottle` acepta las clases standard y heavy. En Eliminación de globos, una botella revienta como máximo un globo y debe alcanzarlo directamente. En Carrera de torre, la pesada empuja en área y la de cristal empuja al acertar de lleno. Cada impacto incluye owner, kind, hits (impactos confirmados) y downs (descalificaciones). El cliente deduplica los impactos por id.

En modo eliminations, cada jugador tiene balloons (máscara de globos intactos), balloonCount y pops. Si se termina la ronda con un primer lugar único, winner contiene el identificador del jugador. En modo race, score contiene la mejor altura de cada equipo, bestHeight la mejor altura de cada participante y winner el índice del equipo que aterrizó primero dentro de la meta. winner es null si hay empate o la partida sigue en curso.

La posición de cada plataforma móvil se deriva de snapshot.time y de su recorrido en shared/arena.json. El servidor aplica el traslado y comprueba impactos con las plataformas en movimiento. El cliente usa ese reloj para dibujar la plataforma y predecir el arco. La pista plana usa flatObstacles del mismo archivo.

El snapshot incluye identificador de partida, reloj, estado, marcador, ganador, humanos, bots, jugadores, proyectiles y eventos. Cada jugador tiene identidad de espacio, nombre, equipo, tipo bot/humano, posición y orientación. health es 100 mientras participa o 0 si se descalificó por quedarse sin globos.

Las muestras incluyen `grounded`, `vy`, `jumpedAt`, `landedAt` e `impactSpeed` para animar el pogo; `lastThrowAt` y `throwCooldown` alimentan el brazo y el HUD. `shots` contiene posición, velocidad y edad de las botellas. `impacts` informa roturas y `events` registra eliminaciones que hacen reaccionar a la audiencia.

`hitAt`, `hitYaw`, `hitForce` y `hitBy` describen el último golpe del jugador. El cliente los usa para mostrar el retroceso, animar la caída y acreditar el botellazo en el aviso de baja.

`{"type":"ping","timestamp":123}` recibe `pong` con el mismo timestamp para calcular RTT en el cliente. El RTT mostrado en pantalla es la última muestra, no p95 ni p99.

Máximo de mensaje: 2048 bytes. Máximo de recepción: 60 mensajes por segundo por conexión, incluidos pings. Código de cierre 1008: token/origen/cupo/cadencia rechazado; 1009: mensaje demasiado grande. Los paquetes inválidos reciben `error`. Un nuevo humano sustituye a un bot; la desconexión devuelve ese espacio a un bot.

`GET /health` informa modo local y participantes. `GET /api/config` devuelve reglas. La identidad de espacio puede reutilizarse tras una desconexión; todavía no hay identidad persistente ni reanudación de sesión.
