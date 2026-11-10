# Funny Universal Cathartic Kingdom

Prototipo local de una arena 3D de esqueletos anatómicos sobre pogos. En el **Auditorio del Último Rebote**, 384 médicos observan desde gradas, escriben en tablas clínicas y reaccionan con aplausos a las eliminaciones. Las botellas de cristal siguen un arco visible que permite calcular cada lanzamiento.

El diseño está definido y la ejecución local se ha probado. El despliegue depende de confirmar proveedor, acceso y cuota. Para continuar, consulta la [guía de traspaso](docs/TRASPASO.md) y el [estado de nube](docs/NUBE.md).

## Ejecutar en Windows

Requisitos: Node.js 22.12 o posterior (probado con 24.14.1), Python 3.14 y un navegador con WebGL. Chrome o Edge son preferibles para capturar el ratón; el navegador incrustado puede restringir esta función.

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server/requirements.txt
npm ci
npm run dev
```

Abrir **http://127.0.0.1:5173/**. Escribir un apodo y pulsar **A rebotar**. Mover el ratón sobre la arena para apuntar. El giro continúa si el cursor llega a un borde lateral. Con **Capturar ratón**, el puntero queda dentro del juego hasta pulsar Esc. Las flechas también sirven para apuntar. Una segunda pestaña puede entrar a la misma partida y cada humano sustituye un bot. La partida comienza al conectar el primer humano.

Los procesos se ejecutan en primer plano. `Ctrl+C` detiene el lanzador. No se necesita activar el entorno virtual ni cambiar la política de ejecución de PowerShell. Si los puertos están ocupados, cerrar el proceso previo antes de volver a ejecutar el comando.

En Linux/macOS, crear `.venv` con `python3.14 -m venv .venv` e instalar con `.venv/bin/python -m pip install -r server/requirements.txt`. Los comandos de npm son los mismos.

| Control | Acción |
| --- | --- |
| WASD | Dirigir el pogo en el aire, en relación con la cámara. En suelo permanece plantado. |
| Mover el ratón o usar las flechas | Girar la cámara y apuntar. |
| 1 / 2 | Elegir botella de cristal o pesada. |
| Clic izquierdo o F, mantener y soltar | Cargar la fuerza y lanzar una botella al soltar |
| Espacio, mantener y soltar | Cargar el pogo y saltar al soltar. Un toque da un salto bajo. |
| Tab sostenido | Ver marcador individual |
| Esc | Liberar ratón; la partida continúa |
| Salir | Desconectarse y volver al inicio |
| Aplausos | Silenciar o reactivar el público |

## Modos y rendimiento

| Modo | Mapa | Cómo se gana |
| --- | --- | --- |
| Eliminación de globos | Pista del instituto, con coberturas bajas | Diez participantes sin equipos. Cada uno empieza con tres globos. Solo un impacto directo revienta un globo. Al perder los tres, quedas fuera hasta la próxima partida. Gana quien conserve más globos al cumplirse tres minutos o sea el último en pie. Se permite empate. Los bots pueden acertar a humanos y solo los humanos pueden reventar globos de bots. |
| Carrera de torre | Torre del instituto, con plataformas suspendidas | Equipos de cinco. El primer participante que aterrice dentro del anillo dorado a 12,3 m gana para su equipo. La botella de cristal empuja al acertar y la pesada empuja en área. Se puede caer y volver a subir. El límite es 3:45 y hay empate si nadie alcanza la meta. |

Mantén Espacio y suelta para saltar. WASD dirige el pogo en el aire. En la torre, las rampas iniciales convergen en el Mirador. El Atajo A y la Cubierta B conducen a la Cima y las plataformas móviles violetas ofrecen cruces adicionales. La botella pesada tiene menos alcance y tarda más en recargarse en ambos modos.

Para reducir carga gráfica, elige **Gráficos → Rendimiento** en el menú. El contador muestra FPS en el menú y en partida. La preferencia se guarda en el navegador.

Los bots completan diez espacios y el servidor decide la posición, los impactos, el tiempo y el ganador. Los resultados se conservan en memoria. Para iniciar otra partida, vuelve al menú con todos los participantes humanos.

El esqueleto anatómico es una adaptación de [Écorché](https://github.com/Charleeh/ecorche) (CC BY-SA 4.0), basado en BodyParts3D y Z-Anatomy. Ver `client/public/models/ATTRIBUTION.md`. Los modelos se sirven desde la misma aplicación. La variante de Rendimiento usa 18 508 triángulos y la de Calidad usa 74 068.

## Comprobar

```powershell
npm test
npm run build
docker compose config --quiet
```

La suite comprueba simulación y WebSocket con dos clientes, validación, capacidad, tokens de un solo uso, globos, empujones, meta y temporizador. El build queda en `client/dist`. La configuración de CI está en `.github/workflows/checks.yml`.

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
