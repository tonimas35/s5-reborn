# App para mamá

Interfaz sencilla sobre Valetudo, servida **desde el propio robot** en el puerto 8080:
mapa 3D (three.js), botones grandes, mensajes en castellano llano y modo claro.

```
src/        Código de la app (main.js, mapa 3D, cliente de la API, modo demo)
static/     index.html, estilos, iconos y manifest (instalable en el móvil)
server/     Servidor en Go: incrusta la app y hace de proxy de /api hacia Valetudo
deploy/     Script de arranque del robot (S12s5app) y vigilante (run.sh)
```

## Compilar

Hace falta Node 18+ y Go 1.24+.

```sh
cd app
npm install
npm run build                       # genera server/web/
cd server
CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -trimpath -ldflags "-s -w" -o ../dist/s5app .
```

El binario `dist/s5app` (~7 MB) lleva toda la app dentro.

## Instalar en el robot

```sh
ssh root@ROBOT "mkdir -p /mnt/data/s5app"
scp -O dist/s5app deploy/run.sh deploy/S12s5app root@ROBOT:/mnt/data/s5app/
ssh root@ROBOT "cd /mnt/data/s5app && chmod +x s5app run.sh S12s5app && cp S12s5app /etc/init/ && /etc/init/S12s5app restart"
```

Desde Windows puedes usar [`tools/deploy-app.ps1`](../tools/deploy-app.ps1).

Abre `http://IP-DEL-ROBOT:8080` en el móvil y, desde el menú del navegador, elige **Añadir a pantalla de inicio**.

> `/etc/init/S12s5app` está en la partición del sistema: si algún día se reinstala el firmware, hay que volver a copiarlo. La app en sí vive en `/mnt/data`, que se conserva.

## Modo demo

`http://IP-DEL-ROBOT:8080/?demo` muestra una casa de ejemplo con un robot simulado que limpia de verdad en pantalla. `?demo=error` enseña el aviso de atasco.

## Qué usa de Valetudo

| Para | Endpoint |
|---|---|
| Estado, batería, potencia | `GET /api/v2/robot/state/attributes` |
| Mapa (habitaciones, paredes, robot, base, recorrido) | `GET /api/v2/robot/state/map` |
| Limpiar, pausar, volver a la base | `PUT …/BasicControlCapability` |
| Limpiar habitaciones | `PUT …/MapSegmentationCapability` |
| "¿Dónde estás?" | `PUT …/LocateCapability` |
| Potencia | `PUT …/FanSpeedControlCapability/preset` |
| Tiempo y superficie | `GET …/CurrentStatisticsCapability` |
| Mantenimiento | `GET …/ConsumableMonitoringCapability` |
