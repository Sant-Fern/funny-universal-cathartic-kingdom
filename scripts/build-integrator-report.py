"""Build the six-page integrator report from preserved, auditable measurements."""
import argparse
import csv
from datetime import datetime
import json
from pathlib import Path
from xml.sax.saxutils import escape

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether

ROOT=Path(__file__).resolve().parents[1]
LOAD=ROOT/'evidence/aws-load'
BUILD=ROOT/'.tools/report'
BUILD.mkdir(parents=True,exist_ok=True)
INK='#17333b'; TEAL='#087c80'; MUTED='#4e646b'; GOLD='#b17e22'
FONT='Arial'; pdfmetrics.registerFont(TTFont(FONT,'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='Arial-Bold')
STYLE=ParagraphStyle('body',fontName=FONT,fontSize=10,leading=14,textColor=colors.HexColor(INK),spaceAfter=8)
SMALL=ParagraphStyle('small',parent=STYLE,fontSize=8.2,leading=11,textColor=colors.HexColor(MUTED),spaceAfter=5)
TITLE=ParagraphStyle('title',parent=STYLE,fontName='Arial-Bold',fontSize=25,leading=29,spaceAfter=14)
H1=ParagraphStyle('heading',parent=STYLE,fontName='Arial-Bold',fontSize=18,leading=22,spaceAfter=12)
H2=ParagraphStyle('subheading',parent=STYLE,fontName='Arial-Bold',fontSize=11,leading=15,spaceBefore=5,spaceAfter=7)


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def summary(label):
    path=LOAD/label/'summary.json'
    return read(path) if path.exists() else None


def metric(run,name,percentile='p95_ms'):
    return next((r[percentile] for r in run['requests'] if r['name']==name),None) if run else None


def fmt(value,digits=0):
    return f'{value:,.{digits}f}' if value is not None else 'Sin medición'


def failure_count(run):
    return sum(r['failures'] for r in run['requests']) if run else 0


def paragraph(text,style=STYLE):
    return Paragraph(text,style)


def table(rows,widths):
    head_style=ParagraphStyle('header',parent=SMALL,textColor=colors.white,fontName='Arial-Bold')
    cells=[[paragraph(escape(str(c)),head_style if i==0 else SMALL) for c in row] for i,row in enumerate(rows)]
    result=Table(cells,colWidths=widths,hAlign='LEFT',repeatRows=1)
    result.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor(INK)),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#f0f5f4'),colors.white]),
        ('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),7),
        ('BOTTOMPADDING',(0,0),(-1,-1),5),('LEFTPADDING',(0,0),(-1,-1),8),
        ('LINEBELOW',(0,0),(-1,0),.8,colors.HexColor(TEAL))]))
    return result


def timeseries(label):
    directory=LOAD/label
    runs=[read(p) for p in directory.glob('*/run.json')]
    master=next(r for r in runs if not r['worker_only'])
    rows=list(csv.DictReader((directory/master['generator']/'pogo-timeseries.csv').open(encoding='utf-8-sig')))
    start=master['started_epoch']
    return [max(0,(float(r['utc_epoch'])-start)/60) for r in rows],rows


def charts(label,stem):
    x,rows=timeseries(label)
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,
                         'axes.labelcolor':INK,'text.color':INK,'axes.edgecolor':'#aac0c1'})
    fig,ax=plt.subplots(figsize=(8.2,3.0),layout='constrained')
    ax.plot(x,[float(r['locust_users']) for r in rows],color='#9ba9aa',label='Clientes simulados',linewidth=1.4)
    ax.plot(x,[float(r['connected']) for r in rows],color=TEAL,label='Conexiones activas',linewidth=1.7)
    ax.set(xlabel='Minutos desde el inicio',ylabel='Personas simuladas',ylim=(0,1100))
    ax.grid(axis='y',alpha=.16); ax.legend(frameon=False,loc='lower right')
    fig.savefig(BUILD/f'{stem}-ccu.png',dpi=180);plt.close(fig)
    prom=read(LOAD/label/'prometheus.json')
    fig,ax=plt.subplots(figsize=(8.2,2.8),layout='constrained')
    for key,title,color in [('nodes','Nodos listos',TEAL),('gateway_replicas','Réplicas del gateway',GOLD)]:
        for item in prom['queries'][key]['response']['data']['result']:
            ax.step([(float(t)-read(next(p for p in (LOAD/label).glob('*/run.json') if not read(p)['worker_only']))['started_epoch'])/60 for t,v in item['values']],
                    [float(v) for t,v in item['values']],where='post',label=title,color=color,linewidth=1.8)
    ax.set(xlabel='Minutos desde el inicio',ylabel='Unidades',ylim=(0,11));ax.grid(axis='y',alpha=.16);ax.legend(frameon=False)
    fig.savefig(BUILD/f'{stem}-scale.png',dpi=180);plt.close(fig)


def footer(canvas,doc):
    canvas.setStrokeColor(colors.HexColor('#c7d7d7'));canvas.line(44,41,551,41)
    canvas.setFont(FONT,8);canvas.setFillColor(colors.HexColor(MUTED))
    canvas.drawString(44,28,'Funny Universal Cathartic Kingdom · Integrador AWS · Noviembre de 2026')
    canvas.drawRightString(551,28,f'{doc.page} / 6')


def build(args):
    baseline=summary('ramp-1000-fixed');spike=summary('spike-1000');ramp=summary('ramp-1000-optimized')
    hls=summary('hls-500');board=summary('leaderboard-500-steady') or summary('leaderboard-500-paced') or summary('leaderboard-500')
    chosen=ramp or spike or baseline
    costs=read(ROOT/'evidence/aws/integrator-costs.json')
    ci=read(ROOT/'evidence/aws-ci/run.json')
    cleanup=read(ROOT/'evidence/aws/final-status.json') if (ROOT/'evidence/aws/final-status.json').exists() else {}
    charts('ramp-1000-fixed','baseline')
    charts(chosen['label'],'final')
    output=ROOT/args.output;output.parent.mkdir(parents=True,exist_ok=True)
    story=[]
    add=story.append
    add(paragraph('Infraestructura y capacidad<br/>del videojuego en AWS',TITLE))
    add(paragraph('Funny Universal Cathartic Kingdom',H2))
    add(paragraph('Entrega del integrador de la Unidad 3. El juego proviene del ZIP de cambios de mapa seleccionado. Las seis prácticas individuales quedan fuera de este informe.'))
    add(Image(str(ROOT/'evidence/aws-ci/menu-publicado.jpg'),width=507,height=261))
    add(Spacer(1,10))
    add(table([
        ['Ruta','Implementación'],
        ['Juego web','CloudFront HTTPS, ALB, Nginx y gateway HTTP/WebSocket. El navegador llega a la sala asignada por su nombre.'],
        ['Partidas','EKS 1.35 y Agones 1.62.0. Dos Fleets: Eliminación y Carrera, diez espacios por servidor, bots sustituidos por humanos.'],
        ['Resultados','GameServer con Pod Identity invoca Lambda. DynamoDB guarda resultados idempotentes. API Gateway permite consulta pública.'],
        ['Control','Terraform con estado S3, ECR con etiquetas inmutables del commit, Prometheus y Grafana privados.']], [90,417]))
    add(paragraph('Juego: <link href="https://d1oif12lvr7c7k.cloudfront.net" color="#087c80">d1oif12lvr7c7k.cloudfront.net</link>. Región Ohio (us-east-2).',SMALL))
    add(PageBreak())

    add(paragraph('Reproducción, despliegue y retiro',H1))
    add(paragraph('Terraform crea una VPC propia con dos subredes, EKS, roles, ECR y servicios de resultados. El backend S3 usa cifrado, versionado y bloqueo. Los archivos locales y credenciales quedan fuera de Git. El plan de CI se publica para revisión y no aplica cambios de infraestructura automáticamente.'))
    add(table([
        ['Comprobación','Evidencia obtenida'],
        ['Pruebas','96 del servidor, 20 del cliente y 3 de clasificación aprobadas. Compose también comprueba HTTP y WebSocket detrás de Nginx.'],
        ['CI/CD',f"Ejecución {ci['url'].rsplit('/',1)[-1]} exitosa. Prueba, compila, publica server/client/gateway en ECR y actualiza las flotas. Verifica conexión y clasificación desde HTTPS."],
        ['Versión publicada',ci['headSha']],
        ['Ciclo IaC aislado','55 recursos creados en pogo-validation. Dos nodos y un contenedor emitieron INTEGRADOR_TERRAFORM_OK. El destroy eliminó 55 recursos. Estado final vacío, clúster y VPC ausentes.'],
        ['Recuperación de estado','Una credencial temporal venció al guardar el apply. Se recuperó errored.tfstate tras confirmar la ejecución terminada. El puente credential_process permite renovación durante operaciones largas.'],
        ['Reversión de Fleet','La imagen anterior sustituyó servidores Ready. El GameServer Allocated mantuvo el commit y la conexión durante 100 s: 2,002 snapshots y 97 respuestas de ping. Luego se restableció la imagen del commit.']], [100,407]))
    add(Spacer(1,10))
    add(paragraph('Revisión humana',H2))
    add(paragraph('El PR 1 conserva el código y el plan para revisión antes de integrar a main. El ejecutor de despliegue fue local, efímero y del repositorio privado. Usó la sesión temporal de AWS, sin claves permanentes en GitHub. La exposición oral y la aprobación humana del PR corresponden al equipo.'))
    add(paragraph(f'Evidencias: evidence/aws-ci/, evidence/aws-terraform-cycle/ y docs/INTEGRADOR.md. Las cargas usan imágenes de 8ee5d87; sus árboles de aplicación coinciden con el despliegue final, como verifica application-source-comparison.json. <link href="https://github.com/Sant-Fern/funny-universal-cathartic-kingdom/pull/1" color="#087c80">Solicitud de revisión</link>. <link href="{ci["url"]}" color="#087c80">Despliegue exitoso</link>.',SMALL))
    add(PageBreak())

    add(paragraph('Pruebas de jugadores y capacidad',H1))
    add(paragraph('Dos generadores EC2 separados del clúster ejecutaron cuatro procesos Locust. Cada humano simulado intenta enviar controles a 20 Hz, recibe snapshots y mide ping. Las cargas masivas usan Eliminación; Carrera tiene comprobaciones de integración. Los bots no cuentan como CCU. Se prueba desde Ohio, sin medir FPS ni latencia doméstica.'))
    rows=[['Ejecución','Clientes / CCU pico','RTT p95','Duración solicitada']]
    for label,title in [('ramp-1000-fixed','Rampa inicial'),('spike-1000','Pico optimizado'),('ramp-1000-optimized','Rampa optimizada')]:
        r=summary(label)
        if r:rows.append([title,f"{fmt(r['peak_locust_users'])} / {fmt(r['peak_connected_receivers'])}",f"{fmt(metric(r,'ping_rtt'))} ms",f"{r['requested_duration_seconds']} s"])
    add(table(rows,[133,140,100,134]))
    add(Spacer(1,10));add(Image(str(BUILD/'final-ccu.png'),width=507,height=185))
    add(paragraph(f"Serie: {chosen['label']}. Clientes solicitados y conexiones confirmadas por los receptores. Prometheus observó un pico de {fmt(chosen['peak_prometheus_ccu'])} CCU con muestreo de 15 s.",SMALL))
    add(paragraph(f"Los scrapes desfasados entre salas pueden sumar brevemente conexiones antiguas y nuevas durante reconexiones; ese gauge no representa clientes únicos adicionales. El generador alcanzó {fmt(chosen['max_worker_cpu_percent'],1)} % de CPU por trabajador y aproximadamente {fmt(chosen.get('observed_inputs_per_player_second'),1)} controles por segundo conectado.",SMALL))
    add(paragraph('Resultados que limitan la conclusión',H2))
    add(paragraph(f"La rampa inicial de veinte minutos alcanzó 843 conexiones y acumuló {fmt(failure_count(baseline))} errores de peticiones. La primera tentativa anterior se interrumpió y se conserva por separado. Se corrigió la serialización de ingreso, se codifica un snapshot por sala y se desactiva la compresión del enlace interno. El máximo temporal de nodos pasó de ocho a diez."))
    add(paragraph(f"En {chosen['label']} se registraron {fmt(failure_count(chosen))} errores. Llegar a un pico de CCU no demuestra estabilidad ni un SLO de latencia. Las reconexiones al terminar partidas y los reintentos de admisión figuran en los CSV; el código de salida del generador no equivale a cero errores.",SMALL))
    add(PageBreak())

    add(paragraph('Autoescalado y observabilidad',H1))
    add(paragraph('FleetAutoscaler conserva servidores libres por modo. HPA ajusta el gateway entre dos y seis réplicas con objetivo de CPU del 60 %. Cluster Autoscaler responde a pods pendientes. La prueba inicial partió de tres nodos y alcanzó ocho; las pruebas posteriores permitieron hasta diez dentro de la cuota regional compartida de 32 vCPU.'))
    add(Image(str(BUILD/'baseline-scale.png'),width=507,height=174))
    add(table([
        ['Observación de la rampa inicial','Tiempo desde el inicio'],
        ['Primer aumento de réplicas del gateway',f"{fmt(baseline['scaling_observations']['gateway_replicas']['first_increase_seconds'])} s"],
        ['Primeros pods pendientes',f"{fmt(baseline['scaling_observations']['pending_pods']['first_increase_seconds'])} s"],
        ['Primer aumento de nodos listos',f"{fmt(baseline['scaling_observations']['nodes']['first_increase_seconds'])} s"],
        ['Máximo trabajo de tick p99 móvil',f"{fmt(baseline['max_rolling_tick_p99_ms'],1)} ms"]], [350,157]))
    add(Spacer(1,9))
    add(paragraph('Estos tiempos describen el primer cambio observado, con resolución de 15 s. La separación entre pods pendientes y nodos listos aproxima una reacción observada, no el tiempo exacto de arranque de cada nodo. El tick mide trabajo activo de simulación y preparación del estado; no incluye todo el envío, espera del planificador ni latencia del jugador.'))
    add(paragraph('La rampa final usa diez nodos y seis gateways preparados de antemano, con distribución entre hosts y reserva de CPU basada en el pico medido. Esa repetición valida capacidad preparada y no mide el tiempo de autoescalado desde reposo.',SMALL))
    add(paragraph('Configuración y mejora recomendada',H2))
    node_count=chosen['scaling_observations']['nodes']['max']
    if node_count:
        add(paragraph(f"La densidad agregada observada fue {fmt(chosen['peak_connected_receivers']/node_count,1)} conexiones por nodo ({fmt(chosen['peak_connected_receivers'])} conexiones pico y {fmt(node_count)} nodos). Incluye el costo de ejecutar gateway, Agones y monitoreo; las mediciones por sala y CPU permiten afinar el dimensionamiento.",SMALL))
    add(paragraph('Se usó un buffer de 16 servidores para absorber el arranque de nodos; la capacidad máxima de la Fleet sigue siendo 110. El buffer habitual es dos por modo. La densidad observada incluye gateway, Agones y monitoreo en los mismos nodos. Antes de producción conviene definir un SLO de ingreso/RTT, medir por modo y sala, aplicar backpressure a la admisión y reducir el tamaño/frecuencia del estado.'))
    add(paragraph('Tablero: k8s/aws/dashboard.json. Captura y series originales: evidence/aws-ci/grafana-rampa.jpg y evidence/aws-load/*/prometheus.json. El almacenamiento de Prometheus es temporal, con retención de 24 h.',SMALL))
    add(PageBreak())

    add(paragraph('Clasificación y espectadores',H1))
    add(paragraph('La clasificación registra mejores resultados de partidas de humanos, por apodo sin verificar. El cliente público solo lee. Los GameServers escriben mediante IAM y transacción DynamoDB, con idempotencia por partida. Las pruebas usan una clasificación separada. Los registros duran 30 días y los marcadores de idempotencia 365. Una caída abrupta puede perder resultados todavía en la cola de memoria.'))
    add(table([
        ['Carga','Resultado medido'],
        ['Clasificación',f"500 usuarios virtuales, 80/20 lecturas/escrituras. {board['label']}: {fmt(failure_count(board))} errores. Lectura p95 {fmt(metric(board,'leaderboard_read'))} ms; escritura p95 {fmt(metric(board,'leaderboard_write'))} ms."],
        ['Cuota de Lambda','La cuenta admite diez ejecuciones concurrentes. La primera prueba con pausas fijas de 6 s produjo throttling; se conserva. La repetición distribuye el primer acceso entre 0-12 s y usa pausas de 8-12 s. 500 usuarios virtuales no equivalen a 500 funciones simultáneas.'],
        ['HLS 360p',f"{fmt(hls['peak_hls_viewers'])} receptores durante 310 s. {fmt(failure_count(hls))} errores. Segmento p95 {fmt(metric(hls,'hls_segment'))} ms. {fmt(hls['received_payload_bytes']/1e9,2)} GB de segmentos recibidos."],
        ['Modelo de video','Clip propio sintético 640x360, 800 kbps de video, segmentos TS de 4 s en S3 privado y CloudFront OAC. Buffer inicial 4 s y consumo simulado en tiempo real. Sin decodificador, ABR ni transmisión en vivo.']], [110,397]))
    add(Spacer(1,10))
    add(paragraph('Extrapolación solicitada',H2))
    add(paragraph('20,000 espectadores a 1080p y 6,000 kbps requieren 120 Gbit/s y 54,000 GB decimales por hora. A una tarifa uniforme de referencia de USD 0.085/GB, el egress sería USD 4,590/h antes de franquicias y descuentos por volumen. Es un escenario matemático conservador; no se ejecutó una carga de 20,000 espectadores ni se contrató esa capacidad.'))
    add(paragraph('AWS publica 1 TB/mes y diez millones de peticiones gratuitas para CloudFront pay-as-you-go, compartidos por la cuenta. La tarifa real depende de región, volumen y consumo mensual. Los supuestos, CSV y cálculos reproducibles acompañan este informe.',SMALL))
    add(PageBreak())

    add(paragraph('Costo, conservación y cierre',H1))
    add(paragraph('El objetivo de costo cero corresponde al cobro al usuario mientras la cuenta permanezca FREE / ACTIVE. Los recursos consumen créditos. AWS cierra el acceso al agotar el saldo o vencer el plan; no es alojamiento gratuito permanente. El control de Terraform exige USD 40 de crédito para crear o actualizar, pero no apaga recursos automáticamente.'))
    add(table([['Escenario de lista','USD/h, antes de créditos']]+[
        [f"{x['nodes']} nodos + EKS + ALB + discos + IPv4",x['fixed_hour']] for x in costs['scenarios']]+[
        ['Dos generadores temporales',fmt(float(costs['generators_fixed_hour']),5)]], [355,152]))
    add(Spacer(1,9))
    add(paragraph('Modelo: nodos m7i-flex.large, 20 GB gp3 por nodo, mes de 730 h y dos IPv4 del ALB como supuesto. Los precios oficiales de EC2 y ALB están guardados en evidence/aws/. El costo fijo excluye LCU, tráfico entre zonas, CDN, ECR/S3, Lambda/API/DynamoDB y otros proyectos. A 1,000 jugadores, el fijo de diez nodos es USD 0.001162 por jugador-hora.'))
    measured=next((x for x in costs['measured_runs'] if x['label']==chosen['label']),None)
    if measured:
        add(paragraph(f"El cliente de protocolo recibió aproximadamente {fmt(float(measured['payload_gb_per_player_hour']),3)} GB por jugador-hora. A tarifa uniforme, el payload supondría USD {fmt(float(measured['uniform_cf_payload_per_player_hour']),4)} por jugador-hora antes de franquicias, compresión y descuentos. Es una estimación de payload, no una factura; el costo de red puede dominar al de cómputo."))
        if 'reference_compute_network_hour_at_peak' in measured:
            add(paragraph(f"El subtotal de cómputo y red a la concurrencia pico sería USD {fmt(float(measured['reference_compute_network_hour_at_peak']),2)}/h, o USD {fmt(float(measured['reference_compute_network_per_player_hour']),5)} por jugador-hora. Incluye el fijo y LCU promedio observado; mantiene excluidos los otros servicios variables y el tráfico entre zonas.",SMALL))
    add(paragraph('Conservación de recursos',H2))
    add(paragraph(cleanup.get('narrative','El entorno de validación fue eliminado. La limpieza de generadores y la restauración del buffer se documentan en evidence/aws/final-status.json al terminar las mediciones. El juego principal permanece publicado para la exposición.')))
    add(paragraph('Fuentes y revisión',H2))
    sources=[('Material de Unidad 3','Requisitos: páginas internas 44-45, hojas físicas 45-46. Adaptación del caso sujeta a aceptación del profesor.'),
        ('Plan Free','https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html'),
        ('EKS','https://aws.amazon.com/eks/pricing/'),('CloudFront','https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/'),
        ('IPv4 y EBS','https://aws.amazon.com/vpc/pricing/ · https://aws.amazon.com/ebs/pricing/')]
    for title,url in sources:add(paragraph(f'<b>{title}:</b> {escape(url)}',SMALL))
    doc=SimpleDocTemplate(str(output),pagesize=(595.28,841.89),leftMargin=44,rightMargin=44,topMargin=42,bottomMargin=54,
                         title='Integrador AWS - Funny Universal Cathartic Kingdom',author='Santiago y equipo')
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    # Compact, measured content for an editable presentation, not rasterized slides.
    data={'baseline':baseline,'spike':spike,'ramp':ramp,'chosen':chosen,'hls':hls,'board':board,'costs':costs,'ci':ci,
          'cleanup':cleanup,'game_url':'https://d1oif12lvr7c7k.cloudfront.net'}
    x,rows=timeseries(chosen['label']);stride=max(1,len(rows)//60)
    data['chart']={'minutes':[round(v,1) for v in x[::stride]],'users':[int(float(r['locust_users'])) for r in rows[::stride]],
                   'connected':[int(float(r['connected'])) for r in rows[::stride]]}
    (BUILD/'presentation-data.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
    print(output)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='output/pdf/Informe_integrador_AWS.pdf')
    build(parser.parse_args())
