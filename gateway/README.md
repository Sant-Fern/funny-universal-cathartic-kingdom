# Gateway pendiente

En local, `POST /api/join` vive en `server/app.py` y reserva acceso a una única partida. La fase cloud lo separará en un servicio de asignación que use GameServerAllocation y enrute WSS por sala. No se deben levantar réplicas de la implementación local detrás de un balanceador aleatorio.
