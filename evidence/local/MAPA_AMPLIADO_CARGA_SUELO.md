# Mapa ampliado y carga en el suelo

## Cambios

- Carrera ocupa 220 × 180 m y termina a 248 m. Eliminación conserva sus dimensiones.
- Dos rutas simétricas con 120 apoyos y 101 estructuras adicionales por ruta. Hay 30 apoyos elípticos por ruta, con cuerpos y colisiones curvos.
- Se sustituyó el recorrido circular uniforme por seis disposiciones: escalera de cajones apoyada en el suelo, ajedrez roto, mar de tazas, biblioteca con un piso de 80 × 32 m, relojería con dientes de engranajes sólidos y barrio invertido.
- Las alturas y dimensiones están escritas por apoyo: hay mesetas, subidas irregulares, superficies anchas y desvíos en ambos ejes. El generador reproducible está en `scripts/build-dream-course.mjs`.
- Espacio mantenido impide el despegue al tocar suelo; soltar consume la carga y lanza. Sin Espacio sigue el rebote automático. La velocidad vertical máxima es 14,2 m/s.
- La barra de la botella vuelve a cero después de enviar el lanzamiento, conservando la fuerza seleccionada en ese lanzamiento. También se limpia al perder foco o salir.

## Verificación

- `npm test`: pasaron 80 pruebas de servidor y 18 de cliente (98 en total).
- Se completaron ambas rutas con la simulación autoritativa y controles de salto. Se comprobaron retención con Espacio, despegue al soltar, expiración de señales, geometría renderizada frente a colisiones, contornos elípticos y límites propios de cada modo.
- `npm run build` pasó después de los últimos cambios. Se mantiene la advertencia de tamaño del chunk de Babylon.
- `git diff --check` pasó. Git avisa que normalizará LF a CRLF en el JSON generado.
- En el navegador, se mantuvo Espacio durante 3,5 segundos y se observó el pogo a 0,0 m con “SUELTA PARA DESPEGAR”. Captura: `carga-apoyada.jpg`.
- Se cargó F durante 900 ms y se soltó: apareció la recarga de 1,9 segundos y `#power-fill` quedó con `width: 0%;`. No se observaron errores de consola en esa partida.
- Se inspeccionaron tazas y platos circulares gigantes, relojes y engranajes, barrio invertido y la vista completa de las dos rutas. Capturas nuevas: `mapa-ampliado-tazas.jpg` y `mapa-ampliado-relojeria.jpg`.

Las capturas documentan apariencia y estado de controles, no rendimiento ni la finalización manual de toda la ruta.
