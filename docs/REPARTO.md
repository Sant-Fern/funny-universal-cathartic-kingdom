# Trabajo en paralelo

| Frente | Archivos | Alcance |
| --- | --- | --- |
| Juego (Antigravity) | `client/src/`, `server/`, `shared/`, `assets/` | Mecánicas, mapas, bots, interfaz y ajustes visuales. |
| Entrega técnica (Codex) | `loadtest/`, `.github/workflows/`, `infra/`, `k8s/`, `evidence/`, `docs/` | Pruebas externas, automatización, despliegue y registro de resultados. |

Los Dockerfiles, `compose.yaml` y la configuración del proxy son del frente de entrega. Coordinar cambios a las dependencias, los puertos y el protocolo HTTP/WebSocket: esos cambios afectan a ambos. Los cambios de mapa, cámara o combate no deberían exigir cambios a la prueba mientras se conserve el contrato de red.

Cada persona debería trabajar en una copia o rama distinta a partir de la misma versión. Antes de separar las ramas, acordar qué archivos forman esa versión: al preparar este reparto, el repositorio local aún no tenía un primer commit. Juntar los cambios después de comprobar los dos frentes con la prueba de integración.

Primera evidencia: conectar clientes de prueba a una sala aislada sin tocar los archivos del juego. El destino de Terraform y la validación de nube siguen sujetos a una suscripción disponible y a lo que acepte la evaluación del curso.
