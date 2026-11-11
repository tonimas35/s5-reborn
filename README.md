# s5-reborn

Segunda vida para el **Roborock S5** (S50/S51/S55, modelo `S502-00`): un robot de 2018–2019 comprado de segunda mano, liberado de la nube con [Valetudo](https://valetudo.cloud) y mejorado poco a poco con un módulo propio basado en **ESP32**.

La idea es sencilla: no reescribir lo que ya funciona (navegación, SLAM, motores y sensores siguen siendo los del firmware oficial) y **construir encima** lo que al S5 le falta respecto a un robot actual.

## Estado

| Versión | Qué incluye | Estado |
|---|---|---|
| **v1** | Robot de segunda mano revisado, rooteado con Dustfab, Valetudo sin nube, copia de fábrica | ✅ Hecho (nov 2026) |
| **v2** | Módulo ESP32: mopas giratorias, bomba de agua controlada, elevación de mopa en alfombras, avisos | 🛠️ En diseño |
| **v3** | Base que lava las mopas | 💭 Idea |
| **v4** | Autovaciado | 💭 Idea |

El plan detallado, paso a paso, está en el [ROADMAP](ROADMAP.md).

## Estructura

```
docs/         Guías paso a paso (rooteo, copia de fábrica, wifi y primer mapa)
hardware/     Lista de compra, esquema de conexiones y piezas impresas en 3D
firmware/     Código del ESP32 del módulo de mopa
integration/  Cómo habla el ESP32 con Valetudo (API REST / MQTT)
tools/        Utilidades de diagnóstico
```

## Empieza por aquí

1. [Rootear el S5 e instalar Valetudo](docs/01-rooteo-s5-valetudo.md)
2. [Copia de seguridad de fábrica](docs/02-copia-de-fabrica.md)
3. [Wifi y primer mapa](docs/03-wifi-y-primer-mapa.md)
4. [Lista de compra del módulo v2](hardware/lista-de-compra.md)

## Aviso

Rootear un robot anula su garantía y siempre existe algún riesgo. Este repo documenta lo que funcionó con **una** unidad concreta; compruébalo todo con la [documentación oficial de Valetudo](https://valetudo.cloud) antes de seguirlo.

Este proyecto no está afiliado a Roborock, Xiaomi ni Valetudo.

## Licencia

[MIT](LICENSE)
