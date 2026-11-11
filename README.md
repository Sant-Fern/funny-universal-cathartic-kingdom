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

Abrir **http://127.0.0.1:5173/**. Escribir un apodo y pulsar **A rebotar** para entrar y fijar el ratón. Pulsa Esc para liberarlo y haz clic en la arena para volver a fijarlo. Las flechas también sirven para apuntar. Una segunda pestaña puede entrar a la misma partida y cada humano sustituye un bot. La partida comienza al conectar el primer humano.

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
| Eliminación de globos | Sala de examen de 72 × 62 m, con consola central, dos áreas de examen y galerías bajas para flanquear | Diez participantes sin equipos. Cada uno empieza con tres globos. Solo un impacto directo revienta un globo. Al perder los tres, quedas fuera hasta la próxima partida. Gana quien conserve más globos al cumplirse tres minutos o sea el último en pie. Se permite empate. Los bots reparten sus ataques y suelen fallar a propósito si al rival le queda un globo. |
| Carrera de torre | Instituto con seis sectores, dos rutas de islas suspendidas y plataformas móviles | Equipos de cinco. El primer participante que aterrice dentro del anillo dorado a 187,55 m gana para su equipo. La botella de cristal empuja al acertar y la pesada empuja en área. Se puede caer y volver a subir. El límite es 6:00 y hay empate si nadie alcanza la meta. |

Mantén Espacio y suelta para saltar. En el suelo, WASD inclina el pogo y marca la dirección del despegue. En el aire sirve para corregir el salto. La torre pasa por Admisión, Archivo Somático, Perfusión, Resonancia, Observatorio y Alta Experimental. El anillo señala el próximo aterrizaje y las plataformas violetas se desplazan sobre uno de dos ejes. La botella pesada tiene menos alcance y tarda más en recargarse en ambos modos. Un impacto directo empuja y aturde brevemente al jugador. En eliminación, solo un impacto sobre el globo lo revienta.

Con `npm run dev` puedes abrir la [vista de escenarios](http://127.0.0.1:5173/map-review.html) para inspeccionar los seis sectores y la arena sin iniciar partida.

Para reducir carga gráfica, elige **Gráficos → Rendimiento** en el menú. El contador muestra FPS en el menú y en partida. La preferencia se guarda en el navegador.

Las botellas de los jugadores corrigen suavemente su vuelo cuando pasan a menos de 3,2 m de un rival visible que tienen delante. Una estela menta señala la corrección. En Eliminación buscan un globo intacto. El arco blanco muestra la trayectoria inicial y las coberturas pueden detener la botella. Los bots conservan su puntería propia, se reparten entre ambas entradas de la torre y alternan distancias de combate y flanqueos en Eliminación.

Los bots completan diez espacios y el servidor decide la posición, los choques, los impactos, el tiempo y el ganador. Cuando seas el único humano en la sala, puedes pulsar **Reiniciar** para comenzar otra ronda. La sala se reinicia cuando sale el último humano. Si pierdes los tres globos, usa el ratón para mirar, WASD para moverte, E/Q para subir o bajar y Shift para acelerar en cámara libre.

El esqueleto anatómico es una adaptación de [Écorché](https://github.com/Charleeh/ecorche) (CC BY-SA 4.0), basado en BodyParts3D y Z-Anatomy. Ver `client/public/models/ATTRIBUTION.md`. Los modelos se sirven desde la misma aplicación. La variante de Rendimiento usa 18 508 triángulos y la de Calidad usa 74 068.

## Comprobar

```powershell
npm test
npm run build
docker compose config --quiet
```

La suite comprueba simulación y WebSocket con dos clientes, validación, capacidad, tokens de un solo uso, combate entre bots, empujones, meta y temporizador. También simula la subida completa por ambas rutas con controles de jugador y verifica que dure al menos dos minutos. El build queda en `client/dist`. La configuración de CI está en `.github/workflows/checks.yml`.

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
