# Acceso a nube

**Actualización del 16 de noviembre de 2026:** el juego ya está desplegado en AWS: https://d1oif12lvr7c7k.cloudfront.net. Se comprobó una cuenta Free activa, se crearon EKS/Agones y se validaron conexiones públicas. El estado vigente, costo, evidencia y pendientes académicos están en [DESPLIEGUE_AWS.md](DESPLIEGUE_AWS.md).

Lo siguiente se conserva como historial de las restricciones iniciales; no describe el despliegue vigente.

Actualizado el 8 de noviembre de 2026.

## Estado del proyecto

Todavía no hay un proyecto de Google Cloud ni una suscripción de Azure comprobados para ejecutar la demostración. No se han verificado facturación, créditos ni cuotas.

## Ruta actual

El juego continúa en local. Docker Compose y el proxy Nginx pasaron una prueba de integración. Se prepararon una base de Terraform para GCP y un manifiesto privado de Kubernetes; ver [traspaso](TRASPASO.md) y [evidencia local](../evidence/local/VALIDACION.md). Falta comprobar la cuenta, habilitar el entorno real y completar Agones y la asignación de partidas.

Google Cloud conserva el papel de arquitectura de referencia del documento inicial. Azure es una alternativa por evaluar cuando haya una suscripción utilizable. Antes de adaptar la arquitectura se comprobarán crédito real, elegibilidad, servicios habilitados, región, cuota y límite de gasto. Tener una cuenta iniciada no demuestra que exista capacidad para AKS, máquinas virtuales o un servicio de base de datos.

La fase 0 tiene resuelto el diseño. Su criterio de acceso cloud, y la evidencia posterior de despliegue y escalado en nube, continúan pendientes. Cualquier reducción del alcance académico necesita quedar declarada y, si corresponde, aceptada por el profesor; no se asume esa aceptación.

## Documentación oficial consultada

- Google indica que para las contrataciones locales de México se proporcione RFC: [Impuestos en tu país — México](https://docs.cloud.google.com/billing/docs/resources/vat-overview?hl=es-419).
- El nivel gratuito de Google Cloud requiere una cuenta de facturación: [Google Cloud Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features).
- Los créditos educativos de Google son una vía mediante docentes e instituciones elegibles: [Get and redeem education credits](https://docs.cloud.google.com/billing/docs/how-to/edu-grants).
- Azure for Students requiere elegibilidad y verificación académica; la oferta está limitada a una suscripción por cliente elegible: [What is Azure for Students?](https://learn.microsoft.com/en-us/azure/education-hub/find-ids). Crear otra cuenta no acredita por sí mismo un nuevo beneficio promocional.

No se solicitan datos fiscales, credenciales ni números de tarjeta en este repositorio o en el chat.
