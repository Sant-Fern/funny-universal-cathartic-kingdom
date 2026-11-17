# Presentación del integrador: diez minutos

Usar `output/presentations/Presentacion_integrador_AWS.pptx`. El informe de máximo seis páginas está en `output/pdf/Informe_integrador_AWS.pdf`. Ambos se generan con las mediciones preservadas; comprobar los valores finales antes de exponer.

## Distribución del tiempo

| Diapositiva | Tiempo | Qué explicar |
| --- | --- | --- |
| 1. Pogos en AWS | 0:00-0:45 | Nombre, dos modos y alcance del integrador. Aclarar que las seis prácticas se entregan por separado. |
| 2. Arquitectura | 0:45-1:30 | El navegador entra por HTTPS/WSS. El gateway asigna una sala Agones y la conexión llega a ese GameServer. Los resultados terminados pasan por Lambda a DynamoDB. |
| 3. Reproducción y despliegue | 1:30-2:30 | 119 pruebas, imágenes por SHA, ejecución verde de GitHub y revisión del plan. Mostrar que el ciclo aislado eliminó 55 recursos y conservó el juego. |
| 4. Capacidad | 2:30-3:45 | Comparar clientes solicitados y conexiones activas. Leer errores y RTT, además del pico. Explicar qué cambió entre la rampa inicial, el pico y la rampa preparada. |
| 5. Escalado | 3:45-4:45 | FleetAutoscaler crea salas libres, HPA ajusta el gateway y Cluster Autoscaler añade nodos. Los primeros cambios se observan aproximadamente a 75 y 120 s, con resolución de 15 s. |
| 6. Resultados y video | 4:45-5:35 | Escritura IAM e idempotencia. Diez ejecuciones concurrentes de Lambda. Quinientos usuarios virtuales espaciados y quinientos receptores HLS. Declarar el clip sintético y el modelo de buffer. |
| 7. Costo | 5:35-6:25 | Diferenciar precios de lista y cobro cero bajo FREE activo. Los créditos se consumen. El tráfico puede costar más que los nodos. La extrapolación a 20,000 espectadores es matemática. |
| 8. Cierre | 6:25-7:20 | Límites medidos y recomendaciones: SLO, admisión con control de sobrecarga y menor tráfico de estado. Presentar la demostración. |
| Demostración | 7:20-10:00 | Recorrer el juego, la clasificación, el tablero y el despliegue registrado como se indica abajo. |

## Demostración de 2 minutos y 40 segundos

1. **0:00-0:45:** abrir https://d1oif12lvr7c7k.cloudfront.net, entrar a Carrera o Eliminación y mostrar una conexión real. Salir al menú y abrir Clasificación. Las pruebas no contaminan la tabla normal; puede estar vacía si nadie ha terminado una partida real.
2. **0:45-1:35:** abrir Grafana mediante la conexión local indicada en `OPERACION_INTEGRADOR.md`. Elegir el periodo de una prueba de `commands.json` y mostrar estados de GameServer, CCU, nodos y gateway. Los datos de Prometheus duran 24 h; después de ese plazo usar la captura y los JSON exportados. No presentar una captura como datos en vivo.
3. **1:35-2:05:** abrir la ejecución verde de GitHub del informe. Mostrar la prueba pública y el SHA de las imágenes. Abrir el plan en el PR para su revisión.
4. **2:05-2:40:** enseñar el ciclo aislado: `pod-proof.txt`, `destroy.txt`, estado final vacío y lista de clústeres. Terminar con el costo y el alcance pendiente de aceptación del profesor.

Si el profesor exige ver crecer la flota en vivo, preparar antes una carga pequeña de 60 usuarios durante 90 s en este mismo equipo, siguiendo `OPERACION_INTEGRADOR.md`. Iniciar justo antes de mostrar Grafana. El crecimiento de nodos puede tardar más que esta ventana; la prueba grande registrada contiene esa evidencia. No volver a lanzar mil usuarios sin comprobar cuenta, crédito y cuota.

## Respuestas breves para la defensa

- **¿Por qué Kubernetes y Agones?** Cada partida tiene estado en un proceso. Agones administra su disponibilidad y ciclo de vida; replicar un único servidor detrás de un balanceador no separa las salas.
- **¿Mil usuarios significa mil personas jugando con gráficos?** Son clientes de protocolo que envían controles y reciben estado. No se midieron mil navegadores ni FPS.
- **¿Qué representa el tick p99?** Trabajo activo de simulación y preparación del estado, no el RTT completo. Su histograma y la latencia de red son mediciones diferentes.
- **¿Qué falló?** La admisión y el arranque de capacidad rechazaron solicitudes. La primera prueba de clasificación encontró el límite de ráfaga/concurrencia de Lambda. Los CSV preservan esos errores y las repeticiones describen sus cambios.
- **¿Es gratis para siempre?** No. FREE evita cobros al usuario, consume crédito y cierra el acceso al agotarlo o vencer. No cambiar a Paid.
- **¿Qué falta del trabajo escolar?** Revisión humana del PR, aceptación de la adaptación del juego y exposición por el equipo. Las seis prácticas siguen siendo entregas separadas.
