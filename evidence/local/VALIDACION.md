# Validación local · 8 de noviembre de 2026

## Comprobado

- `npm test`: **11 pruebas pasaron**, ejecutadas fuera del aislamiento porque el sandbox de Windows bloqueó la creación de sockets. Un warning de Starlette recomienda sustituir httpx por httpx2 en una futura actualización de dependencias de pruebas.
- Ocho pruebas del núcleo: diez espacios equilibrados, reemplazo de bots, normalización de velocidad, caducidad de controles, orden de secuencias, colisiones, daño, reaparición, salto y final de partida. Una simulación de veinte segundos con bots produjo eliminaciones válidas y coordenadas finitas.
- Tres pruebas de API: dos clientes comparten matchId, equipos opuestos, cambio a 2 humanos/8 bots, ping/pong, controles inválidos, tokens de un solo uso, rechazo de origen, validación de apodos y reservas que respetan el cupo.
- `npm run build`: compilación de producción correcta. Cambiar los imports globales de Babylon por imports de módulos redujo el chunk principal de aproximadamente 6 297 kB a 1 055 kB (260 kB gzip). El build conserva una advertencia de chunk superior a 500 kB. La salida completa está en `build.txt`; no es una medición de rendimiento en partida.
- `docker compose config --quiet`: configuración válida. No requiere motor Docker.
- Escena renderizada en navegador incrustado y Chrome. Se observaron esqueletos, pogos, carabinas, corteza, tocones, hongos, marcador, contador y pérdida de vida. No se observaron errores ni warnings en las consultas de consola.
- Ambos navegadores entraron a una misma partida. El HUD mostró **2 humanos y 8 bots** y el marcador avanzó con las eliminaciones de los bots. El RTT mostrado fue de muestras locales; no constituye una medición de percentiles.

## No comprobado o pendiente

- Captura real del ratón, movimiento/apuntado manual y sensación del rebote: la automatización no obtuvo captura durante su prueba y después la herramienta detuvo el control de Windows al no poder verificar la URL de Chrome. No se atribuye ese bloqueo a un fallo del juego. La prueba manual continúa pendiente.
- Se añadió un mensaje visible en el HUD para informar si el navegador rechaza la captura del ratón; esa rama de error no se ha vuelto a probar en navegador tras el bloqueo de la herramienta.
- Resultados finales en navegador y una nueva partida: el temporizador/final están probados en simulación; el recorrido visual completo de tres minutos no quedó certificado.
- Construcción y arranque de Docker: motor Linux no disponible en el momento de la comprobación.
- CI en GitHub, Terraform, GKE, Agones, resultados persistentes, pruebas remotas, escalado y carga: pendientes.

No se adjuntan cifras de rendimiento, capturas guardadas ni evidencia de nube que no se hayan obtenido.

## Actualización de diseño de fase 0

- Nombre confirmado y aplicado al cliente. Los colores menta/coral se conservan por elección técnica delegada por el usuario.
- El usuario confirmó 5 contra 5, tres minutos, victoria por eliminaciones, empate permitido y sustitución de bots por humanos.
- Se sustituyó el árbol hueco por un rancho original con cercas, pacas, establos, molino, praderas y castillo al fondo. La geometría usa primitivas creadas en código; los cinco obstáculos y los límites se derivan de la misma configuración compartida con el servidor.
- `npm run build` pasó tras este cambio. El chunk principal quedó aproximadamente en 1 058 kB (261 kB gzip); persiste el aviso de tamaño superior a 500 kB. `node --check` pasó para `ranch.js` y `world.js`.
- La vista previa respondió HTTP 200 y `/health` informó servidor local sano, cero humanos y diez bots antes de abrir el cliente.
- Se inspeccionó visualmente el nuevo lobby en el navegador incrustado: nombre, rancho y castillo visibles. La consulta de consola devolvió cero errores/warnings. No se volvió a probar captura del ratón ni una partida completa en este cambio visual.
- No se creó infraestructura cloud. El acceso al proveedor está pendiente; ver `docs/NUBE.md`.

## Revisión local del Auditorio del Último Rebote

- El nombre visible es **Funny Universal Cathartic Kingdom**. Se sustituyó el rancho por un auditorio de cuatro gradas con 384 observadores, mesas, mamparas, luces y pantallas de registro.
- Modelo anatómico Écorché adaptado: 262 estructuras, 74 068 triángulos y GLB de 1 945 468 bytes. Créditos y licencia en `client/public/models/ATTRIBUTION.md`.
- Estribos bajo los pies y vástago delante del cuerpo. Rebote con compresión y estiramiento, además de inclinación hacia delante y atrás. El anillo de contacto y los fragmentos se ven durante el juego.
- Balística: se comprobó la concordancia cliente/servidor del origen, velocidad y punto de impacto para muestras de fuerza y ángulo; se validaron cadencia de evento, caída, impacto y oclusión por cobertura.
- Validación final: `npm test` pasó con 15 pruebas Python y 4 JavaScript. `npm run build` y `docker compose config --quiet` también pasaron. El compilador mantiene el aviso de tamaño del archivo principal (846 kB, 212 kB gzip).
- En el navegador se abrió una partida con un humano y nueve bots, se activó cursor libre y se lanzó una botella con **F**. El HUD cambió a «Preparando otra botella», indicando que el servidor aceptó el lanzamiento. Se vio el arco blanco y su punto de caída.
- La pantalla de observación mostró «Eliminación registrada · Aplausos» y los médicos alternaron gestos de aplauso y escritura. El audio sintetizado tiene un botón de silencio; la escucha manual no fue parte de esta comprobación.
- El reloj llegó a 0:00, el resultado mostró **Coral 83, Menta 72** y el botón volvió al inicio. La captura se hizo tras reconectar a una partida local que ya estaba en curso. Esta cifra documenta solo esa prueba, no balance ni capacidad.
- [Captura de partida](auditorio-partida.jpg) y [captura de resultados](auditorio-resultados.jpg). Captura de ratón y carga sostenida con clic siguen para revisión manual; el lanzamiento por teclado se observó.
- La nube continúa pendiente. No se aprovisionaron recursos ni se declararon pruebas de despliegue.

## Corrección de los controles en Chrome

- Se quitó la dependencia de la captura del ratón para apuntar y lanzar. En Chrome, con el cursor libre, un clic en la arena activó «Preparando otra botella» y las flechas giraron la cámara. [Captura tras el giro](controles-chrome.jpg).
- Pasaron siete pruebas de cliente, incluidas tres de ratón para cubrir el arrastre derecho mientras se carga un lanzamiento, el clic corto y la recuperación cuando se pierde la liberación del botón. La compilación de producción pasó. El arrastre con el ratón físico y la captura opcional quedan para revisión manual.

## Rutas de salto cargado en el auditorio

- Pasaron 26 pruebas locales: 19 del servidor y 7 del cliente. Se recorrieron los cuatro accesos en simulación; mantener Espacio permite aterrizar en los tres niveles, mientras que el rebote normal no sube al siguiente. También se comparó el punto de impacto de una botella en el mirador con el que muestra la guía.
- Se comprobó en una partida de navegador que se puede subir avanzando y manteniendo Espacio. [Vista de las plataformas](auditorio-vertical.jpg) y [vista desde el mirador](auditorio-mirador.jpg).
- La compilación de producción pasó; conserva el aviso de tamaño del paquete principal.

## Auditorio ampliado y salto manual

- Arena de 60 × 46 con límites, cámara, gradas y apariciones ajustados. En el navegador se observó la [carga máxima en suelo](auditorio-salto-manual.jpg), el despegue al soltar Espacio, el regreso al suelo y la [subida manual al mirador](auditorio-mirador-manual.jpg).
- Pasaron las 26 pruebas locales y la compilación de producción. La simulación compara alturas con toque corto, carga media y carga completa; comprueba que cada liberación produzca un solo salto y que las cuatro rutas sean alcanzables.

## Movimiento solo a saltos y bots en las plataformas

- Pasaron las 26 pruebas locales y la compilación. Las pruebas comprueban que WASD no desplace al jugador apoyado en el suelo o en una plataforma y que sí lo haga al despegar. Las cuatro rutas al mirador siguen siendo alcanzables.
- En la simulación de combate los nueve bots saltaron repetidamente y ambos equipos llegaron al mirador y lanzaron desde allí. En el navegador se probó mantener W en suelo y llegar a la primera plataforma a saltos mientras los bots ocupaban varios niveles. [Captura de la partida](bots-plataformas.jpg).

## Apuntado directo con el ratón

- El movimiento del ratón sobre la arena gira la cámara y el arco aunque el puntero esté libre. Se observaron ambos cambios en una partida local, junto con el lanzamiento por clic. [Captura del apuntado](apuntado-raton-libre.jpg).
- Pasaron nueve pruebas de cliente. Las pruebas de entrada comprueban el giro con los botones sueltos, durante la carga de una botella, al llegar al borde de la arena y con la captura activada. La compilación de producción pasó.

## Zona de observación, impactos y botella pesada

- En una partida de navegador se comprobó que ambos equipos puntuaban, que el objetivo pasó de Pista sur a Relevo norte y que la botella pesada se seleccionaba con 2, se lanzaba con F y mostraba el radio de rotura. [Zona rotada](zona-de-observacion.jpg) y [lanzamiento](botella-pesada.jpg).
- Pasaron 32 pruebas locales y la compilación. Se verificaron el aislamiento de modos, la puntuación en disputa, el uso de objetivos elevados por los bots y la coincidencia de la trayectoria pesada entre el cliente y el servidor. El daño en área alcanzó a dos rivales y respetó la cobertura y los equipos.

## Iluminación del auditorio y presentación de los impactos

- Se comprobó en una partida de navegador la iluminación de las plataformas, la reacción visual a una baja, la caída del personaje y la reaparición con 100 de vida. [Auditorio iluminado](auditorio-protocolo-07.jpg) y [baja registrada](baja-protocolo-07.jpg).
- Pasaron las 32 pruebas locales y la compilación. La prueba de daño en área también confirma que una baja se atribuye al atacante y que el servidor informa la dirección del golpe.

## Primer tramo de ascenso y empuje de la pesada

- Pasaron 37 pruebas locales. La simulación comprobó que el Atajo A y la Cubierta B llegan a la Cima, que los bots pueden puntuar en los cuatro objetivos y que la Cima vale tres puntos por segundo. También se comprobó que el cristal requiere cuatro impactos y que un defensor puede compensar con WASD el empuje que lo sacaría del borde.
- En el navegador se llegó al Mirador y se revisaron las señales de ambas rutas y el marcador por altura. Se ajustó la cámara para evitar que el esqueleto tape la vista cerca de una pared. [Vista de las rutas](rutas-de-ascenso.jpg).

## Ascenso suspendido y plataformas móviles

- Pasaron 33 pruebas de servidor y 9 de cliente, además de la compilación de producción. Las simulaciones comprobaron las dos rutas fijas a 12,3 m, el transporte en las tres plataformas móviles y el choque de una botella contra una plataforma en movimiento. Las pruebas del cliente comprobaron que el arco permite lanzar bajo una plataforma y se corta si golpea su costado.
- El mapa se abrió en una partida local de navegador con un humano y nueve bots. El marcador inició en 3:45 en el modo Ascenso. [Mapa en partida](plataformas-suspendidas.jpg).

## Prueba externa HTTP y WebSocket

- `loadtest/smoke.py` pasó en una instancia aislada de Vite y Uvicorn. [Ascenso, dos conexiones simuladas](smoke-2.json): 10 muestras de RTT y p95 local de 12,919 ms. [Eliminaciones, diez conexiones simuladas](smoke-10.json): 50 muestras y p95 local de 4,177 ms. Cada corrida duró cinco segundos de medición y confirmó que vuelve un bot al cerrar una conexión.
- `docker compose config --quiet` pasó. El motor Linux de Docker Desktop no estaba activo; la ejecución con Compose y Nginx queda para comprobar. El flujo de GitHub Actions ya incluye esa prueba después del arranque de Compose y guarda su JSON si pasa. No hay ejecución de ese flujo ni evidencia de capacidad en nube.

## Docker de extremo a extremo y Terraform

- Con Docker Engine 29.9.2 se construyeron ambas imágenes, el servidor respondió al healthcheck y Nginx sirvió HTML, HTTP y WebSocket por el mismo origen. La [prueba desde Compose](smoke-compose.json) verificó 1 humano/9 bots, 2 humanos/8 bots y que vuelve un bot al desconectar un cliente. RTT p95 local de 2,173 ms con 10 muestras; es una prueba de integración, no de carga. Se detuvieron los contenedores de prueba y se retiró su red.
- Terraform 1.13.5 instaló el proveedor Google 7.16.0 con `init -backend=false` y `validate` pasó. No se ejecutaron `plan` ni `apply` contra una cuenta. El archivo de bloqueo de proveedores quedó en `infra/gcp/`.
- En kind 0.31.0 con Kubernetes 1.35.0, las dos imágenes locales se cargaron y ambos deployments de `k8s/demo/` llegaron a Ready. El [smoke test por port-forward](smoke-kubernetes.json) pasó por Nginx y verificó el reemplazo de bots; RTT p95 local de 4,962 ms con 10 muestras. Se retiró el clúster desechable. Esto no prueba GKE, HTTPS público, Agones ni escalado.
