# Globos inclinados, HUD discreto y choques

## Cambios

- Personaje, globos y cordeles comparten un apoyo inclinado alrededor del pie del pogo. El grupo de globos también gira con el personaje.
- Los blancos de botellas siguen la misma transformación en el servidor y el renderizado. La detección considera el desplazamiento del globo entre ticks. La asistencia cercana y los bots apuntan a los centros transformados.
- Se retiraron el marco de globos restantes, su número, barra y contenido auxiliar. Eliminación muestra únicamente el contador de globos reventados por el jugador, en texto discreto en la esquina inferior izquierda. Carrera conserva la altura sutil.
- En ambos modos, un contacto corporal nuevo transfiere impulso según velocidad relativa y fuerza del salto. El salto cargado empuja más y recibe menos retroceso que el rebote normal. El impulso corporal tiene límite de velocidad, se disipa en 0,45 segundos y es independiente de las botellas.
- No produce daño ni aturdimiento ni cambia la puntuación. Un contacto sostenido no acumula impulsos. Los eliminados y quienes llegaron a la cima quedan fuera de estas colisiones.

## Verificación

- `npm test`: pasaron 92 pruebas de servidor y 20 de cliente, 112 en total.
- Las nuevas pruebas comparan desplazamiento y velocidad de empujón entre rebote normal y salto cargado en ambos modos, retroceso, persistencia de contacto, cuerpos a distinta altura, límites, expiración del impulso y jugadores fuera de partida.
- Se verificó que una botella alcanza el globo inclinado y falla al apuntar a su antigua posición vertical.
- Se compararon centros entre JavaScript y Python. Una prueba de Babylon con motor nulo comprueba las posiciones reales de los nodos frente a esos centros en distintas inclinaciones, orientaciones y estados de vuelo.
- La prueba anterior que exigía quedarse tocándose después de chocar se actualizó para exigir separación durante cada tick y un impulso en direcciones opuestas.
- Las dos rutas completas de Carrera, puntuación, botellas, rebote automático y conexiones HTTP/WebSocket también pasaron.
- `npm run build` pasó. Se mantiene la advertencia de tamaño del chunk de Babylon y la advertencia de Starlette/httpx en pruebas.
- En navegador se inició Eliminación, se comprobó el contador sin marco y se mantuvieron Espacio + D: el personaje y sus globos acompañaron la inclinación. Se guardó `globos-inclinados-hud-discreto.jpg`.
- No se observaron errores de consola al iniciar la ronda de comprobación. La captura documenta la apariencia y el estado de controles; los empujones se verificaron con la simulación autoritativa.
