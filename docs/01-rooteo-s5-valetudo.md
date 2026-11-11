# 1. Rootear el Roborock S5 e instalar Valetudo (OTA, sin abrirlo)

Guía de lo que funcionó el 11/11/2026 con un **Roborock S5 `S502-00`** (versión EU, fabricado en febrero de 2019) desde un PC con **Windows**.

Método: **OTA local**. No hay que desmontar ni soldar nada; los precintos quedan intactos.

## Qué necesitas

- El robot cargado al 100 % y en su base.
- Un PC con wifi. Si además tiene internet por cable, mejor: así no pierdes la conexión al conectarte a la red del robot.
- Un clip para el botón de Reset.
- [`valetudo-helper-miioota.exe`](https://github.com/Hypfer/valetudo-helper-miioota/releases) (versión `2022.08.0`).
- Una clave SSH propia:
  ```powershell
  ssh-keygen -t rsa -b 4096 -C "mi-roborock-s5" -f clave_robot
  ```
  Genera `clave_robot` (**privada, no la compartas**) y `clave_robot.pub` (pública).

## Paso 1: generar el firmware rooteado en Dustfab

El antiguo DustBuilder (`builder.dontvacuum.me`) ha sido sustituido por **[Dustfab](https://fab.valetudo.cloud/)**. Si el antiguo no carga, no es tu conexión: usa Dustfab.

1. Builder → **Roborock** → **S5**. No elijas el S5 Max ni el S5e, que son otros robots.
2. **Base firmware: S5 (ver 2008, 12/2019)**.
   > ⚠️ La 2034 ("latest") se descargó bien pero **falló al instalar, al 55 %** (`miIO.get_ota_state = failed`). Otros usuarios del S50 han visto lo mismo. Con la 2008 funcionó a la primera, y ya incluye la división del mapa en habitaciones.
3. **Output format: OTA update**. Viene marcado "Installer package" por defecto: cámbialo.
4. Actions: deja marcadas **Disable Cloud**, **Additional tools** y **Valetudo**.
5. SSH access → **LOAD FROM FILE** → `clave_robot.pub`.
6. **QUEUE BUILD**. Tarda alrededor de un minuto. Descarga el `v11_002008.pkg` y comprueba su MD5 con el `md5.txt`:
   ```powershell
   (Get-FileHash v11_002008.pkg -Algorithm MD5).Hash.ToLower()
   ```

## Paso 2: reset de fábrica (imprescindible)

Si el robot ha estado alguna vez conectado a la app de Xiaomi o Roborock, su firmware **bloquea la instalación local**. El síntoma es que el instalador falla con `Error decrypting/parsing: Unexpected end of JSON input` y `MiioTimeoutError ... miIO.ota`. El reset de fábrica lo devuelve a su firmware de fábrica, que sí acepta la instalación.

Botones del S5, de izquierda a derecha: **spot** (cuadradito), **encendido** (centro) y **recarga** (icono de **enchufe**). El de recarga **no** tiene forma de casa.

1. Robot **encendido** y en la base. Quítale el depósito de agua.
2. Mantén pulsado el botón del **enchufe** y **no lo sueltes** en todo el proceso.
3. Sin soltarlo, aprieta con un clip el **Reset**, bajo la tapa. Es el puntito **entre las palabras "WiFi" y "Reset"**; el de la izquierda es la luz de wifi. Mantenlo hasta que **se apaguen las luces** de los botones y suelta el clip.
4. **Sigue con el enchufe pulsado** hasta que el robot hable o toque su musiquita de arranque.
5. Espera unos 5 minutos.

> Si mantienes el botón del **centro** en lugar del enchufe, dirá "turning off". Si solo dice "charging", es que el Reset no ha llegado a pulsarse.

Después, para que cree su propia red wifi: pulsa **spot + enchufe** a la vez durante 3–5 s, hasta que diga "Reset WiFi". Aparecerá la red `roborock-vacuum-s5_miapXXXX`.

## Paso 3: instalar

1. **Desconecta cualquier VPN.**
2. Conecta el wifi del PC a la red del robot. Tendrás una IP `192.168.8.x`; el robot es `192.168.8.1`.
3. **Desactiva temporalmente el firewall de "Red pública"** en Seguridad de Windows. La red del robot entra como pública, y Windows bloquea que el robot descargue el firmware de tu PC (`ERROR: Did not receive a firmware download request after 30s`).
4. Ejecuta:
   ```powershell
   .\valetudo-helper-miioota.exe install-firmware v11_002008.pkg
   ```
   Lo esperado es:
   ```
   Successfully discovered robot at 192.168.8.1
   Response from robot: [ 'ok' ]
   Received firmware download request from ::ffff:192.168.8.1..
   Download seems to have finished.
   ```
5. **Vuelve a activar el firewall.**
6. **No toques el robot durante 10 minutos.** Dirá que está actualizando el firmware y, al terminar, que ha ido bien.

Para ver el progreso sin esperar a ciegas, usa [`tools/miio-status.ps1`](../tools/miio-status.ps1). Debe pasar de `installing | 100` a reiniciarse.

## Paso 4: comprobar

```powershell
Invoke-WebRequest http://192.168.8.1/api/v2/valetudo/version -UseBasicParsing
ssh -i clave_robot -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa root@192.168.8.1 "cat /build.txt"
```

Abre **http://192.168.8.1** en el navegador y verás el asistente de Valetudo.

Siguiente paso: [copia de seguridad de fábrica](02-copia-de-fabrica.md).
