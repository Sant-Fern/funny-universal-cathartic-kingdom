# Funny Universal Cathartic Kingdom — guía para continuar

**Estado:** el juego arranca con Docker y admite partidas 5 contra 5 con bots. Se validó Terraform para la infraestructura base de Google Cloud y se probó el manifiesto privado en Kubernetes local. Falta corregir los problemas del juego que queden por reproducir y completar el despliegue real. Consulta la [evidencia local](../evidence/local/VALIDACION.md). Este documento usa el [plan de trabajo](../Plan_de_trabajo_Pogo_Arena_3D.md) y los [requisitos transcritos](REQUISITOS.md); no sustituye la rúbrica original del curso.

## 1. Terminar el juego en Antigravity

1. Clona el repositorio y acuerda con el equipo una revisión base. Conserva el archivo de dependencias, la carpeta `shared/` y los modelos finales que carga el navegador. Usa una rama para tus ajustes y otra para infraestructura.
2. Arranca el juego como indica el [README](../README.md). Reproduce los errores antes de corregirlos: anota navegador, modo, pasos, resultado esperado y resultado observado. Trabaja en `client/src/`, `server/`, `shared/` y los recursos del juego. Si cambias `POST /api/join`, `/ws`, el contenido de los mensajes o los puertos, actualiza el [protocolo](PROTOCOLO.md), los proxies y la prueba externa que dependan de ese cambio.
3. Verifica en Chrome con un ratón físico que la cámara responde con botones sueltos y durante la carga, que se puede lanzar y que el arco coincide con el impacto en paredes y plataformas. Comprueba salto corto y cargado, ambas rutas hasta la cima, traslado en plataformas móviles y que WASD solo desplaza al saltar. Confirma que los bots alcanzan plataformas y que siguen funcionando daño, reaparición, marcador, fin y reinicio.
4. Completa dos partidas desde el navegador: primero con un humano y nueve bots, luego con dos humanos y ocho bots (idealmente dos equipos o dispositivos en el entorno final). Confirma que ambos ven la misma partida y el mismo resultado. Para demostrar la regla de tres minutos del plan, usa **Eliminaciones**; **Ascenso** dura 3:45. Conserva captura o video breve y apunta el commit.

Antes de integrar, ejecuta desde la raíz: `npm test`, `npm run build` y la [prueba Docker](../loadtest/README.md). Esta última valida conexiones y reemplazo de bots; la revisión manual sigue siendo necesaria para ratón, mapa y animación.

## 2. Llevar una versión jugable a la nube

| Paso | Qué hacer | Evidencia para darlo por hecho |
| --- | --- | --- |
| Cuenta y alcance | Confirmar proveedor, facturación, cuota, región y presupuesto. Configurar una alerta de gasto y acordar quién retira los recursos al terminar. El plan usa GCP. Si solo hay Azure, confirmar que la evaluación admite el cambio antes de adaptar Terraform a AKS, ACR y Storage. | Proveedor y alcance acordados. Sin claves ni datos fiscales en el repositorio. |
| Infraestructura | En GCP seguir [infra/README.md](../infra/README.md): crear el bucket de estado, revisar el plan y aprovisionar. La plantilla tiene una red, registro y GKE Standard zonal con pool de nodos. | Plan revisado, backend remoto en uso, clúster accesible. La validación local existente no acredita estos pasos. |
| Primera prueba en el clúster | Construir y publicar ambas imágenes con la etiqueta del commit. Usar el [manifiesto privado](../k8s/README.md) y probar por port-forward. | Dos pods sanos, HTML, WebSocket y JSON del smoke test desde el clúster. Esto demuestra una instancia, no una flota. |
| Partidas reales | Instalar una versión compatible de Agones. Añadir modo servidor de partida con SDK: Ready al arrancar, Health periódico y Shutdown después de guardar el resultado o vencer el plazo de abandono. Crear Fleet, FleetAutoscaler y el gateway de asignación. | Un GameServer pasa de Ready a Allocated y se libera al acabar. Dos salas no comparten jugadores, tokens ni eventos. |
| Acceso público | Configurar HTTPS/WSS. El gateway debe devolver una ruta por sala y hacer que la reserva y la conexión WebSocket lleguen al mismo GameServer; la ubicación puede mantenerse interna. Adaptar la prueba a ese contrato si cambia. | Dos navegadores externos juegan juntos por HTTPS/WSS. La demo actual no tiene una entrada pública. |
| Automatización | Reutilizar los checks existentes. Añadir al pipeline autenticación del proveedor, publicación de imagen por commit y actualización comprobada de Fleet; registrar el digest y conservar una revisión anterior para volver a ella. | Ejecución registrada que actualiza la flota y crea un GameServer con la revisión nueva. |

**Punto crítico:** `server/app.py` guarda las reservas y el estado de la partida en memoria. Subir el número de réplicas del servidor actual detrás de un balanceador no habilita salas múltiples. Primero resuelve la asignación y el enrutado. En el despliegue real, cada GameServer debe operar con una partida identificada y el token debe corresponder a esa sala.

## 3. Cerrar la parte evaluada

- **Métricas y escalado:** mide jugadores concurrentes, RTT p95, latencia de asignación, duración de tick y frecuencia efectiva. En la misma línea de tiempo guarda cambios de réplicas de Fleet y número de nodos. Separa el escalado de partidas, nodos y cualquier capa adicional que pida la rúbrica.
- **Carga:** usa clientes independientes que entren a salas distintas y envíen controles. Empieza bajo y sube por etapas hasta el objetivo aprobado. El plan pide 1 000 conexiones simuladas; diez en una sala local solo demuestran integración. Para HLS grabado, ejecuta una prueba separada con 500 espectadores según el plan y documenta los supuestos de cualquier extrapolación. Si hay que reducir la meta por cuota, registra la aprobación y el resultado real.
- **Resultados:** guarda desde el servidor, con autenticación y una escritura idempotente por `matchId`, en la solución serverless elegida. Comprueba que dos entregas del mismo resultado no duplican la clasificación y que el resultado sobrevive a reiniciar el servidor.
- **Entrega y retiro:** reúne commit, digest, versiones, parámetros, JSON, métricas, capturas y costos reales. Prepara el informe de hasta seis páginas y la demo de diez minutos. Al terminar, sigue el procedimiento de retiro y verifica los recursos residuales.

Si la fecha de entrega impide terminar todo, prioriza en este orden: **juego estable → instancia privada comprobada → dos personas jugando por WSS → asignación y escalado medidos**. Declara qué bloques faltaron. Una sola URL jugable no cubre por sí misma Terraform, escalado, carga, resultados persistentes y video.
