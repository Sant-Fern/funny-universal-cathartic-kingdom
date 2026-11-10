# Diseño de la primera versión

Fecha: 8 de noviembre de 2026. Proyecto construido por fases con revisión del usuario. Este archivo recoge decisiones de la conversación; el plan adjunto es una referencia, no una autorización independiente para desplegar ni generar gastos.

## Decisiones confirmadas

- Nombre: **Funny Universal Cathartic Kingdom**, escrito completo y con Kingdom en mayúscula inicial.
- Personajes: esqueleto humano anatómico con cráneo, caja torácica, columna, pelvis, manos y pies. La malla de Écorché se adaptó para animar articulaciones y reducir su costo en navegador; detalles en `client/public/models/ATTRIBUTION.md`.
- Escenario: **Auditorio del Último Rebote**, recinto original de experimentación ficticia. Tiene gradas en cuatro lados, mamparas, equipos de laboratorio, luces quirúrgicas, pantallas de registro y 384 médicos en bata. Los observadores escriben en tablas clínicas; tras una eliminación alternan aplausos y anotaciones. Se sintetiza audio de aplauso que el jugador puede silenciar.
- Cámara: tercera persona, detrás del personaje; ratón para apuntar.
- Pogo: cada salto se carga manteniendo Espacio en suelo y se ejecuta al soltar. La altura depende de la duración de la carga. El resorte se comprime durante la preparación y el impacto. WASD solo dirige en el aire: el pogo queda plantado entre saltos, incluso si se mantiene una dirección. El manillar y el vástago están delante del cuerpo, con estribos bajo cada pie.
- Combate: botellas arrojadizas con humor negro. Mantener clic izquierdo o F aumenta la fuerza; al soltar se lanza. El arco blanco muestra la trayectoria prevista con gravedad y se corta en suelo, cobertura o borde. Los impactos los decide el servidor y producen fragmentos de vidrio.
- Las decisiones técnicas quedan a cargo de Codex. Se revisarán errores al cerrar cada fase.
- Eliminación de globos. Diez participantes sin equipo empiezan con tres globos sobre la cabeza. El último globo perdido descalifica. Al vencer los tres minutos gana quien conserve más globos, o hay empate si comparten el primer lugar. Los bots pueden presionar a humanos y no revientan globos entre sí.
- Carrera de torre. Dos equipos de cinco, menta y coral. Gana el equipo cuyo primer integrante aterrice dentro del anillo de la Cima a 12,3 m. Las botellas empujan a rivales, con empuje en área para la pesada. Si vence el límite de 3:45 sin llegada, se declara empate.
- Mapas. La pista plana tiene seis coberturas bajas. En la torre hay cuatro accesos al Mirador, dos rutas fijas a la Cima y tres plataformas móviles. Los dos mapas conservan el auditorio clínico, los espectadores y el pogo como único medio de desplazamiento.

## Revisión del prototipo después de cerrar la fase 0

Prioridad: postura sobre el pogo, sensación de cámara, inclinación y rebote, cálculo del lanzamiento, legibilidad del arco y cobertura del auditorio. Después se podrán ajustar balance, detalle de la audiencia y efectos adicionales.

La fase activa y el estado de preparación están en `FASE_0.md`. El balance y el nombre del mapa son propuestas revisables; el nombre del juego y las reglas de equipos/partida ya fueron confirmados.

## Entorno de trabajo y nube

Se continúa en local. Google Cloud es la referencia del plan y Azure es una alternativa pendiente de evaluación. No hay proyecto o suscripción verificados para desplegar. Consultar `NUBE.md`.

## Responsabilidades

Usuario: dirección de diseño, revisión jugable y datos de acceso a la nube cuando llegue esa fase. Codex: implementación, pruebas, correcciones, contenedores, infraestructura y registro de evidencia. No se inventan integrantes del equipo ni aprobación de un profesor.
