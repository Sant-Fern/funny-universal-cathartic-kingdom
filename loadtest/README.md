# Prueba local de integración y plan de carga

`smoke.py` usa las rutas HTTP y WebSocket públicas. Se ejecuta contra una instancia de prueba vacía y no necesita importar el código del juego. Usa `httpx` y `websockets` de `server/requirements.txt`.

Con el entorno de Python del proyecto ya instalado, ejecutar en PowerShell desde la raíz:

```powershell
# Con npm run dev, en una instalación dedicada para pruebas
.\.venv\Scripts\python.exe loadtest/smoke.py --url http://127.0.0.1:5173 --check-web

# Con Docker Compose y su proxy Nginx
docker compose up --build --wait
.\.venv\Scripts\python.exe loadtest/smoke.py --check-web
docker compose down
```

Por defecto la prueba abre dos conexiones en Carrera de torre. Valida 1 humano/9 bots y luego 2 humanos/8 bots, los diez espacios y la asignación que corresponde al modo, el intercambio de controles y respuestas y el regreso de un bot cuando se desconecta un cliente. Con `--players 10 --mode eliminations` también se puede probar una sala llena de conexiones simuladas. `--output ruta.json` conserva las muestras de RTT, cantidad de controles y snapshots y tiempo desde la petición de entrada hasta `welcome`. El archivo debe ser nuevo. La prueba termina con un código distinto de cero si falla.

El flujo de GitHub Actions ejecuta la prueba contra Nginx después de construir y arrancar Compose. Conserva el JSON como artefacto si pasa y apaga los contenedores al terminar.

La prueba comprueba una sala; el RTT local mide el recorrido de ida y vuelta entre el cliente de prueba y esa instalación. No acredita capacidad de la nube, RTT de jugadores remotos ni escalado. Para la prueba de capacidad faltan la asignación de varias salas, generadores de carga independientes y métricas de infraestructura. El objetivo del plan es 1 000 conexiones simuladas distribuidas entre salas, además de una prueba separada de HLS con 500 espectadores. Los bots internos no cuentan en esas cifras.
