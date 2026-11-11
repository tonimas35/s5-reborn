# Firmware del módulo de mopa (ESP32)

> 🛠️ En diseño. Aquí irá el código del ESP32 (Arduino o ESPHome).

## Placa

ESP32 clásico (`ESP32-D0WD-V3`, AZ-Delivery con CP2102 y USB-C). Probado con Arduino IDE y el core `esp32`.

## Asignación de pines propuesta

Se evitan los pines de arranque (0, 2, 12 y 15) y los de solo entrada (34–39) para las salidas.

| Función | Pin | Notas |
|---|---|---|
| DRV8833 AIN1 (mopas) | GPIO25 | PWM |
| DRV8833 AIN2 (mopas) | GPIO26 | PWM |
| DRV8833 BIN1 (bomba) | GPIO27 | PWM |
| DRV8833 BIN2 (bomba) | GPIO14 | Fijo a LOW (la bomba gira en un solo sentido) |
| DRV8833 nSLEEP | GPIO13 | HIGH para activar |
| Servo de elevación (SG90) | GPIO18 | 50 Hz |
| Zumbador | GPIO19 | |
| HC-SR04 TRIG (opcional) | GPIO22 | |
| HC-SR04 ECHO (opcional) | GPIO23 | ⚠️ Divisor 5 V → 3,3 V |

## Comportamiento previsto

| Estado de Valetudo | Mopas | Bomba | Elevación |
|---|---|---|---|
| `cleaning` | Giran | Pulsos según la zona | Bajada (subida en alfombra) |
| `returning` / `docked` / `idle` | Paradas | Parada | Subida |
| `error` / `paused` | Paradas | Parada | Subida + pitido |

Fallo seguro: si el ESP32 pierde la conexión con Valetudo más de 10 s, **para la bomba y levanta la mopa**.
