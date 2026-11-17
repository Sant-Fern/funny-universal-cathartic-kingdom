# Gateway de partidas en AWS

`app.py` implementa `POST /api/join` con GameServerAllocation y dirige `/ws/{gameserver}` a la IP privada de su pod. Reutiliza partidas Allocated con espacio; las reservas y el límite de diez humanos se comprueban atómicamente en cada servidor. Los tokens de acceso caducan y solo se usan una vez.

Dos réplicas del gateway se ejecutan detrás del cliente Nginx. El gateway verifica el origen del navegador y valida el nombre y las etiquetas del GameServer antes de conectarse; el usuario no suministra la dirección del destino. Su cuenta de servicio solo puede listar/consultar GameServers, crear asignaciones y consultar pods del namespace `pogo`.

El modo local conserva las salas de `server/app.py`. No desplegar réplicas aleatorias de ese modo local como sustituto del gateway. Ver [k8s/aws](../k8s/aws/README.md) y la [evidencia de despliegue](../docs/DESPLIEGUE_AWS.md).
