# Firmware del módulo de mopa (ESP32)

## Banco de pruebas v0: `mopa_esp32/`

Primer paso del módulo: el ESP32 se conecta al wifi, pregunta a Valetudo el estado del robot cada 2 s y **baja la mopa (servo) cuando el robot limpia** y la sube en cualquier otro caso.

- **Fallo seguro:** si pierde el contacto con el robot durante unos 10 s, sube la mopa.
- **Página web propia** en `http://mopa-s5.local` (o en su IP): muestra el estado y tiene botones para bajar o subir la mopa a mano y para pasar a modo manual.
- **Configuración sin tocar código:** la primera vez (o si no encuentra el wifi) crea la red **`Mopa-S5-config`**. Conéctate con el móvil, elige tu wifi, escribe la contraseña y la IP del robot. Se guarda en la memoria del ESP32; nada sensible va en el código.

### Conexiones (servo SG90)

| Cable del servo | Pin del ESP32 |
|---|---|
| Marrón | GND |
| Rojo | 5V / VIN |
| Naranja | GPIO18 |

El LED de la placa (GPIO2) parpadea mientras conecta y se queda fijo cuando habla con el robot.

### Compilar y grabar

Con Arduino IDE 2 y el soporte **esp32 de Espressif 3.x**: abre `mopa_esp32.ino`, elige la placa *ESP32 Dev Module* y súbelo.

O con `arduino-cli`:

```sh
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/mopa_esp32
arduino-cli upload  --fqbn esp32:esp32:esp32 -p COM5 firmware/mopa_esp32
```

## Asignación de pines (v2 completa)

Se evitan los pines de arranque (0, 2, 12 y 15) y los de solo entrada (34–39) para las salidas.

| Función | Pin | Notas |
|---|---|---|
| DRV8833 AIN1 (mopas) | GPIO25 | PWM |
| DRV8833 AIN2 (mopas) | GPIO26 | PWM |
| DRV8833 BIN1 (bomba) | GPIO27 | PWM |
| DRV8833 BIN2 (bomba) | GPIO14 | Fijo a LOW |
| DRV8833 nSLEEP | GPIO13 | HIGH para activar |
| Servo de elevación (SG90) | GPIO18 | 50 Hz |
| Zumbador | GPIO19 | |
| HC-SR04 TRIG (opcional) | GPIO22 | |
| HC-SR04 ECHO (opcional) | GPIO23 | ⚠️ Divisor 5 V → 3,3 V |

## Comportamiento previsto (v2)

| Estado de Valetudo | Mopas | Bomba | Elevación |
|---|---|---|---|
| `cleaning` | Giran | Pulsos según la zona | Bajada (subida en alfombra) |
| `returning` / `docked` / `idle` | Paradas | Parada | Subida |
| `error` / `paused` | Paradas | Parada | Subida + pitido |

### Configurar el wifi sin acercarse al ESP32

Si el ESP32 está enchufado al PC y no puedes acercarte a su red `Mopa-S5-config`, puedes configurarlo desde el móvil a través del robot:

1. Copia [`tools/mopa-wifi-form`](../tools/mopa-wifi-form/) compilado para ARMv7 al robot y arráncalo: `/tmp/mopa-wifi-form &`. Escucha en el puerto 8081, propone el wifi del robot y se cierra solo tras un envío o a los 20 minutos.
2. Desde el móvil, abre `http://<IP del robot>:8081` y escribe la contraseña. Se guarda en la RAM del robot (`/tmp`), con permisos 600.
3. En el PC, ejecuta [`tools/mopa-wifi-usb.ps1`](../tools/mopa-wifi-usb.ps1). Recoge la configuración por SSH, la borra del robot y se la envía al ESP32 por USB con el comando `SETWIFI`. La contraseña no se muestra en pantalla.
