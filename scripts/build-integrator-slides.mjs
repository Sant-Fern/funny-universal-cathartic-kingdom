// Called inside artifactSession.run so the editable deck stays synchronized.
import fs from 'node:fs/promises';
import path from 'node:path';

const ink='#17333b', teal='#087c80', muted='#50676e', gold='#b17e22', paper='#f5f7f4';
const family='Arial';
const fmt=(v,n=0)=>v===null||v===undefined?'Sin medición':Number(v).toLocaleString('es-MX',{maximumFractionDigits:n});
const fail=r=>r.requests.reduce((total,item)=>total+item.failures,0);
const p95=(r,name)=>r.requests.find(x=>x.name===name)?.p95_ms;

function text(slide,value,x,y,w,h,size=28,bold=false,color=ink){
  const shape=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  shape.text=value;shape.text.style={fontFamily:family,fontSize:size,bold,color};
  return shape;
}
function page(p,title,number){
  const slide=p.slides.add({width:1280,height:720});slide.background.fill=paper;
  text(slide,title,64,44,1152,94,44,true);
  text(slide,`${number} / 8`,1140,674,76,22,16,false,muted);
  return slide;
}
function table(slide,rows,x,y,w,h,widths){
  const t=slide.tables.add({rows:rows.length,columns:rows[0].length,left:x,top:y,width:w,height:h,values:rows,columnWidths:widths});
  t.borders.assign({fill:'#d7e2df',width:.7,style:'solid'});
  t.cells.block({row:0,column:0,rowCount:rows.length,columnCount:rows[0].length}).assign({
    textStyle:{fontFamily:family,fontSize:24,color:ink},margins:{left:14,right:12,top:12,bottom:12}});
  for(let r=0;r<rows.length;r++)for(let c=0;c<rows[0].length;c++){
    const cell=t.getCell(r,c);cell.fill=r===0?ink:(r%2?'#e9f0ed':'#ffffff');
    cell.text.style={fontFamily:family,fontSize:r===0?23:24,color:r===0?'#ffffff':ink,bold:r===0};
  }
  return t;
}
export async function populate(p,data,root,applyChartFont){
  if(p.slides.items.length)p.slides.delete(p.slides.items.map(x=>x.id));
  let slide=page(p,'Funny Universal\nCathartic Kingdom',1);
  text(slide,'Pogos en AWS',64,250,520,110,62,true,teal);
  text(slide,'Integrador de infraestructura\ny despliegue',64,385,500,100,28);
  text(slide,'Unidad 3 · Noviembre de 2026',64,583,550,36,22,false,muted);
  const bytes=await fs.readFile(path.join(root,'evidence/local/mapa-surrealista.jpg'));
  slide.images.add({dataUrl:'data:image/jpeg;base64,'+bytes.toString('base64'),contentType:'image/jpeg',alt:'Mapa del videojuego del equipo',fit:'cover',position:{left:640,top:44,width:576,height:590}});
  slide.speakerNotes.text='45 s. Presentar el videojuego y el alcance del integrador. Las seis prácticas son independientes. La imagen es una captura propia del proyecto, evidence/local/mapa-surrealista.jpg. No afirmar que el trabajo de las seis prácticas está incluido.';

  slide=page(p,'Arquitectura de una partida',2);
  table(slide,[['Ruta','Servicio','Responsabilidad'],['Entrada','CloudFront, ALB y gateway','HTTPS y WebSocket a la sala asignada'],['Partida','EKS y Agones','Un GameServer por sala de diez espacios'],['Resultados','Lambda y DynamoDB','Escritura IAM, transacción e idempotencia'],['Consulta','API Gateway y menú web','Clasificación pública de solo lectura']],64,160,1152,414,[175,375,602]);
  text(slide,'Pod Identity autentica a los servidores. Los bots no cuentan como conexiones de la prueba.',64,600,1110,60,23,false,muted);
  slide.speakerNotes.text='45 s. Explicar que cada WebSocket queda dirigido a su GameServer. Los datos de una partida viven en ese proceso, y los resultados terminados pasan a DynamoDB. El navegador no escribe puntuaciones. Fuente: infra/aws, gateway/app.py y serverless/handler.py del repositorio.';

  slide=page(p,'Infraestructura y despliegue verificables',3);
  text(slide,'119',64,155,240,115,84,true,teal);
  text(slide,'pruebas aprobadas',64,278,400,48,28);
  table(slide,[['Evidencia','Resultado'],['GitHub Actions','Pruebas, imágenes por commit y actualización de Fleet'],['Terraform','55 recursos temporales eliminados, estado final vacío'],['Reversión','La partida ocupada conservó su conexión durante 100 s']],514,164,702,370,[190,512]);
  text(slide,'El PR conserva el plan para revisión humana. El ejecutor de despliegue fue efímero.',64,594,1152,64,25,false,muted);
  slide.speakerNotes.text=`60 s. Dividir las 119 pruebas: 96 servidor, 20 cliente, 3 clasificación. Abrir ${data.ci.url}. El ciclo Terraform se hizo en otro estado y otra VPC, sin retirar el juego. Se recuperó un estado tras vencer la credencial y se corrigió la renovación. Fuentes: evidence/aws-ci/run.json, evidence/aws-terraform-cycle y PR https://github.com/Sant-Fern/funny-universal-cathartic-kingdom/pull/1. Las imágenes probadas de 8ee5d87 y publicadas de 3e741d5 comparten árboles de aplicación, documentado en application-source-comparison.json.`;

  slide=page(p,'Clientes solicitados y conexiones reales',4);
  const cc=data.chart;
  const ch=slide.charts.add('scatter',{position:{left:64,top:150,width:1152,height:414},scatterOptions:{style:'line'},
    series:[{name:'Clientes simulados',xValues:cc.minutes,values:cc.users,line:{fill:'#9ba9aa',width:2}},
            {name:'Conexiones activas',xValues:cc.minutes,values:cc.connected,line:{fill:teal,width:3}}],
    hasLegend:true,legend:{position:'bottom',textStyle:{fontSize:20}},xAxis:{title:'Minutos desde el inicio',min:0,max:Math.ceil(cc.minutes.at(-1)),majorUnit:2,textStyle:{fontSize:18}},yAxis:{min:0,max:1100,majorUnit:250,textStyle:{fontSize:18},majorGridlines:{fill:'#dce4df',width:1}}});
  applyChartFont(ch,{fontFamily:family});
  text(slide,`${fmt(data.chosen.peak_connected_receivers)} conexiones pico · ${fmt(fail(data.chosen))} errores de peticiones`,64,590,1152,42,28,true,teal);
  text(slide,`${data.chosen.label}. Ohio, clientes de protocolo. La prueba no mide FPS ni garantiza un SLO.`,64,638,1090,44,20,false,muted);
  slide.speakerNotes.text=`75 s. Distinguir clientes Locust de CCU. La rampa inicial alcanzó 843 y el pico posterior ${fmt(data.spike?.peak_connected_receivers)}. Esta gráfica corresponde a ${data.chosen.label}. La rampa con capacidad preparada mantiene diez nodos y seis gateways. Los reintentos y errores siguen en los CSV. El objetivo de controles es 20 Hz y la frecuencia observada fue ${fmt(data.chosen.observed_inputs_per_player_second,1)} Hz. El gauge de servidor puede exceder temporalmente los clientes únicos al sumar scrapes desfasados de salas durante reconexiones. Fuente: evidence/aws-load/${data.chosen.label}/summary.json, pogo-timeseries.csv y prometheus.json. No presentar el pico como capacidad estable.`;

  slide=page(p,'Respuesta del autoescalado desde reposo',5);
  const baseline=JSON.parse(await fs.readFile(path.join(root,'evidence/aws-load/ramp-1000-fixed/prometheus.json'),'utf8'));
  const run=JSON.parse(await fs.readFile(path.join(root,'evidence/aws-load/ramp-1000-fixed/i-0a9b7f44870455186/run.json'),'utf8'));
  const nodes=baseline.queries.nodes.response.data.result[0].values.filter(([t,v])=>Number(t)>=run.started_epoch&&Number(t)<=run.ended_epoch);
  const gateways=baseline.queries.gateway_replicas.response.data.result[0].values;
  const matching=t=>Number(gateways.reduce((best,item)=>Math.abs(Number(item[0])-Number(t))<Math.abs(Number(best[0])-Number(t))?item:best,gateways[0])[1]);
  const scale=slide.charts.add('scatter',{position:{left:64,top:160,width:810,height:410},scatterOptions:{style:'line'},
    series:[{name:'Nodos listos',xValues:nodes.map(x=>(Number(x[0])-run.started_epoch)/60),values:nodes.map(x=>Number(x[1])),line:{fill:teal,width:3}},
            {name:'Gateways',xValues:nodes.map(x=>(Number(x[0])-run.started_epoch)/60),values:nodes.map(x=>matching(x[0])),line:{fill:gold,width:3}}],hasLegend:true,legend:{position:'bottom',textStyle:{fontSize:20}},
    xAxis:{title:'Minutos desde el inicio',min:0,max:21,majorUnit:5,textStyle:{fontSize:18}},yAxis:{min:0,max:10,majorUnit:2,textStyle:{fontSize:18},majorGridlines:{fill:'#dce4df',width:1}}});applyChartFont(scale,{fontFamily:family});
  text(slide,'75 s\nPrimer aumento\ndel gateway',914,170,290,130,26,true,teal);
  text(slide,'120 s\nPrimer aumento\nde nodos listos',914,345,290,140,26,true,teal);
  text(slide,'Datos cada 15 s. El tick mide trabajo de simulación y preparación del estado, no todo el RTT.',64,608,1152,64,23,false,muted);
  slide.speakerNotes.text='60 s. FleetAutoscaler responde al consumo del buffer, HPA a CPU y Cluster Autoscaler a pods pendientes. La primera rampa creció de tres a ocho nodos. Los primeros pods pendientes aparecieron a 75 s. Los tiempos tienen resolución de 15 s y no son el arranque exacto de cada máquina. Fuente: evidence/aws-load/ramp-1000-fixed/summary.json y prometheus.json. El máximo móvil de tick p99 fue aproximadamente 32.7 ms. Los ensayos posteriores permitieron hasta diez nodos.';

  slide=page(p,'Resultados persistentes y espectadores',6);
  table(slide,[['Prueba','Medida','Errores'],['HLS 360p','500 receptores, 310 s',String(fail(data.hls))],
    ['Segmentos de 4 s',`p95 ${fmt(p95(data.hls,'hls_segment'))} ms`,''],
    ['Clasificación',`500 usuarios, lectura p95 ${fmt(p95(data.board,'leaderboard_read'))} ms`,String(fail(data.board))],
    ['Cuota de Lambda','10 ejecuciones concurrentes','']],64,156,1152,360,[290,670,192]);
  text(slide,'HLS usa un clip sintético y un modelo de buffer. La clasificación usa pausas de 8-12 s y acceso IAM para escribir.',64,550,1152,84,25,false,muted);
  slide.speakerNotes.text='50 s. No confundir receptores HLS con jugadores ni usuarios virtuales con ejecuciones simultáneas de Lambda. La primera prueba de clasificación con pausas fijas de seis segundos encontró throttling y se conserva. El video es 640x360 a 800 kbps, servido desde S3 privado por CloudFront, sin transmisión en vivo ni decodificador. Fuentes: evidence/aws-load/hls-500 y leaderboard-500-paced. Modelo de persistencia: serverless/README.md.';

  slide=page(p,'Costo del experimento',7);
  text(slide,'USD 0',64,178,455,100,78,true,teal);
  text(slide,'de cobro al conservar\nel plan FREE activo',64,300,435,110,30);
  text(slide,'Los servicios consumen créditos.\nEl plan termina al vencer\no agotar el saldo.',64,454,430,110,24,false,muted);
  table(slide,[['Escenario','USD/h fijo'],...data.costs.scenarios.map(x=>[`${x.nodes} nodos`,Number(x.fixed_hour).toFixed(3)])],560,160,656,350,[400,256]);
  text(slide,'Precios de lista antes de créditos. Incluye EKS, ALB, discos e IPv4 supuestos. Excluye tráfico y servicios variables.',560,543,640,104,21,false,muted);
  slide.speakerNotes.text='50 s. La condición de cero cobro depende del plan Free, no de que EKS sea gratuito. Nunca cambiar a Paid. El costo fijo es un modelo, no una factura. La red puede dominar el costo. 20,000 espectadores a 6 Mbps representan 120 Gbit/s y 54,000 GB/h. Una tarifa uniforme de referencia de 0.085 USD/GB daría 4,590 USD/h antes de franquicias y descuentos, solo una extrapolación. Fuentes oficiales: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html ; https://aws.amazon.com/eks/pricing/ ; https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ ; https://aws.amazon.com/vpc/pricing/ . Cálculo: evidence/aws/integrator-costs.json.';

  slide=page(p,'Demostración y siguientes pasos',8);
  text(slide,data.game_url,64,160,1152,54,29,true,teal);
  text(slide,'Una partida pública y su clasificación\nEl tablero del periodo medido\nLa versión del commit y su plan en el PR',64,270,1140,205,35);
  text(slide,'Antes de producción: un SLO de ingreso y RTT, menos tráfico de estado y una admisión que controle la sobrecarga.',64,525,1110,100,26,false,muted);
  slide.speakerNotes.text='55 s de cierre más 160 s de demostración guiada, para un total de diez minutos. Abrir juego y modo, volver al menú y clasificación. Mostrar Grafana mediante port-forward y el periodo de la rampa guardado en la captura. Abrir ejecución verde y PR con plan. Si la demostración en vivo falla, usar JSON y captura preservados e informar el fallo, sin inventar una ejecución. La aprobación humana del PR y aceptación de la adaptación del videojuego siguen a cargo del equipo. Guion: docs/GUION_INTEGRADOR.md.';
  return {slides:p.slides.items.length};
}
