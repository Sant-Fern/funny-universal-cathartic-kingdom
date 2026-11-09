# Estado del plan original

Actualizado el 8 de noviembre de 2026. **Fase activa: 0 — Diseño definido; preparación de nube pendiente.** Se sigue la numeración 0 a 9 del plan original. El código previo se conserva como avance preliminar, sujeto a las decisiones y revisiones de cada fase.

Ninguna fase está cerrada por completo. Un archivo preparado, una configuración válida y un servicio desplegado son estados distintos; cada cierre requiere la evidencia del plan.

| Fase original | Estado | Avance existente y requisito de cierre pendiente |
| --- | --- | --- |
| 0. Definición del juego y preparación | **Diseño definido; nube pendiente** | Funny Universal Cathartic Kingdom, auditorio clínico, esqueletos anatómicos, pogo elástico y botellas con arco. Equipos y reglas confirmados. Acceso a nube pendiente según el usuario. Ver `FASE_0.md`. |
| 1. Infraestructura reproducible y automatización | Avance local | Compose, Nginx y el manifiesto privado de Kubernetes comprobados; Terraform de referencia para GCP validado sin backend. Faltan estado remoto, plan con la cuenta real, despliegue y actualización de Fleet por pipeline. |
| 2. Servidor de partida y flota de Agones | Pendiente; avance local | Simulación y WebSocket locales con pruebas. Faltan Agones, SDK, asignación, WSS por sala y ciclo de vida en nube. |
| 3. Bots para completar el cinco contra cinco | Pendiente; avance local | Bots se desplazan a saltos y buscan rutas por las plataformas. Se comprobó que ambos equipos alcanzan el mirador y lanzan desde ahí. Falta evidencia en el entorno final. |
| 4. Resultados y clasificación serverless | Pendiente | Resultados solo en memoria; faltan servicio, persistencia, idempotencia y pruebas de carga. |
| 5. Distribución de video y espectadores simulados | Pendiente | Faltan HLS grabado, Storage/CDN, reproductor, carga y evidencia. |
| 6. Cliente 3D en navegador | Pendiente; avance local | Auditorio con rutas suspendidas hasta la Cima a 12,3 m, tres plataformas móviles, audiencia reactiva, HUD y conexión local. Se observó el mapa ampliado en una partida de navegador. Faltan revisión manual completa y conexión remota en nube desde dos equipos. |
| 7. Autoescalado y observabilidad | Pendiente | Faltan métricas, dashboards, autoscalers y cambios reales de capacidad medidos. |
| 8. Pruebas funcionales y de capacidad | Pendiente; pruebas locales | 33 pruebas de servidor, 9 de cliente y pruebas externas de una sala, incluida la ejecución con Docker. Faltan carga de varias salas y evidencia de capacidad en nube. |
| 9. Entrega, demostración y cierre de recursos | Pendiente | README inicial disponible. Faltan versión estable, informe, presentación, costos y eliminación comprobada. |

## Forma de trabajar

1. Resolver las decisiones y requisitos de la fase activa.
2. Implementar o completar el trabajo autorizado de esa fase.
3. Ejecutar sus comprobaciones, registrar errores y corregirlos.
4. Presentar la evidencia y los pendientes reales para la revisión del usuario.

## Herramientas comprobadas al iniciar

Windows, Node 24.14.1, npm 11.11.0 y Python 3.14.4. Git, Docker y kubectl instalados. Terraform, gcloud y Helm no estaban en PATH. Docker Desktop no tenía activo el motor Linux. Proyecto cloud, facturación, permisos y cuota todavía no comprobados.

## Límites del código existente

Una partida compartida por modo en cada proceso local. La asignación de partidas con Agones, la persistencia, las métricas y el escalado siguen pendientes. Los bots siguen rutas del auditorio y calculan aterrizajes próximos. Los nombres visibles no son cuentas de usuario. El usuario confirmó que el despliegue en nube sigue pendiente.
