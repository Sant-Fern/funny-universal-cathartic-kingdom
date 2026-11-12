# Carrera a la cima · 11 de noviembre de 2026

Se implementó Jardines del Cielo, escenario original exclusivo de Carrera con seis sectores, dos rutas simétricas y plataformas móviles. La geometría de aterrizaje usa los mismos datos compartidos que el servidor. La vista de escenarios incluye el mapa completo y la cima; se empaqueta también para producción.

Cada puesto global recibe de 10 a 1 puntos. El marcador suma los cinco aportes por equipo. La ronda continúa después de la primera llegada y termina al llegar todos o a los seis minutos. Quien no llega aporta cero. El marcador y los resultados muestran puesto, tiempo y aporte individual. Las llegadas simultáneas comparten puesto y puntos; las sumas iguales producen empate. Los participantes que terminan pasan a espectador y dejan de bloquear o intervenir en combate.

Comprobaciones realizadas:

- 54 pruebas del servidor pasaron, incluidas API/WebSocket, reglas de llegada, puntuación de los diez puestos, equipo ganador por suma, empates, agotamiento del tiempo, atribución de aportes y congelación de quienes llegaron. Se ejecutaron fuera del aislamiento porque el entorno bloquea sockets. Se conserva una advertencia de deprecación de Starlette/httpx.
- Ambas rutas se recorrieron completas mediante controles de jugador en simulación; cada ascenso dura al menos dos minutos.
- 16 pruebas del cliente pasaron: resultados por equipo, reloj, física, controles, carga y construcción de geometría del mapa con Babylon NullEngine. Esta última prueba omite dibujo de texturas y no acredita apariencia ni rendimiento en pantalla.
- `npm run build` pasó y produjo index.html y map-review.html. El detalle está en race-build.txt. Sigue la advertencia de tamaño del chunk de Babylon.
- `git diff --check` pasó.

La revisión visual en navegador sigue pendiente. El navegador incrustado agotó su tiempo de inicio; al intentar Chrome, Computer Use detuvo el acceso por no poder verificar la URL con suficiente confianza. No se atribuye ese bloqueo a un fallo del juego. No se certifica apariencia final ni FPS del escenario.

## Actualización: arquitectura escalable, botellas e inclinación

La ruta se rediseñó con 120 aterrizajes por recorrido: terrazas de jardín, acueductos en rectas y esquinas, cornisas y tejados de molinos, muros y capiteles de ruinas, azoteas y escalinatas. Se agregaron 22 conexiones sólidas por ruta entre canales y tejados. Las superficies y conexiones se renderizan con las mismas dimensiones que sus colisiones del servidor. Se retiraron los edificios que antes estaban fuera de la zona jugable. Las pasarelas móviles forman parte del sector de molinos.

Ambas botellas tienen recarga compartida de dos segundos, aplicada en servidor y cliente; cambiar de botella no permite omitirla. Los clics durante la espera no quedan en cola y el HUD muestra la cuenta regresiva.

La inclinación del pogo se integra en suelo con WASD y se conserva al soltar el salto. Divide la fuerza del resorte en velocidad vertical e impulso lateral, mantiene ese impulso aunque se suelten las teclas y lo amortigua durante el vuelo. Inclinarse da más alcance y menos altura; las diagonales no aumentan la energía del resorte. La postura del personaje y del pogo usa el ángulo del servidor.

Verificación de esta actualización:

- `npm test`: 70 pruebas de servidor y 17 de cliente pasaron. Incluyen las dos rutas completas, bots que alcanzan la cima, colisiones de las seis clases de arquitectura, conexiones transitables, coincidencia de geometría entre JavaScript y Python, recarga con ambos tipos de botella y ambos modos, impulso persistente, menor altura al inclinarse y conservación de energía.
- `npm run build` y `git diff --check` pasaron. Se mantienen las advertencias preexistentes de Starlette/httpx y de tamaño del chunk de Babylon.
- La revisión visual que estaba pendiente se pudo realizar en el navegador incrustado: cargó la carrera, se ejecutó un salto combinando W y Espacio y se observó la cuenta regresiva de recarga tras lanzar con F. También se inspeccionaron acueductos y molinos en la vista de escenarios, sin errores de consola observados.
- La captura `carrera-escalable.jpg` muestra los tejados y cornisas de los molinos que integran la ruta. No es una medición de rendimiento.
