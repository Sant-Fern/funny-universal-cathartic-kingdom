# Clip sintético de la prueba HLS

Estos son los segmentos y el manifiesto exactos utilizados en `evidence/aws-load/hls-500/`. Fuente visual propia: `evidence/local/mapa-surrealista.jpg`. Perfil: 640x360, H.264, video objetivo 800 kbps, sin audio, seis segmentos MPEG-TS de cuatro segundos. El transporte agrega sobrecarga al bitrate del video. No es una transmisión de una partida en vivo.

Se conservan los bytes para reproducir el ensayo sin depender de una instalación concreta de FFmpeg. Para otra cuenta: crear primero el bucket privado y la distribución con Terraform; después subir únicamente estos archivos al prefijo `hls/` de ese bucket autorizado.

```powershell
aws s3 cp assets/hls-demo/ s3://TU_BUCKET/hls/ --recursive --exclude '*' --include '*.ts' --content-type video/mp2t --cache-control public,max-age=86400 --sse AES256 --profile TU_PERFIL
aws s3 cp assets/hls-demo/stream.m3u8 s3://TU_BUCKET/hls/stream.m3u8 --content-type application/vnd.apple.mpegurl --cache-control public,max-age=3600 --sse AES256 --profile TU_PERFIL
```

CloudFront OAC obtiene solo el prefijo `hls/`; el bucket mantiene bloqueo de acceso público. La prueba descarga estos segmentos a ritmo de reproducción y modela buffer, sin decodificar cuadros ni simular ABR.
