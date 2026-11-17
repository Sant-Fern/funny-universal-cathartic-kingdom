# Despliegue del integrador en AWS

## Alcance confirmado

Se desplegó la versión `funny-universal-cathartic-kingdom-cambios-en-mapa.zip`, elegida por el usuario, junto con la adaptación de servidor y asignación de partidas para AWS. Las seis prácticas individuales se realizarán en otro chat. Este documento separa el despliegue jugable ya realizado de los entregables que todavía faltan para completar el integrador.

**Juego público:** https://d1oif12lvr7c7k.cloudfront.net

**Estado:** disponible en AWS, con dos modos y HTTPS/WebSocket seguro. El integrador académico completo sigue pendiente.

## Requisitos del PDF

Las páginas numeradas 44 y 45 requieren:

- Terraform con estado remoto, infraestructura reproducible y evidencia de creación y eliminación.
- Servidor Docker en Kubernetes y Agones, con Fleet, FleetAutoscaler, PodMonitor e integración del ciclo de vida del SDK.
- CI/CD que ejecute pruebas, publique la imagen por commit y actualice la flota.
- Tabla de líderes serverless con persistencia y pruebas de carga.
- Prometheus/Grafana con CCU, tick p99, GameServers por estado y nodos.
- Autoescalado de flota, servicios y nodos, con tiempos de reacción medidos para el nivel Excelente.
- Rampa y pico de 1 000 conexiones de jugadores, 500 espectadores HLS y extrapolación a 20 000.
- Reporte de máximo seis páginas y presentación de diez minutos con demostración del escalado.

## Cuenta y condición de costo

Consulta realizada el 16 de noviembre de 2026 mediante `freetier get-account-plan-state`:

| Dato | Resultado |
| --- | --- |
| Plan | FREE |
| Estado | ACTIVE |
| Crédito restante | USD 142,39 |
| Vencimiento del plan | 16 de abril de 2027 |
| Región prevista | us-east-2 |
| Cuota estándar EC2 On-Demand | 32 vCPU |

La cuenta contiene cuatro instancias en ejecución de otros proyectos en esa región. Comparten el saldo disponible. Ese inventario se consultó para dimensionar este proyecto y evitar interferencias.

El objetivo de USD 0 se refiere al cobro al usuario. Los recursos elegibles consumen créditos y tienen un costo bruto que debe registrarse en el informe. El plan Free cierra al agotar el crédito o vencer el plazo. El saldo se debe volver a consultar antes de crear capacidad y antes de cada carga grande.

Las alertas de presupuesto tienen retraso y sirven como aviso. La protección contra cobros depende de conservar el plan Free y utilizar servicios admitidos. Cualquier operación que exija activar pago requiere revisar nuevamente la viabilidad de este alcance con el usuario.

Fuentes oficiales consultadas:

- https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html
- https://aws.amazon.com/free/
- https://aws.amazon.com/eks/pricing/
- https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_freetier_GetAccountPlanState.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html

## Estado de preparación

La versión del ZIP se incorporó conservando la revisión académica. La compilación y las **114 pruebas** finales pasaron: 94 de Python y 20 de JavaScript. Hay una advertencia de deprecación de Starlette/httpx y una advertencia de tamaño de paquete del cliente, sin fallo de pruebas ni de compilación.

El ZIP de origen tiene SHA-256 `4E1A635032C122599FB4137F701EB39219161DE4F190C9C5E9E30AAAA476A851`. Las imágenes desplegadas usan la etiqueta inmutable `zip-aws-20261116-02` en ECR. Es una etiqueta de esta entrega: **todavía no cumple el requisito de etiqueta por SHA de commit del pipeline**. Los cambios locales de este despliegue no se han publicado de nuevo en GitHub.

## Infraestructura realmente creada

| Componente | Estado comprobado |
| --- | --- |
| Terraform | `apply` real, estado remoto S3 privado, cifrado, versionado y con bloqueo. |
| Red | VPC propia, dos subredes públicas y salida por Internet Gateway, sin NAT Gateway. |
| Kubernetes | EKS `pogo-demo`, versión 1.35; dos nodos `m7i-flex.large` listos. Grupo limitado a ocho nodos. |
| Agones | Versión 1.62.0, Fleet y FleetAutoscaler por modo. Dos GameServers Ready por modo en reposo. |
| Ciclo de vida | Ready, Health, contador de ocupación y Shutdown tras quedar vacía una sesión. Reintentos ante errores transitorios del SDK. |
| Asignación | Gateway con dos réplicas, reservas y WebSocket dirigido a la IP privada de su GameServer. Diez humanos como máximo por partida. |
| Entrada | ALB `pogo-demo-web` y CloudFront con certificado de su dominio incluido. |
| Escalado | FleetAutoscaler, HPA del gateway, metrics-server y Cluster Autoscaler instalados. |
| Monitoreo | Prometheus con PodMonitor y Grafana privado; tablero `Pogo · Integrador AWS`, ocho paneles, verificado mediante API. |
| Identidad | EKS Pod Identity para los controladores. La cuenta rechazó crear OIDC por su política; no se modificó esa restricción. |

La administración de Kubernetes se restringe a la IP del equipo utilizada durante la instalación. Si cambia esa conexión, actualizar `admin_cidr` mediante Terraform. Grafana y Prometheus solo se abren mediante conexión local autenticada a Kubernetes; no tienen acceso público.

## Pruebas de nube y evidencia

| Prueba | Resultado |
| --- | --- |
| Carrera, dos conexiones, HTTP al origen | Aprobada. Los dos jugadores compartieron partida y los bots ocuparon los espacios restantes. |
| Eliminación, diez conexiones, HTTP al origen | Aprobada. Diez humanos, cero bots; al salir uno, volvió un bot. |
| Carrera, diez conexiones, HTTPS y WSS | Aprobada. RTT p95 de 122,819 ms desde este equipo; archivo `evidence/aws-smoke-https-race-10.json`. |
| Ambos modos, cuarenta conexiones, veinte segundos de coincidencia | Aprobada. Pico de 40 CCU, dos partidas por modo y cero errores. RTT p95 de 162,321 ms; archivo `evidence/aws-multi-room.json`. |
| Escalado de flota | Se observó pasar de dos a cuatro GameServers por modo con la carga y regresar a dos por modo después de retirar las sesiones vacías. |
| Chrome | Se verificó el menú y el ingreso al mapa mediante el dominio HTTPS. La prueba de protocolo no certifica la fluidez gráfica del equipo. |

La prueba de 40 jugadores corresponde a la revisión `-01`. La revisión `-02` agrega reintentos del SDK y excluye ticks sin jugadores del histograma; se conserva evidencia de su comprobación posterior. El tiempo del tick mide simulación y preparación de snapshots, no FPS ni latencia de red.

Los JSON de `evidence/aws/` conservan estado de la cuenta, recursos, consulta de Grafana y datos originales de Prometheus. No contienen contraseñas ni tokens de juego. El estado de Terraform y los archivos de configuración local están excluidos de Git.

## Costo y disponibilidad

Después de crear EKS, nodos, ECR, ALB y CloudFront se volvió a comprobar `FREE / ACTIVE`. La API seguía informando USD 142,39 de crédito. Las cifras de facturación tienen retraso: ese saldo no significa que los recursos no hayan consumido nada.

Las tarifas consultadas para Ohio son USD 0,09576 por nodo/hora, USD 0,10 por clúster EKS/hora y USD 0,0225 por ALB/hora. El cálculo reproducible de `scripts/aws-cost-baseline.py` da una **base bruta de USD 0,31402/h con dos nodos**, antes de créditos y franquicias. **No incluye** almacenamiento, direcciones IPv4, LCU, tráfico, CloudFront, ECR, S3 ni otros proyectos. No es el costo total ni un presupuesto máximo.

El objetivo de **cobro USD 0 depende de mantener el plan Free activo**. AWS documenta que ese plan no genera cargos y se cierra al agotar créditos o vencer. Este entorno no es alojamiento gratuito permanente. No se cambió a Paid ni se activaron compromisos de pago. Los cuatro servidores de otros proyectos comparten el crédito y no se modificaron.

El comprobador de Terraform exige Free activo y USD 40 de saldo para crear/actualizar. No apaga recursos existentes si alguien cambia el plan o baja el crédito. El límite de ocho nodos acota capacidad; no constituye un límite financiero. Para detener el consumo de créditos de este proyecto hay que retirar su entorno siguiendo `infra/aws/README.md`.

## Qué falta del PDF, sin mezclar las seis prácticas

| Requisito del integrador | Situación después de este despliegue |
| --- | --- |
| Terraform reproducible y estado remoto | Creado y aplicado. Faltan plan revisado en PR y evidencia del `destroy` final sin recursos residuales. |
| Docker, Kubernetes, Fleet y SDK | Implementados y comprobados en AWS. |
| FleetAutoscaler, HPA y escalado de nodos | Configurados; se comprobó el escalado de flota. Falta medir reacción de HPA y nodos bajo carga suficiente. Los nodos permanecieron en dos durante la prueba breve. |
| Grafana con CCU, tick p99, estados y nodos | Implementado y consultado con datos reales. Falta conservar resultados de las cargas largas y sus capturas para la entrega. |
| CI/CD verde, imagen por commit y actualización de Fleet | Pendiente. El workflow de comprobaciones local existente no publica estas imágenes ni despliega EKS. El despliegue actual se ejecutó desde este equipo. Resolver una identidad de CI admitida por esta cuenta antes de automatizar publicación y despliegue. |
| Tabla de líderes serverless persistente | Pendiente: no se creó Lambda/DynamoDB ni se conectaron resultados persistentes. |
| Rampa 1 000 jugadores a 2/s, veinte minutos | Pendiente. Las pruebas breves de diez y cuarenta jugadores no la sustituyen. |
| Pico 1 000 jugadores a 50/s, diez minutos | Pendiente. No se declara capacidad de 1 000 CCU sin medirla. |
| 500 espectadores HLS, 360p, cinco minutos | Pendiente. CloudFront del juego no acredita una emisión HLS ni esa prueba. |
| Extrapolación a 20 000 espectadores, 1080p, 6 000 kbps | Pendiente de cálculo completo de egress y costos con el escenario de video. |
| Reporte máximo seis páginas y presentación de diez minutos | Pendientes. Este registro operativo no sustituye el informe final ni la demostración ensayada. |

El material admite una variante reducida de carga en la práctica 3.4, pero el listado del integrador conserva 1 000 jugadores y 500 espectadores. La aceptación de una carga reducida corresponde al profesor; aquí no se da por aprobada.

## Archivos para continuar

- `infra/aws/README.md`: preparación, aplicación, restricciones y retiro del entorno.
- `k8s/aws/README.md`: versiones, imágenes, flotas y acceso privado al monitoreo.
- `k8s/aws/dashboard.json`: tablero exportado.
- `loadtest/cloud_probe.py`: comprobación breve de varias salas; no es la carga Locust del PDF.
- `docs/REVISION_UNIDAD_3_2026-11-16.md`: auditoría inicial, anterior al despliegue de esta sesión.
