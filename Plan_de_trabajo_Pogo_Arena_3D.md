# Plan de trabajo del juego 3D y su despliegue en la nube

Versión 1 · 8 de noviembre de 2026 · Horizonte de ejecución de dos días

## Objetivo y alcance

Construir una demostración jugable de una arena 3D de cinco contra cinco, con bots para completar los equipos, y desplegarla con la infraestructura evaluada en la Unidad 3. La prioridad es demostrar que podemos crear, publicar, escalar, medir y eliminar el entorno de forma reproducible.

Este documento organiza el trabajo en diez fases y sirve como guía de ejecución. El reporte técnico final tendrá un máximo de seis páginas. El plazo es exigente y depende del tamaño del equipo, el acceso a la nube y la cuota disponible.

## Decisiones de implementación

- Cliente 3D en Babylon.js y JavaScript, accesible desde navegador.

- Servidor Python con WebSocket para ejecutar la simulación y la lógica de cada partida.

- Google Cloud como proveedor principal: GKE Standard, Artifact Registry, Cloud Run, Firestore y Cloud Storage con Cloud CDN.

- Docker para empaquetado; Agones para el ciclo de vida y la asignación de partidas.

- Terraform para infraestructura; GitHub Actions para pruebas, publicación y actualización de la flota.

- Prometheus y Grafana para métricas; Locust para generar conexiones y medir capacidad.

- Un repositorio, una región y un entorno de demostración. Versiones fijadas después de comprobar compatibilidad.

## Juego que vamos a construir

Una arena, un arma y partidas de tres minutos. Movimiento por el plano XZ, altura Y para saltos o rebotes y cámara con perspectiva. El servidor decide daño, muertes, reapariciones y puntuación. La partida termina por tiempo y muestra el resultado.

La temática queda abierta al equipo. Como propuesta visual se puede usar un corral con cerditos sobre resortes y proyectiles de pintura. El nombre provisional es Pogo Arena 3D; elegir nombre y colores en la fase 0 sin cambiar el alcance técnico.

Los personajes se construyen con geometría simple. Tienda, economía, ELO, varias armas, varios mapas, arte detallado, cuentas completas y publicación en Steam quedan para después de la entrega.

<!-- page -->

## Cómo usar este plan

Cada casilla representa trabajo pendiente. Marcarla únicamente cuando exista la evidencia indicada. Asignar un responsable real a cada fase y guardar capturas, datos y resultados conforme se producen. Una captura sin el flujo funcionando no sustituye la comprobación.

Esencial identifica lo que debemos priorizar. Ampliación mejora el alcance o la calificación cuando la base ya funciona. Pospuesto queda fuera de estos dos días. Ninguna reducción garantiza una calificación concreta.

## Requisitos del integrador y decisiones del equipo

| Área | Peso | Evidencia que debemos producir |
| --- | --- | --- |
| Infraestructura como código | 20 % | Terraform, estado remoto, plan revisado y eliminación comprobada |
| Contenedores y orquestación | 20 % | Docker, GKE, Agones, SDK y recursos definidos |
| Autoescalado | 20 % | Cambios medidos en flota, pods y nodos para el nivel excelente |
| Métricas y carga | 20 % | Jugadores y espectadores simulados, curva CCU contra latencia y conclusiones |
| CI/CD y serverless | 10 % | Pipeline que actualiza la flota y clasificación probada bajo carga |
| Comunicación | 10 % | Reporte con costos y presentación de diez minutos |

La rúbrica admite alcance parcial: una capa de escalado se describe como suficiente; Kubernetes sin Agones también tiene un nivel parcial. Nuestra meta es conservar Agones y demostrar primero el escalado de flota y nodos. La tercera capa se trabaja después y se declara si queda pendiente.

## Arquitectura de trabajo

Navegador con cliente 3D → entrada HTTPS y WebSocket seguro → servidor de partida asignado en GKE y Agones.

Servicio de acceso a salas → asignación de GameServer → entrega de identificador y token de sala al cliente. La ruta de WebSocket mantiene cada conexión en su partida; no se reparten mensajes de una misma sala entre servidores distintos.

Servidor de partida → servicio de resultados en Cloud Run → Firestore. Prometheus lee métricas del servidor y Agones; Grafana las muestra. Locust genera jugadores y espectadores desde la misma región.

Video HLS de prueba → Cloud Storage y Cloud CDN → espectadores simulados. La prueba de video grabado se identifica como tal y se separa de una transmisión en vivo.

<!-- page -->

## Fase 0 Definición del juego y preparación

**Objetivo.** Cerrar las decisiones necesarias para programar y desplegar sin dedicar tiempo a funciones secundarias.

**Responsable sugerido.** Coordinación del equipo. Se realiza al inicio; duración orientativa de una hora.

### Tareas esenciales

- [ ] Elegir nombre, temática, dos colores de equipo y una referencia visual sencilla.

- [ ] Confirmar reglas: cinco contra cinco, tres minutos, gana quien consiga más eliminaciones; empate permitido.

- [ ] Fijar controles: WASD, cámara con ratón, disparo y salto o rebote. Mantener una sola mecánica de pogo.

- [ ] Definir diez espacios por partida. Los bots ocupan los espacios sin humanos; reemplazarlos al entrar humanos si aún se permite el ingreso.

- [ ] Preparar una arena con suelo, límites y pocos obstáculos; evitar plataformas complejas y física de cuerpos articulados.

- [ ] Confirmar proyecto de Google Cloud, facturación, permisos, región y cuota antes de empezar a crear el clúster.

- [ ] Asignar responsables de juego, nube y pruebas. Si hay una cuarta persona, asignar documentación y evidencia.

- [ ] Crear un repositorio con carpetas client, server, gateway, infra, k8s, serverless, loadtest, docs y evidence.

- [ ] Registrar los requisitos del integrador, el alcance de las pruebas y las reducciones que necesiten aceptación del profesor.

### Evidencia y criterio de cierre

Guardar en docs el diseño de una página, los controles, las reglas y la asignación de tareas. La fase termina cuando el equipo comparte el mismo alcance y el acceso a la nube está comprobado.

<!-- page -->

## Fase 1 Infraestructura reproducible y automatización

**Objetivo.** Crear la base de nube con Terraform y preparar un pipeline que llegue hasta la actualización de la flota.

**Responsable sugerido.** Nube e infraestructura. Comienza después de la fase 0 y avanza junto con el servidor mínimo de la fase 2.

### Tareas esenciales

- [ ] Instalar o comprobar Git, Python, Docker o un constructor remoto, gcloud, kubectl, Helm y Terraform.

- [ ] Habilitar las APIs necesarias y fijar región, nombres y etiquetas del proyecto.

- [ ] Preparar el bucket del estado remoto de Terraform. Documentar el paso inicial para crearlo y protegerlo frente a eliminación accidental.

- [ ] Definir en infra la red, reglas de acceso, GKE Standard, node pool con escalado, Artifact Registry y cuentas de servicio. Incorporar Cloud Run, almacenamiento y CDN al completar sus fases.

- [ ] Crear GKE y después instalar Agones. Separar la creación del clúster y las instalaciones Helm si los proveedores necesitan un clúster ya disponible.

- [ ] Ejecutar formato, validación y plan de Terraform; revisar el plan antes de aplicar y conservar su salida sin secretos.

- [ ] Configurar GitHub Actions para ejecutar pruebas, construir una imagen con etiqueta del commit, publicarla y actualizar la imagen de la Fleet.

- [ ] Usar identidad federada si está disponible. Guardar cualquier credencial necesaria como secreto; nunca dentro del repositorio ni del cliente.

- [ ] Configurar presupuesto, límites de escalado y procedimiento de eliminación. La alerta de presupuesto avisa; no detiene automáticamente el gasto.

### Evidencia y criterio de cierre

Conservar infra versionada, plan revisado, clúster accesible y una ejecución del pipeline. La fase se cierra por completo cuando un cambio en main produce una nueva imagen y actualiza la Fleet. Construir y publicar solamente deja pendiente el despliegue.

<!-- page -->

## Fase 2 Servidor de partida y flota de Agones

**Objetivo.** Ejecutar una partida por GameServer con hasta diez humanos y bots, con un ciclo de vida correcto.

**Responsable sugerido.** Backend y nube. Primero se prueba un servidor mínimo y después se incorpora la lógica de la partida.

### Tareas esenciales

- [ ] Crear server.py, el archivo de dependencias, las pruebas y el Dockerfile. Implementar en el servidor la simulación y la distribución del estado del juego.

- [ ] Definir mensajes de ingreso, input, snapshot, disparo, resultado y ping. Incluir identificador de jugador, secuencia y coordenadas x, y, z.

- [ ] Ejecutar un bucle objetivo de 20 ticks por segundo; medir trabajo por tick y frecuencia efectiva por separado.

- [ ] Calcular movimiento, rebote, colisiones simples, vida, daño, reaparición y marcador. Validar velocidad, cadencia y tamaño de mensajes.

- [ ] Implementar asignación de equipo y límite de diez espacios; rechazar un undécimo participante y tokens de sala inválidos.

- [ ] Crear la imagen Docker y la Fleet con puerto TCP para WebSocket, requests, limits y puerto interno de métricas.

- [ ] Integrar Ready, Health y Shutdown del SDK. Registrar fallos del SDK en nube para detectarlos; permitir un modo local explícito.

- [ ] Asignar partidas mediante GameServerAllocation. Un servicio de acceso reserva una sala y entrega un token; los certificados del allocator permanecen en el backend.

- [ ] Configurar una entrada HTTPS y WSS con ruta por sala hacia el GameServer asignado. Probar esta conexión antes de pulir el cliente.

- [ ] Terminar por temporizador y liberar el servidor después de guardar resultados. Cancelar salas abandonadas tras un plazo breve aunque sigan existiendo bots.

### Evidencia y criterio de cierre

Mostrar un GameServer Ready, su paso a Allocated, dos clientes compartiendo estado y su eliminación al acabar. Guardar logs y versión de imagen. Comprobar que otra sala no recibe los mensajes de la primera.

<!-- page -->

## Fase 3 Bots para completar el cinco contra cinco

**Objetivo.** Permitir una demostración con pocos humanos manteniendo diez participantes en la arena.

**Responsable sugerido.** Juego y backend. Depende del movimiento y combate de la fase 2.

### Tareas esenciales

- [ ] Crear bots dentro del servidor, usando el mismo sistema de movimiento, daño y reaparición que los humanos.

- [ ] Implementar cuatro comportamientos: buscar rival, acercarse, disparar y esperar reaparición.

- [ ] Seleccionar al rival más cercano, mantener distancia mínima y variar levemente la dirección para evitar bloqueos.

- [ ] Usar reacción y precisión limitadas, además de la misma cadencia de disparo de los humanos.

- [ ] Ejecutar decisiones de bot a una frecuencia menor que la simulación, por ejemplo 5 Hz. Ajustarla después de medir el trabajo por tick.

- [ ] Completar equipos de cinco y marcar visualmente a los bots. No contarlos como conexiones humanas ni como usuarios de Locust.

- [ ] Permitir jugar con un humano y nueve bots, y con dos humanos y ocho bots.

- [ ] Preparar un modo de prueba de carga en el que los clientes simulados ocupen los espacios. Registrar si hay bots activos para comparar cargas equivalentes.

- [ ] Verificar que la partida termina aunque todos los humanos se desconecten y queden bots.

### Evidencia y criterio de cierre

Grabar una partida con equipos completos, bots que se mueven y atacan, y un ganador calculado por el servidor. Comprobar que el número de humanos conectados se informa por separado del número de bots.

Los bots usan reglas de comportamiento y se ejecutan en CPU dentro del servidor de partida.

<!-- page -->

## Fase 4 Resultados y clasificación serverless

**Objetivo.** Guardar resultados fuera de la memoria de la partida y demostrar un servicio serverless funcionando bajo carga.

**Responsable sugerido.** Backend. Implementar el servicio con Flask en Cloud Run y persistencia en Firestore.

### Tareas esenciales

- [ ] Crear un servicio separado en serverless con POST /score o /results, GET /top y GET /health.

- [ ] Crear Firestore y una cuenta de servicio con los permisos necesarios para ese servicio.

- [ ] Definir el resultado: matchId, jugadores, equipo, eliminaciones, muertes, ganador y duración.

- [ ] Enviar el resultado desde el servidor de partida al terminar. El navegador consulta la clasificación; no decide ni publica puntos arbitrarios.

- [ ] Guardar matchId como clave y procesar cada partida una sola vez mediante una operación transaccional o mecanismo equivalente.

- [ ] Hacer reintentos acotados si falla el guardado. Mostrar el fallo y registrar el resultado pendiente; no afirmar entrega garantizada sin una cola duradera.

- [ ] Desplegar el servicio en Cloud Run y configurar la lectura de la clasificación desde el cliente.

- [ ] Proteger la escritura con identidad del servidor y separar la consulta pública. Mantener credenciales fuera del juego descargado.

- [ ] Probar lecturas y escrituras con Locust; registrar latencias, errores e instancias observadas.

- [ ] Reiniciar o reemplazar el servidor de partida y verificar que la clasificación continúa disponible.

### Evidencia y criterio de cierre

Conservar URL de consulta, capturas de Firestore, resultado de una partida y datos de carga del servicio. Enviar dos veces el mismo matchId y comprobar que los puntos no se duplican.

El apodo funciona como nombre visible; la sesión usa un identificador asignado por el servidor.

<!-- page -->

## Fase 5 Distribución de video y espectadores simulados

**Objetivo.** Medir distribución de video mediante CDN y cumplir la parte de espectadores sin construir una plataforma completa de transmisión.

**Responsable sugerido.** Nube y pruebas. El video de prueba puede prepararse antes de que el juego esté terminado.

### Tareas esenciales

- [ ] Generar un video de prueba de cinco minutos y convertirlo a HLS, con segmentos de dos segundos y perfil de 360p cercano a 800 kbps.

- [ ] Usar después una captura del juego si está disponible. Identificar siempre el contenido como video grabado de prueba.

- [ ] Publicar el manifiesto y segmentos en Cloud Storage con Cloud CDN delante y reglas de acceso adecuadas.

- [ ] Incluir estos recursos en Terraform y comprobar su eliminación al terminar.

- [ ] Crear una página de reproducción sencilla o comprobar el manifiesto con un reproductor compatible.

- [ ] Configurar Locust para descargar segmentos con cadencia de reproducción, controlar códigos de respuesta y validar que el contenido existe.

- [ ] Ejecutar la prueba objetivo de 500 espectadores; medir errores, tiempos de descarga y volumen transferido.

- [ ] Marcar como aproximación el indicador basado en descargas que tardan más de dos segundos. No presentarlo como una medición completa del rebuffering de reproductores reales.

- [ ] Extrapolar a 20 000 espectadores con el bitrate declarado, separando tráfico calculado y tráfico realmente medido.

### Evidencia y criterio de cierre

Guardar manifiesto accesible, captura de reproducción, CSV de Locust, parámetros y estimación de salida de datos. A 500 espectadores y 800 kbps durante cinco minutos, el volumen teórico es aproximadamente 15 GB, sin contar sobrecarga ni caché.

<!-- page -->

## Fase 6 Cliente 3D en navegador

**Objetivo.** Construir la interfaz 3D jugable en navegador y conectarla a la flota en la nube.

**Responsable sugerido.** Cliente y diseño. Comienza con una escena mínima en paralelo con la infraestructura.

### Tareas esenciales

- [ ] Crear el cliente con Babylon.js y un sistema sencillo de construcción como Vite. Fijar dependencias y guardar su archivo de bloqueo.

- [ ] Dibujar suelo, límites, obstáculos, luces y cámara con perspectiva. Usar volumen real y posiciones x, y, z.

- [ ] Crear personaje y pogo con cápsulas, esferas y cilindros. Aplicar colores por equipo y nombres visibles.

- [ ] Implementar controles, cámara y representación del rebote. Compartir dimensiones y límites del mapa con el servidor.

- [ ] Crear cuatro pantallas: entrada con apodo, sala, partida y resultados. Mostrar controles antes de empezar.

- [ ] Solicitar sala al servicio de acceso y conectarse por WSS usando el token recibido. Mostrar errores de conexión y sala llena.

- [ ] Enviar controles a 20 Hz y dibujar snapshots con interpolación sencilla. El servidor decide impactos, vida, puntuación y final.

- [ ] Mostrar vida, marcador, tiempo restante y estado de conexión. Mantener sonidos y efectos al mínimo.

- [ ] Publicar la versión compilada en el alojamiento HTTPS elegido; guardar URL, configuración y versión junto al despliegue.

- [ ] Probar dos navegadores en computadoras distintas. Confirmar movimiento, disparos y marcador compartidos.

### Evidencia y criterio de cierre

Abrir la URL desde otra computadora y completar una partida con un humano y nueve bots. Repetir con dos humanos. Verificar que la demostración usa servidores de nube y no una dirección local guardada en el cliente.

<!-- page -->

## Fase 7 Autoescalado y observabilidad

**Objetivo.** Mostrar con datos cómo cambia la capacidad cuando se asignan más partidas y distinguir las tres capas de escalado.

**Responsable sugerido.** Nube y pruebas. Preparar métricas antes de ejecutar carga grande.

### Tareas esenciales

- [ ] Instalar Prometheus y Grafana. Aplicar PodMonitor y habilitar la lectura de métricas de Agones.

- [ ] Exponer humanos conectados, bots activos, duración del trabajo de tick y frecuencia efectiva. Mantener métricas con significado y unidades explícitos.

- [ ] Crear paneles de CCU, tick p99, servidores Ready y Allocated, nodos y errores. Obtener RTT p95 desde los pings de clientes de Locust.

- [ ] Configurar FleetAutoscaler con buffer de 20 % y límites que quepan en la cuota y el presupuesto.

- [ ] Configurar Cluster Autoscaler en el node pool. Solicitudes de CPU y memoria deben reflejar mediciones; no reducirlas artificialmente para aparentar capacidad.

- [ ] Demostrar primero crecimiento de flota y luego crecimiento de nodos por falta de espacio. Registrar tiempos de ambos eventos por separado.

- [ ] Verificar que el cierre de partidas libera GameServers y permite reducir capacidad sin interrumpir partidas activas.

### Ampliación para cubrir las tres capas

- [ ] Aplicar HPA a un Deployment sin estado, como la API de acceso a salas, con requests y métricas disponibles. Su estado compartido no debe depender de la memoria de una réplica.

- [ ] Generar carga que provoque un cambio real de réplicas y registrarlo. Cloud Run escalando la clasificación es otra demostración, pero no sustituye automáticamente el criterio de pods de la rúbrica.

### Evidencia y criterio de cierre

Guardar dashboard exportado y línea de tiempo de carga, flota, pods y nodos. Si solo una capa cambia, declarar alcance parcial. No presentar una configuración de autoscaling como prueba de que efectivamente escaló.

Con 1 000 conexiones y diez por partida hay 100 servidores asignados. Un buffer del 20 % del total requiere aproximadamente 125 GameServers. Con 300 conexiones serían aproximadamente 38. Sumar recursos de Agones, monitoreo y demás servicios al dimensionar.

<!-- page -->

## Fase 8 Pruebas funcionales y de capacidad

**Objetivo.** Comprobar el flujo completo y producir resultados repetibles sin confundir bots del juego con carga de red.

**Responsable sugerido.** Pruebas. Ejecutar Locust en la misma región; registrar también recursos del generador para detectar su propio límite.

### Tareas esenciales

- [ ] Probar movimiento válido, disparo con cadencia, vida, reaparición, equilibrio de equipos, empate, ganador y guardado de resultados.

- [ ] Probar sala llena, token inválido, mensajes malformados, desconexión y fin de partida sin humanos.

- [ ] Crear clientes Locust que pidan una partida, abran WebSocket, envíen inputs y respondan o midan ping. Cada usuario simulado debe ser una conexión real.

- [ ] Controlar la asignación para distribuir diez conexiones por GameServer. En modo distribuido, coordinar salas entre workers y evitar reservas duplicadas o huecos sin registrar.

- [ ] Hacer primero pruebas pequeñas de 10 y 50 conexiones. Comprobar CPU, memoria, asignaciones y métricas antes de escalar.

- [ ] Ejecutar una rampa hasta 1 000 jugadores a dos ingresos por segundo durante veinte minutos y una prueba de pico con 1 000 ingresos en veinte segundos, observada durante diez minutos.

- [ ] Ejecutar 500 espectadores durante cinco minutos contra la CDN y carga de consulta y escritura en la clasificación.

- [ ] Guardar CSV y construir curva CCU contra RTT p95, evolución de flota y nodos, errores y descarga de segmentos. Separar tipos de petición al calcular percentiles.

- [ ] Medir tiempos de reacción y señalar el primer límite observado. Si no se alcanza degradación, informar capacidad validada hasta la carga probada, sin inventar un máximo.

### Alternativa por cuota limitada

Si la cuota disponible impide la prueba completa, proponer una prueba reducida de 300 jugadores y 200 espectadores. Registrar el motivo y confirmar su aceptación para el integrador. La meta de entrega es de 1 000 jugadores y 500 espectadores; la reducción se declara como alcance parcial.

### Evidencia y criterio de cierre

Conservar fecha, commit, infraestructura, configuración de bots, carga, duración, errores y archivos originales. La meta orientativa de RTT p95 es 80 ms; reportar el valor medido aunque no se alcance. No mezclar latencias del allocator con RTT del juego.

<!-- page -->

## Fase 9 Entrega demostración y cierre de recursos

**Objetivo.** Entregar un proyecto reproducible con evidencia y explicar qué se implementó, qué capacidad se midió y cuánto cuesta.

**Responsable sugerido.** Coordinación y documentación, con revisión de todo el equipo.

### Tareas esenciales

- [ ] Corregir fallos que impidan abrir el juego, entrar, terminar una partida, registrar resultados o repetir la demostración.

- [ ] Fijar una versión estable y documentar cómo volver a la imagen anterior. Probar actualización con una partida Allocated y comprobar que termina normalmente.

- [ ] Completar README con requisitos, instalación, variables, despliegue, pruebas, URLs y procedimiento de eliminación.

- [ ] Verificar las carpetas infra, server, k8s, serverless y loadtest requeridas por el integrador; añadir client, gateway, docs y evidence.

- [ ] Redactar el reporte de máximo seis páginas: arquitectura; despliegue; metodología; resultados y escalado; costos; conclusiones y límites.

- [ ] Estimar costo por hora incluyendo nodos, control del clúster, balanceadores, almacenamiento, CDN, base de datos y generador de carga. Usar tarifas vigentes y dejar fecha y supuestos.

- [ ] Calcular costo por jugador hora usando el costo del intervalo dividido entre las horas de conexión acumuladas de ese mismo intervalo. Separar pruebas de video y costos fijos.

- [ ] Preparar una presentación de diez minutos y ensayar la entrada al juego, clasificación y demostración de autoescalado.

- [ ] Grabar un respaldo de la demostración e identificarlo como grabación si se utiliza.

- [ ] Exportar evidencia antes de eliminar recursos. Ejecutar Terraform destroy cuando termine la demostración y comprobar recursos residuales y facturación.

### Evidencia y criterio de cierre

Repositorio accesible, pipeline verde, juego demostrable, dashboard, CSV, reporte, presentación y registro de eliminación. Si el entorno debe seguir disponible hasta la evaluación, dejar responsable y momento de apagado acordados.

<!-- page -->

## Cronograma para dos días

El orden de ejecución se ajusta a las dependencias entre fases. Los bloques son una propuesta para un equipo de tres o cuatro personas; no son una promesa de duración ni equivalen a horas por persona.

| Bloque | Infraestructura y backend | Cliente 3D | Pruebas y documentación |
| --- | --- | --- | --- |
| Día 1 horas 0 a 1 | Fase 0 y acceso a nube | Alcance y temática | Requisitos y responsables |
| Día 1 horas 1 a 4 | Terraform y servidor mínimo | Escena, cámara y personaje | Repositorio y pruebas pequeñas |
| Día 1 horas 4 a 7 | GKE, Agones y conexión WSS | Movimiento y conexión | Evidencia de asignación |
| Día 1 horas 7 a 10 | Lógica de partida y pipeline | Combate y HUD | Prueba desde dos equipos |
| Día 2 horas 0 a 3 | Bots y resultados serverless | Resultados y ajustes | HLS y CDN de prueba |
| Día 2 horas 3 a 6 | Monitoreo y autoescalado | Correcciones de integración | Rampa, pico y espectadores |
| Día 2 horas 6 a 8 | Revisión de despliegue | Congelar versión estable | Gráficas y costos |
| Día 2 horas 8 a 10 | Resolver bloqueos | Ensayar partida | Reporte y presentación |

### Hitos que debemos comprobar

- [ ] Al inicio: acceso y cuota cloud disponibles. Si falla, resolverlo antes de invertir tiempo en gráficos.

- [ ] Durante el primer día: cliente conectado a un GameServer de nube por la ruta pública.

- [ ] Al cerrar el primer día: dos clientes comparten una partida mínima; pipeline publica y actualiza la Fleet.

- [ ] Durante el segundo día: partida con bots, clasificación persistente, métricas y al menos una capa de escalado comprobada.

- [ ] Antes de entregar: pruebas con datos guardados, reporte y demostración ensayada.

Si se acumula retraso, quitar primero efectos y pulido, después funciones adicionales y entrenamiento de bots. Conservar Terraform, contenerización, orquestación y evidencia de carga. Cualquier reducción de pruebas o capas de escalado debe quedar declarada.

<!-- page -->

## Lista de entrega y registro de pendientes

### Verificación final

- [ ] Juego realmente 3D en navegador y cinco contra cinco con bots identificados.

- [ ] URL y conexión a partidas en nube comprobadas desde otra computadora.

- [ ] Terraform crea lo principal, usa estado remoto y permite eliminar el entorno.

- [ ] Fleet de Agones sana, asignación real y llamadas al SDK verificadas.

- [ ] Pipeline prueba, publica imagen y actualiza la flota.

- [ ] Clasificación serverless persistente y probada bajo carga.

- [ ] Dashboard con CCU, tick p99, GameServers por estado y nodos.

- [ ] Evidencia de cada capa que realmente escaló, con tiempos de reacción.

- [ ] Rampa y pico de jugadores, espectadores y extrapolación documentados.

- [ ] Reporte de hasta seis páginas y presentación de diez minutos.

- [ ] Costos, límites y diferencias frente a la meta declarados.

- [ ] Evidencia exportada y procedimiento de eliminación probado.

### Registro para completar por el equipo

| Decisión o pendiente | Responsable | Estado |
| --- | --- | --- |
| Nombre y temática definitivos | Por asignar | Pendiente |
| Proyecto, región, permisos y cuota | Por asignar | Pendiente |
| Alojamiento del cliente y entrada HTTPS y WSS | Por asignar | Pendiente |
| Recursos iniciales y máximos de la prueba | Por asignar | Pendiente |
| Confirmación del alcance de pruebas y reducciones | Por asignar | Pendiente |
| Horario de demostración y eliminación | Por asignar | Pendiente |

### Tratamiento de resultados

No rellenar métricas con valores de ejemplo. Conservar el resultado real, incluso cuando muestre errores o menor capacidad. Una extrapolación estima tráfico o costo bajo supuestos; no certifica capacidad real para 20 000 espectadores.

La partida de demostración puede tener un humano y nueve bots. Para validar 1 000 jugadores concurrentes, deben existir 1 000 conexiones de prueba distribuidas entre partidas, independientemente del número de bots internos.

<!-- page -->

## Referencias técnicas

### Documentación técnica

- Babylon.js Specifications: https://www.babylonjs.com/specifications/

- Agones Fleet Autoscaler: https://agones.dev/site/docs/reference/fleetautoscaler/

- Agones Fleet Updates: https://agones.dev/site/docs/guides/fleet-updates/

- Agones Client SDKs: https://agones.dev/site/docs/guides/client-sdks/

- GKE Cluster Autoscaler: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/cluster-autoscaler

- Firestore Server Client Libraries: https://firebase.google.com/docs/firestore/quickstart-server

### Comprobaciones técnicas de implementación

Fijar versiones compatibles de las herramientas y dependencias. Comprobar su funcionamiento con un despliegue pequeño antes de ampliar la infraestructura.

Agones mantiene un buffer porcentual sobre el total de la flota. Usar ceil(partidas asignadas / 0.8) para un buffer del 20 %, y sumar monitoreo y componentes de control al calcular recursos.

La actualización de una Fleet conserva los GameServers Allocated hasta que el servidor solicita su cierre. Verificarlo con una partida real; borrar el clúster o un recurso a la fuerza sí puede interrumpirla.

La latencia de ping, el tiempo de asignación y la duración del tick miden fenómenos distintos. Presentarlos por separado. Un dashboard correcto y una prueba repetible tienen más valor para la entrega que una cifra sin datos de origen.
