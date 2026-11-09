# Fase 0 — Definición del juego y preparación

**Estado: diseño definido; preparación de nube pendiente.** Fecha: 8 de noviembre de 2026. El usuario indicó que revisará más adelante la activación de Azure; el trabajo local continúa.

Objetivo: acordar el juego, fijar alcance y responsables, y comprobar los requisitos de acceso a la nube antes de crear infraestructura. Fuente del alcance académico: `Plan_de_trabajo_Pogo_Arena_3D.md`, proporcionado por el usuario. Las propuestas del plan se distinguen de las decisiones confirmadas en la conversación.

## Decisiones y comprobaciones

| Requisito | Estado | Evidencia o pendiente |
| --- | --- | --- |
| Temática y referencia visual | Confirmado | Esqueletos humanos anatómicos en un auditorio clínico ficticio, observado por médicos en bata que anotan y aplauden las eliminaciones. |
| Cámara y mecánica de pogo | Confirmado | Tercera persona con ratón; saltos manuales. Mantener Espacio comprime el resorte y soltarlo aplica la fuerza acumulada. |
| Arma y tono | Confirmado | Botellas de cristal con carga de fuerza y arco blanco de trayectoria. Humor negro de un experimento científico ficticio. |
| Nombre y dos colores de equipo | Resuelto | Funny Universal Cathartic Kingdom. Menta y coral, elegidos por delegación. Mapa: Auditorio del Último Rebote. |
| Reglas y diez espacios | Confirmado | 5 contra 5, tres minutos, eliminaciones, empate permitido y bots que ceden sus espacios a humanos. Confirmación expresa del usuario. |
| Controles completos | Definidos para revisión | WASD para dirigir en el aire, ratón o flechas para apuntar, clic izquierdo o F para cargar y lanzar, mantener y soltar Espacio para saltar. Tab muestra el marcador. La captura del ratón es opcional y Esc lo libera. |
| Arena | Prototipo jugable | Auditorio ampliado a 60 × 46, con cuatro rutas de salto cargado hacia el mirador y pasillos a ras de suelo. Servidor y cliente comparten la geometría en `shared/arena.json`. |
| Proyecto cloud y facturación | Pendiente | No hay proyecto o suscripción comprobados para desplegar. Google Cloud es la referencia del plan y Azure es una alternativa. Ver `NUBE.md`. |
| Permisos, región y cuota | Sin comprobar | Se elegirán y verificarán cuando exista una suscripción utilizable y presupuesto. No hay proveedor nuevo desplegado ni clúster creado. |
| Responsables | Asignación de trabajo registrada | Usuario: dirección de diseño, revisión y acceso a su cuenta cloud. Codex: implementación, pruebas, correcciones y documentación. Integrantes adicionales no informados. |
| Repositorio y carpetas | Preparado | Git local y carpetas client, server, gateway, infra, k8s, serverless, loadtest, docs y evidence. Todavía no se configuró remoto ni se publicó. |
| Requisitos académicos y alcance de pruebas | Registrados según el plan | Ver `REQUISITOS.md`. La rúbrica original y cualquier aceptación del profesor no están comprobadas. |

## Alcance de la primera entrega

Una arena, un arma, partidas cortas y bots para completar equipos. Cliente web 3D y servidor que decide movimiento, daño, reaparición y puntuación. Quedan fuera del alcance inicial tienda, economía, ELO, varias armas/mapas, cuentas completas, arte final y Steam.

## Criterio de cierre

El diseño, las reglas y la asignación de trabajo ya están registrados. Falta comprobar acceso cloud, suscripción/facturación, permisos, región y cuota. El cierre completo del plan original sigue pendiente de esos requisitos; no se considera desplegado por funcionar localmente.

La instalación de herramientas y el plan de Terraform corresponden a la fase 1. Crear el clúster no es una tarea de la fase 0.
