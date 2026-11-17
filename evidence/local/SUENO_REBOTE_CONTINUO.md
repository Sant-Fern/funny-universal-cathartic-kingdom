# El Sueño del Último Rebote

Actualización solicitada: mapa surrealista, rebote continuo, retiro de guías de botellas, puntuación solo al final y altura discreta.

El mapa tiene seis zonas: Habitación Imposible, Mesa del Azar, Té sin Gravedad, Archivo del Insomnio, Horas Perdidas y Cielo al Revés. Los 120 apoyos de cada ruta son objetos cotidianos gigantes: camas, mesas, maletas, libros, dominós, naipes, vajilla, cajones, relojes, discos, pianos, puertas y casas invertidas. Sus cuerpos y las patas de mesas comparten dimensiones con la simulación. Se retiró el núcleo de torre. Se usó la [página oficial de Unnamed Pogo Game](https://store.steampowered.com/app/4925300/Unnamed_Pogo_Game/) como referencia de dirección surrealista; la geometría y las texturas se construyeron en el proyecto.

La simulación inicia rebotes sin controles y vuelve a despegar después de cada contacto, con 0,12 segundos de recuperación. Espacio carga una potencia adicional; se puede soltar durante el vuelo y queda preparada para el próximo contacto durante tres segundos. Se consume una sola vez y luego vuelve la potencia normal. Los eliminados, quienes llegaron y las rondas terminadas no siguen rebotando. Los ensayos aislados de lanzamiento pueden desactivar este ciclo con un argumento interno del simulador; las partidas de la aplicación lo usan siempre.

Se eliminaron arco predictivo, punto de caída, vista de alcance y estela de botella. La asistencia cercana y la recarga compartida de dos segundos siguen en la simulación. Carrera muestra solamente la altura actual como texto, sin panel, barra ni mejor altura. Durante la carrera no aparecen puntos en el marcador superior ni en Tab. El resultado final conserva equipo ganador, suma y aportes individuales.

Verificación:

- `npm test`: 75 pruebas de servidor y 17 de cliente pasaron. Se comprobaron ambos modos, subidas completas de las dos rutas, rebote sin teclas, carga durante el vuelo, consumo único, caducidad, aturdimiento, congelación al terminar, recarga, colisiones, puntuación y WebSocket. Las pruebas con sockets se ejecutaron fuera del aislamiento.
- `npm run build` pasó; se conservan las advertencias preexistentes de tamaño del chunk de Babylon y de Starlette/httpx en las pruebas.
- `git diff --check` pasó.
- En navegador se observó rebote sin pulsar teclas, se cargó Espacio y se lanzó con F. El HUD mostró altura actual y recarga, sin puntuación ni guía de botella. Tab mostró participantes sin puntos.
- Se dejó terminar una carrera real de seis minutos: llegaron los nueve bots, ganó Coral con 36 puntos frente a 23 de Menta y el jugador de prueba que no llegó aportó cero. Las llegadas simultáneas compartieron puesto y puntos conforme a las reglas existentes.
- Se observaron los resultados individuales al terminar, se reinició la ronda y se comprobó el HUD limpio otra vez. También cargó la vista de Eliminación y se inspeccionaron los sectores de naipes y té, sin errores de consola observados.
- La vista de escenarios retira los personajes de demostración que no pertenecen al escenario seleccionado, evitando duplicados en la inspección.

Capturas: `mapa-surrealista.jpg`, `hud-sutil-rebote-continuo.jpg` y `puntos-solo-al-final.jpg`. No se certifica rendimiento a partir de estas capturas.
