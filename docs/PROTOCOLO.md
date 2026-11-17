# Protocolo local v0.2

HTTP y WebSocket comparten origen a través del proxy de Vite o Nginx. No hay URL de nube compilada dentro del cliente.

1. `POST /api/join` con `{"name":"Huesitos","mode":"race"}` devuelve token de un solo uso con 30 segundos de vigencia y `websocketPath`. Omitir el modo selecciona `eliminations`. Cada modo tiene su propia sala local. observation se acepta como alias de race al ingresar.
2. Abrir `/ws?token=...`. El servidor valida origen de navegador, vigencia, token y cupo. Las reservas no conectadas también ocupan cupo hasta vencer.
3. Recibir `welcome` con `playerId`, `team` (0 menta, 1 coral o null en globos), yaw inicial y configuración.
4. Enviar `input` a 20 Hz y recibir `snapshot` a 20 Hz. Los renderizados interpolan los dos últimos snapshots.
5. Cuando `status` sea `finished`, mostrar resultados. El cliente puede volver al inicio cerrando la conexión o solicitar un reinicio en la misma sala.

```json
{"type":"input","seq":1,"moveX":0,"moveZ":1,"yaw":0,"pitch":0,"fire":false,"jumpPower":null,"jumpHeld":false,"power":0.6,"bottle":"standard"}
```

`moveX` y `moveZ` van de -1 a 1 en coordenadas de mundo. El servidor normaliza diagonales y aplica el desplazamiento solo durante el salto. `yaw` y `pitch` son radianes. La secuencia debe aumentar. Los controles caducan después de 0.5 segundos sin renovación. No se aceptan coordenadas ni daño decididos por el cliente.

El rebote es automático. `jumpHeld=true` se envía mientras se mantiene Espacio: permite terminar el vuelo y evita el despegue al estar apoyado, conservando la carga en suelo. Al soltar se envían `jumpHeld=false` y `jumpPower` una sola vez. La fuerza se consume al despegar; después vuelve el rebote normal. Una señal sin renovar durante medio segundo cancela jumpHeld para evitar retenciones. `chargingJump` en snapshot confirma apoyo con Espacio mantenido. En vuelo se usa la inclinación del próximo contacto; si se libera apoyado, se conserva la de ese instante. El ángulo máximo es 0,32 radianes y el salto máximo usa 14,2 m/s. No rebotan los eliminados, quienes llegaron ni una partida finalizada.

`fire=true` es un evento de soltar la carga, no un disparo continuo. `power` es la fuerza normalizada de 0 a 1. La simulación conserva una solicitud válida de lanzamiento aunque llegue un paquete de movimiento antes del próximo tick. Ambas botellas comparten una recarga de dos segundos por jugador. Cambiar de tipo no la reinicia; los eventos recibidos durante la espera se descartan sin ponerlos en cola. El servidor calcula la parábola con gravedad y resuelve el primer contacto. No se dibujan predicción, punto de caída, alcance ni estela. Un oponente en movimiento puede interceptar la botella.

`bottle` acepta las clases standard y heavy. En Eliminación de globos, un impacto al cuerpo empuja y aturde. Cada botella revienta como máximo un globo y debe alcanzarlo directamente. En Carrera de torre, la pesada empuja en área y la de cristal empuja al acertar de lleno. Cada impacto incluye owner, kind, hits (impactos confirmados), pops (globos reventados) y downs (descalificaciones). El cliente deduplica los impactos por id.

En modo eliminations, cada jugador tiene balloons (máscara de globos intactos), balloonCount y pops. Si se termina la ronda con un primer lugar único, winner contiene el identificador del jugador. En modo race, score contiene la suma de racePoints de los integrantes de cada equipo. finishPosition y finishTime son null hasta aterrizar dentro de la meta; entonces guardan el puesto global y el tiempo en segundos. Los puestos 1 a 10 reciben los puntos de race.placementPoints (10 a 1); sin llegar se reciben 0. finishName y finishBot conservan la atribución del aporte si después cambia el ocupante del espacio. Llegadas en el mismo tick comparten puesto y puntos y el siguiente puesto salta los lugares ocupados. Quien termina queda fuera de controles, colisiones y combate y puede observar en cámara libre. La ronda continúa hasta que lleguen todos o termine el tiempo. winner indica el equipo con mayor suma, o null si hay empate o la partida sigue en curso. bestHeight conserva la mejor altura individual para indicar avance, sin aportar puntos. raceStep indica el último nivel de aterrizaje por plataforma (−1 en el suelo, 0 en el peldaño de salida) para orientar la guía de saltos.

La posición de cada objeto móvil se deriva de snapshot.time y de shared/arena.json. race.path describe apoyos con altura h explícita y contorno box o ellipse; race.structures agrega pisos grandes, patas y dientes de engranajes. Se espejan para ambas rutas y sus dimensiones sólidas se comparten con el renderizado. race.bounds limita Carrera a 220 × 180 m; Eliminación conserva 72 × 62 m. El progreso se obtiene del step del apoyo tocado, sin deducirlo de la altura, porque hay mesetas y desniveles irregulares.

El snapshot incluye identificador de partida, reloj, estado, marcador, ganador, humanos, bots, jugadores, proyectiles y eventos. Cada jugador tiene identidad de espacio, nombre, equipo, tipo bot/humano, posición y orientación. health es 100 mientras participa o 0 si se descalificó por quedarse sin globos.

Las muestras incluyen `grounded`, `vy`, `jumpedAt`, `landedAt` e `impactSpeed` para animar el pogo; `lastThrowAt` y `throwCooldown` alimentan el brazo y el HUD. `shots` contiene posición, velocidad y edad de las botellas. `impacts` informa roturas y `events` registra eliminaciones que hacen reaccionar a la audiencia.

Los globos comparten el pivote de inclinación del personaje en (0; 0,03; 0,52), con inclinación derivada de leanX/leanZ y orientación yaw. La simulación transforma los mismos centros que el renderizado y comprueba el movimiento del blanco entre ticks; la asistencia y la puntería de bots también usan estos centros. En el HUD de Eliminación solo se muestra pops como un texto discreto.

`jumpSpeed` conserva la velocidad total de despegue durante el vuelo y vuelve a cero al aterrizar. Las colisiones corporales de ambos modos transfieren impulso con la velocidad relativa del contacto y la fuerza del salto. Solo se aplica al iniciar contacto, con velocidad limitada y disipación de 0,45 segundos, sin daño, puntuación ni aturdimiento. El impulso corporal es independiente del empujón de botellas. La separación de cuerpos y los límites siguen activos.

`hitAt`, `hitYaw`, `hitForce` y `hitBy` describen el último golpe por botella. `stunnedUntil` indica cuándo recupera los controles. `moveX` y `moveZ` describen la corrección solicitada. `leanX` y `leanZ` son la inclinación autoritativa del pogo; `launchX` y `launchZ` son las componentes del impulso lateral inicial en m/s. El personaje y los globos usan esta inclinación en suelo y vuelo.

`{"type":"restart"}` abre otra ronda si la conexión es la única en la sala. `restarted` devuelve el nuevo `matchId` y `yaw`, conserva `playerId` y permite reiniciar `seq`. `restartDenied` indica que la sala sigue compartida. Cuando se desconecta el último jugador, la siguiente conexión recibe una ronda nueva.

`{"type":"ping","timestamp":123}` recibe `pong` con el mismo timestamp para calcular RTT en el cliente. El RTT mostrado en pantalla es la última muestra, no p95 ni p99.

Máximo de mensaje: 2048 bytes. Máximo de recepción: 60 mensajes por segundo por conexión, incluidos pings. Código de cierre 1008: token/origen/cupo/cadencia rechazado; 1009: mensaje demasiado grande. Los paquetes inválidos reciben `error`. Un nuevo humano sustituye a un bot; la desconexión devuelve ese espacio a un bot.

`GET /health` informa modo local y participantes. `GET /api/config` devuelve reglas. La identidad de espacio puede reutilizarse tras una desconexión; todavía no hay identidad persistente ni reanudación de sesión.
