# Funny Universal Cathartic Kingdom

Prototipo local de una arena 3D de esqueletos anatómicos sobre pogos con rebote continuo. En el **Auditorio del Último Rebote**, médicos observan desde gradas y reaccionan a las eliminaciones. Carrera recorre un mundo surrealista de objetos cotidianos gigantes, **El Sueño del Último Rebote**. Las botellas vuelan sin guías de trayectoria.

**Disponible en AWS:** [abrir el juego](https://d1oif12lvr7c7k.cloudfront.net). La versión del ZIP incluye EKS/Agones, clasificación persistente, CI/CD y métricas. Consulta el [integrador y sus evidencias](docs/INTEGRADOR.md), la [guía para entregar y operar](docs/OPERACION_INTEGRADOR.md) y el [guion de diez minutos](docs/GUION_INTEGRADOR.md). Las seis prácticas individuales son entregas separadas.

El entorno consume crédito promocional. El objetivo de cobro USD 0 depende de conservar la cuenta en **Free activo**; no es alojamiento gratuito permanente. Las instrucciones de retiro están en [infra/aws](infra/aws/README.md).

## Ejecutar en Windows

Requisitos: Node.js 22.12 o posterior (probado con 24.14.1), Python 3.14 y un navegador con WebGL. Chrome o Edge son preferibles para capturar el ratón; el navegador incrustado puede restringir esta función.

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server/requirements.txt
npm ci
npm run dev
```

Abrir **http://127.0.0.1:5173/**. Elegir **Jugar**, escribir un apodo, seleccionar modo y pulsar **Comenzar partida**. Hacer clic en la arena para fijar el ratón. Pulsa Esc para liberarlo y haz clic en la arena para volver a fijarlo. Las flechas también sirven para apuntar. Una segunda pestaña puede entrar a la misma partida y cada humano sustituye un bot. La partida comienza al conectar el primer humano.

Los procesos se ejecutan en primer plano. `Ctrl+C` detiene el lanzador. No se necesita activar el entorno virtual ni cambiar la política de ejecución de PowerShell. Si los puertos están ocupados, cerrar el proceso previo antes de volver a ejecutar el comando.

En Linux/macOS, crear `.venv` con `python3.14 -m venv .venv` e instalar con `.venv/bin/python -m pip install -r server/requirements.txt`. Los comandos de npm son los mismos.

| Control | Acción |
| --- | --- |
| WASD | Inclinar el pogo en suelo sin mover el apoyo; esa inclinación impulsa el salto. En el aire, corregir la dirección. |
| Mover el ratón o usar las flechas | Girar la cámara y apuntar. |
| 1 / 2 | Elegir botella de cristal o pesada. |
| Clic izquierdo o F, mantener y soltar | Cargar la fuerza y lanzar una botella al soltar |
| Espacio, mantener y soltar | Mantener el pogo apoyado para cargar; soltar para saltar más fuerte. En vuelo, queda apoyado al aterrizar. Sin Espacio rebota automáticamente. |
| Tab sostenido | Ver participantes. Los puntos de Carrera se muestran únicamente al finalizar. |
| Esc | Liberar ratón; la partida continúa |
| Salir | Desconectarse y volver al inicio |
| Aplausos | Silenciar o reactivar el público |

## Modos y rendimiento

| Modo | Mapa | Cómo se gana |
| --- | --- | --- |
| Eliminación de globos | Sala de examen de 72 × 62 m, con consola central, dos áreas de examen y galerías bajas para flanquear | Diez participantes sin equipos. Cada uno empieza con tres globos. Solo un impacto directo revienta un globo. Al perder los tres, quedas fuera hasta la próxima partida. Gana quien conserve más globos al cumplirse tres minutos o sea el último en pie. Se permite empate. Los bots reparten sus ataques y suelen fallar a propósito si al rival le queda un globo. |
| Carrera a la cima | El Sueño del Último Rebote: 220 × 180 m con escalera de cajones, ajedrez roto, mar de tazas, biblioteca, relojería y barrio invertido; dos rutas simétricas | Equipos de cinco. Del 1.º al 10.º en llegar al anillo dorado a 248 m se reciben 10 a 1 puntos. Gana la suma de los integrantes. La ronda termina al llegar todos o a los 6:00; quien no llega aporta 0. Los puntos aparecen únicamente en el resultado final, con puesto, tiempo y aporte individual. |

El pogo rebota automáticamente. **Mantén Espacio para quedar apoyado y cargar; suelta para despegar más fuerte.** Si lo mantienes en el aire, aterrizas y permaneces cargando. Sin Espacio continúa el rebote normal. El salto máximo ahora alcanza 14,2 m/s. WASD inclina el pogo hasta unos 18 grados: más impulso lateral y menos altura. El impulso persiste aunque sueltes las teclas y se amortigua durante el vuelo. Una señal de Espacio que no se renueva caduca para evitar que el jugador quede retenido.

La distribución cambia físicamente entre zonas: escalera monumental de cajones apoyada en el suelo, mesa de ajedrez de 26 m, tazas y platos elípticos, biblioteca con piso de 80 × 32 m y estanterías, engranajes con dientes sólidos y casas invertidas. Los 120 apoyos de cada ruta tienen coordenadas, tamaños y alturas irregulares. La configuración reproducible se construye con `node scripts/build-dream-course.mjs`. Las colisiones circulares respetan el contorno, sin esquinas invisibles. El anillo señala el siguiente apoyo y algunos objetos se desplazan lateralmente. El escenario usa geometría y texturas originales, con Unnamed Pogo Game como referencia.

Ambas botellas esperan **2 segundos entre lanzamientos**. Cambiar de botella no reinicia la espera; los intentos durante la recarga se descartan. La barra de fuerza vuelve a cero al lanzar y la nueva carga comienza desde cero. La pesada conserva su menor alcance y empuja en área durante Carrera. En Eliminación, solo un impacto sobre el globo lo revienta.

Los globos y sus cordeles acompañan la inclinación y el giro del personaje. Sus zonas de impacto se mueven con ellos. El indicador de Eliminación muestra solamente los globos reventados por el jugador, en texto pequeño y sin marco ni barra de globos restantes.

En ambos modos, chocar transfiere impulso según la velocidad de contacto y la fuerza del salto. Un salto cargado desplaza más al rival y recibe menos retroceso que un rebote normal. El empujón se disipa durante 0,45 segundos, respeta las coberturas y los límites, y no revienta globos ni aturde. Mantener el contacto no acumula impulsos; hace falta separarse y volver a chocar. Los jugadores eliminados o que llegaron a la cima quedan fuera de estas colisiones.

En Carrera, los puntos quedan asegurados al aterrizar en la meta y el jugador pasa a cámara libre para seguir al equipo. Los que ya llegaron dejan de bloquear y recibir empujones. Llegadas en el mismo tick de 50 ms comparten puesto y puntos; el siguiente puesto salta los lugares ocupados. Si las sumas coinciden, hay empate. Durante la partida solo se muestra la altura actual en un texto discreto, sin panel, barra de progreso ni mejor altura. El marcador superior y los puntos de Tab se retiraron; el aporte individual se conserva en el resultado final.

Con `npm run dev` puedes abrir la [vista de escenarios](http://127.0.0.1:5173/map-review.html?section=overview) para inspeccionar el mapa completo, los seis sectores, la cima y la arena sin iniciar partida. También se incluye en el build de producción.

Para reducir carga gráfica, elige **Gráficos → Rendimiento** en el menú. El contador muestra FPS en el menú y en partida. La preferencia se guarda en el navegador.

Las botellas de los jugadores corrigen suavemente su vuelo cuando pasan a menos de 3,2 m de un rival visible que tienen delante. En Eliminación buscan un globo intacto. No se dibujan arco de predicción, punto de caída, alcance de área ni estela de vuelo. Las coberturas pueden detener la botella. Los bots conservan su puntería propia, usan ambas rutas de Carrera y alternan distancias de combate y flanqueos en Eliminación.

Los bots completan diez espacios y el servidor decide la posición, los choques, los impactos, el tiempo y el ganador. Cuando seas el único humano en la sala, puedes pulsar **Reiniciar** para comenzar otra ronda. La sala se reinicia cuando sale el último humano. Si pierdes los tres globos, usa el ratón para mirar, WASD para moverte, E/Q para subir o bajar y Shift para acelerar en cámara libre.

El esqueleto anatómico es una adaptación de [Écorché](https://github.com/Charleeh/ecorche) (CC BY-SA 4.0), basado en BodyParts3D y Z-Anatomy. Ver `client/public/models/ATTRIBUTION.md`. Los modelos se sirven desde la misma aplicación. La variante de Rendimiento usa 18 508 triángulos y la de Calidad usa 74 068.

## Comprobar

```powershell
npm test
npm run build
docker compose config --quiet
```

La suite comprueba simulación y WebSocket con dos clientes, validación, capacidad, tokens de un solo uso, combate, empujones, meta y temporizador. También simula ambas rutas completas, el rebote sin controles, la carga en vuelo, el uso único y caducidad de la carga, inclinación y recarga de botellas. Las pruebas aisladas de lanzamiento y transporte de plataformas pueden desactivar el rebote automático; las partidas reales lo usan siempre. El build queda en `client/dist`. La configuración de CI está en `.github/workflows/checks.yml`.

## Docker local

Con Docker Desktop abierto y su motor Linux disponible:

```powershell
docker compose up --build
```

Abrir **http://127.0.0.1:8080/**. Nginx sirve el cliente y enruta `/api` y `/ws` al servidor. Solo el puerto local 8080 se publica. Para detener y retirar estos dos servicios:

```powershell
docker compose down
```

La configuración y el arranque de Compose se comprobaron con una prueba externa de HTTP y WebSocket. Los tags de imágenes base son de series y deben fijarse por digest al preparar el despliegue estable.

## Estructura y arquitectura

```text
client/       Babylon.js + Vite, escena, HUD y conexión WebSocket
server/       FastAPI, simulación Python a 20 Hz y pruebas
shared/       Dimensiones, obstáculos y reglas compartidas
gateway/      Reserva para asignación de partidas en nube
infra/        Diseño de Terraform para la siguiente fase
k8s/          Reserva para GKE/Agones
serverless/   Reserva para resultados persistentes
loadtest/     Reserva para Locust y pruebas de capacidad
scripts/      Lanzadores multiplataforma
docs/         Diseño, fases y protocolo
evidence/     Resultados reales de validación
```

En local, Vite enruta al servidor en `127.0.0.1:8000`. El proceso mantiene una partida compartida por modo y debe ejecutarse con **un solo worker**. Al mover a Agones se conservará una partida por GameServer; la asignación y el enrutado por sala se implementarán por separado.

El objetivo de 20 Hz es configuración; aún no es una medición de rendimiento. Las pruebas locales no acreditan capacidad de nube, 1 000 usuarios ni escalado.

Consultar `docs/FASES.md` para el estado real, `docs/DISENO.md` para decisiones de diseño y `evidence/local/VALIDACION.md` para las comprobaciones. El plan original se conserva sin marcar tareas como terminadas prematuramente.

Documentación usada: [Babylon.js con Vite](https://doc.babylonjs.com/guidedLearning/usingVite/), [Vite](https://vite.dev/guide/), [pruebas WebSocket de FastAPI](https://fastapi.tiangolo.com/advanced/testing-websockets/).
