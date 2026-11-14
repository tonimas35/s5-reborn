# 3. Wifi y primer mapa

## Conectarlo al wifi de casa

1. Si el robot no tiene su propia red activa, pulsa **spot + enchufe** durante 3–5 s, hasta que diga "Reset WiFi".
2. Con el móvil o el PC, conéctate a `roborock-vacuum-s5_miapXXXX` y abre **http://192.168.8.1**.
3. Pulsa "Press to scan", elige la red de casa y escribe la contraseña. Luego, **APPLY**.
   > El S5 **solo funciona en 2,4 GHz**. Si el router separa las redes, elige la que **no** acaba en "5G".
4. El robot se conecta a tu red y aparece con una IP nueva. Para encontrarlo, mira la lista de dispositivos del router o lanza este escaneo desde un PC de la misma red:
   ```powershell
   $pre = "192.168.0"   # ajústalo a tu red
   1..254 | ForEach-Object { try { $r = Invoke-WebRequest "http://$pre.$_/api/v2/valetudo/version" -UseBasicParsing -TimeoutSec 1; "$pre.$_ -> $($r.Content)" } catch {} }
   ```
   Te recomiendo **reservarle esa IP en el router** para que no cambie.

## Primer mapa

1. Despeja el suelo (cables, calcetines…), **abre todas las puertas** y deja el robot en la base.
2. En Valetudo, activa **Persistent maps**. Así el robot recuerda el mapa entre limpiezas, y puedes usar habitaciones, zonas prohibidas y paredes virtuales.
3. Pulsa **Full Cleanup → GO**. La primera vuelta limpia toda la casa y, a la vez, crea el mapa.
4. Al terminar, revisa en **Segments** las habitaciones que ha detectado. Puedes unirlas, dividirlas o ponerles nombre.

## Batería

Anota cuánto dura esa primera limpieza (en *Current Statistics*). Como referencia:

- Más de 60 minutos: batería sana.
- Menos de 30–40 minutos: conviene cambiarla. La referencia es `BRR-2P4S-5200S`, de 14,4 V y 5200 mAh.

## Si la contraseña del wifi lleva ; \ / # ' "

Valetudo no deja guardarla («the Password must not contain any of the following characters»). No hace falta cambiar la contraseña del router: en el S5 con firmware 2008 el script de Roborock la maneja bien. Con el robot en modo punto de acceso y el PC conectado a su red, ejecuta [`tools/configurar-wifi-robot.ps1`](../tools/configurar-wifi-robot.ps1) `-Ssid "NombreDelWifi"` y escribe la contraseña en la ventana. Probado en Reus (14/11/2026) con una clave terminada en `#`.

## Habitaciones

Con *Persistent maps* activado **antes** de borrar el mapa, la primera limpieza completa crea las habitaciones sola (en Reus salieron 8). Si una zona junta varias (comedor + cocina + pasillo), se divide con `MapSegmentEditCapability` (`split_segment` con dos puntos en cm) y se renombra con `MapSegmentRenameCapability`. Ojo: al renombrar o dividir, el robot cambia los números internos de las habitaciones.
