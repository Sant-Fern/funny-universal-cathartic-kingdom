# Requisitos y alcance de las pruebas

Registro de fase 0, 8 de noviembre de 2026. Fuente: plan de trabajo adjunto. Esta transcripción resume las metas del plan; no acredita haber consultado la rúbrica original del curso ni aceptación de reducciones por el profesor.

| Área según el plan | Peso indicado | Evidencia prevista |
| --- | --- | --- |
| Infraestructura como código | 20 % | Terraform, estado remoto, plan revisado y eliminación comprobada |
| Contenedores y orquestación | 20 % | Docker, GKE, Agones, SDK y recursos definidos |
| Autoescalado | 20 % | Cambios reales y medidos en flota, pods y nodos |
| Métricas y carga | 20 % | Jugadores y espectadores simulados, datos de CCU/latencia y conclusiones |
| CI/CD y serverless | 10 % | Pipeline que actualiza Fleet y clasificación persistente probada bajo carga |
| Comunicación | 10 % | Informe de hasta seis páginas con costos y presentación de diez minutos |

## Metas de validación que propone el plan

- Partida de demostración: un humano y nueve bots; repetir con dos humanos y ocho bots.
- Prueba de red: objetivo de 1 000 conexiones humanas simuladas distribuidas entre partidas; los bots internos no cuentan como usuarios de red.
- Video: 500 espectadores simulados de HLS grabado de prueba; extrapolación a 20 000 bajo bitrate y supuestos declarados. La extrapolación no demuestra capacidad medida para 20 000.
- RTT p95 orientativo de 80 ms. Registrar lo medido, aunque no alcance esa meta.
- Medir por separado RTT, asignación de sala, trabajo de tick, frecuencia efectiva y tiempos de reacción de escalado.
- Registrar parámetros, versión, recursos, errores y datos originales. No rellenar métricas con ejemplos.

## Reducciones propuestas, todavía sin aceptar

El plan contempla 300 jugadores y 200 espectadores si la cuota impide la prueba completa, con motivo documentado y aceptación del profesor. No se ha elegido esa reducción ni se asume aceptada. Tampoco se ha acordado reducir capas de escalado u omitir Agones.

## Pendientes de definición externa

Confirmar que estas metas corresponden a la evaluación vigente, quién integra el equipo y la fecha real de entrega/demostración. El horizonte de dos días del documento original es una propuesta del plan, no una fecha de entrega confirmada por el usuario.
