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
- Equipos: cinco contra cinco; partidas de tres minutos; gana quien consiga más eliminaciones; empate permitido. Diez espacios, completados con bots que son sustituidos al entrar humanos. Confirmado por el usuario.
- Zona de observación: el objetivo sube de Pista a Relevo, Mirador, Estación y Cima en etapas de 45 segundos. El control exclusivo vale 1, 1, 2, 3 y 4 puntos por segundo, respectivamente. La disputa pausa el marcador. Desde el Mirador, las rutas A y B pasan por la Estación y continúan hasta la Cima a 12.3 unidades de altura. Tres plataformas móviles ofrecen cruces adicionales.
- Botella pesada: menor alcance y recarga más lenta. Los fragmentos dañan a rivales próximos y las coberturas detienen el daño. Un golpe confirmado activa un aviso breve y un sonido distinto al de una rotura sin daño.
- Colores: menta y coral, elegidos por criterio de implementación tras delegarlos el usuario.

## Valores iniciales para jugar y evaluar

Arena de 60 × 46 unidades, con ocho mesas de instrumentos como cobertura, mayor distancia entre zonas de inicio y cuatro rutas señalizadas que convergen en un mirador central. Cada ruta pasa por «01 Impulso» (1.35 u), «02 Relevo» (2.65 u) y «03 Mirador» (3.95 u). Cada desnivel exige cargar y soltar Espacio de nuevo. Los pasillos del suelo permiten flanquear las rutas.

Velocidad de desplazamiento de hasta 7 unidades/s en el aire. El salto parte de 4.2 a 11.6 unidades/s según la carga (máxima en 0.78 s), con gravedad de 24 unidades/s² y una recuperación de 0.15 s tras tocar suelo. Los bots eligen dónde aterrizar y usan las mismas colisiones. La botella de cristal hace 28 de daño directo. La pesada hace hasta 30 y puede sacar a un rival del borde, con un impulso breve que permite corregir en el aire. Los valores compartidos están en `shared/arena.json`.

## Revisión del prototipo después de cerrar la fase 0

Prioridad: postura sobre el pogo, sensación de cámara, inclinación y rebote, cálculo del lanzamiento, legibilidad del arco y cobertura del auditorio. Después se podrán ajustar balance, detalle de la audiencia y efectos adicionales.

La fase activa y el estado de preparación están en `FASE_0.md`. El balance y el nombre del mapa son propuestas revisables; el nombre del juego y las reglas de equipos/partida ya fueron confirmados.

## Entorno de trabajo y nube

Se continúa en local. Google Cloud es la referencia del plan y Azure es una alternativa pendiente de evaluación. No hay proyecto o suscripción verificados para desplegar. Consultar `NUBE.md`.

## Responsabilidades

Usuario: dirección de diseño, revisión jugable y datos de acceso a la nube cuando llegue esa fase. Codex: implementación, pruebas, correcciones, contenedores, infraestructura y registro de evidencia. No se inventan integrantes del equipo ni aprobación de un profesor.
