# Funny Universal Cathartic Kingdom

Prototipo local de una arena 3D de esqueletos anatómicos sobre pogos. En el **Auditorio del Último Rebote**, 384 médicos observan desde gradas, escriben en tablas clínicas y reaccionan con aplausos a las eliminaciones. Las botellas de cristal siguen un arco visible que permite calcular cada lanzamiento.

El diseño está definido y la ejecución local se ha probado. El despliegue depende de confirmar proveedor, acceso y cuota. Para continuar, consulta la [guía de traspaso](docs/TRASPASO.md) y el [estado de nube](docs/NUBE.md).

## Ejecutar en Windows

Requisitos: Node.js 22.12 o posterior (probado con 24.14.1), Python 3.14 y un navegador con WebGL. Chrome o Edge son preferibles para capturar el ratón; el navegador incrustado puede restringir esta función.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server/requirements.txt
npm ci
npm run dev
```

Abrir **http://127.0.0.1:5173/**. Escribir un apodo y pulsar **A rebotar**. Mover el ratón sobre la arena para apuntar. El giro continúa si el cursor llega a un borde lateral. Con **Capturar ratón**, el puntero queda dentro del juego hasta pulsar Esc. Las flechas también sirven para apuntar. Una segunda pestaña puede entrar a la misma partida y cada humano sustituye un bot. La partida comienza al conectar el primer humano.

Los procesos se ejecutan en primer plano. `Ctrl+C` detiene el lanzador. No se necesita activar el entorno virtual ni cambiar la política de ejecución de PowerShell. Si los puertos están ocupados, cerrar el proceso previo antes de volver a ejecutar el comando.

En Linux/macOS, crear `.venv` con `python3 -m venv .venv` e instalar con `.venv/bin/python -m pip install -r server/requirements.txt`. Los comandos de npm son los mismos.

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

## Reglas del prototipo

- Dos equipos de cinco, menta y coral. Diez participantes totales, con bots identificados.
- Tres minutos; gana el equipo con más eliminaciones. El empate es válido.
- Saltos manuales con compresión del resorte al cargar, estiramiento al despegar y pausa breve tras el impacto. La barra de salto se llena en unos 0.8 s. Los pies apoyan en estribos separados, con el resorte delante del cuerpo.
- Arena ampliada a 60 × 46, con más separación entre equipos, coberturas laterales y cuatro rutas al mirador. Alinéate con «01 Impulso», carga Espacio, suéltalo y avanza en el aire. Repite para llegar a «02 Relevo» y «03 Mirador».
- Los bots también se desplazan a saltos. Algunos rodean las coberturas y otros encadenan las plataformas para lanzar desde el mirador.
- **Zona de observación** sube de Pista a Relevo, Mirador, Estación y Cima en cinco etapas de 45 segundos. Controlar la Estación da 3 puntos por segundo y la Cima da 4. El **Atajo A** y la **Cubierta B** continúan por plataformas suspendidas. Las tres plataformas móviles, señaladas en violeta, trasladan al jugador cuando aterriza sobre ellas.
- La botella de cristal alcanza más lejos y daña al acertar de lleno. La pesada tiene menos alcance, tarda más en recargarse y puede dañar a varios rivales cerca de la rotura. El arco muestra dónde caerá y el anillo ámbar indica el radio aproximado.
- Botellas de cristal: 28 de daño por impacto directo y 0.9 segundos entre lanzamientos. La pesada empuja a los rivales que sobreviven. El jugador puede corregir su trayectoria en el aire con WASD.
- Reaparición a los tres segundos, con protección inicial de 1.5 segundos.
- El servidor controla posición, impactos, daño, puntuación y reloj. El cliente envía controles, no resultados.
- Los resultados se mantienen en memoria. Para comenzar una nueva partida, todos los humanos deben volver al inicio. Una sala sin humanos se reinicia tras 15 segundos.

El esqueleto anatómico es una adaptación de [Écorché](https://github.com/Charleeh/ecorche) (CC BY-SA 4.0), basado en BodyParts3D y Z-Anatomy. Ver `client/public/models/ATTRIBUTION.md`. El juego carga el modelo local de 1.95 MB y no necesita descargarlo durante la partida.

## Comprobar

```powershell
npm test
npm run build
docker compose config --quiet
```

La suite comprueba simulación y WebSocket con dos clientes, validación, capacidad, tokens de un solo uso, puntuación, reaparición y temporizador. El build queda en `client/dist`. La configuración de CI está en `.github/workflows/checks.yml`; aún no se ha ejecutado en GitHub.

## Docker local

Con Docker Desktop abierto y su motor Linux disponible:

```powershell
docker compose up --build
```

Abrir **http://127.0.0.1:8080/**. Nginx sirve el cliente y enruta `/api` y `/ws` al servidor. Solo el puerto local 8080 se publica. Para detener y retirar estos dos servicios:

```powershell
docker compose down
```

La configuración de Compose fue validada; la construcción y ejecución de imágenes están pendientes porque el motor Docker no estaba activo. Los tags de imágenes base son de series y deben fijarse por digest al preparar el despliegue estable.

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
