# Roadmap

Cada fase deja el robot **mejor que antes y funcionando**. Si el proyecto se para en cualquier punto, mi madre sigue teniendo un robot que limpia.

Leyenda: ✅ hecho · 🔜 siguiente · ⬜ pendiente · ❓ por decidir

---

## Fase 0: Base del proyecto ✅ (11 nov 2026)

- ✅ Comprar un Roborock S5 de segunda mano (39 €, Wallapop)
- ✅ Rootear con Dustfab (firmware 2008; la 2034 falla al 55 %) e instalar Valetudo 2026.10.0
- ✅ Copia de seguridad de fábrica (`mmcblk0p5/6/11`), verificada
- ✅ Repo `s5-reborn` con la guía de rooteo, la lista de compra y el plan del módulo
- ✅ Prototipo visual de la app con el mapa 3D

## Fase 1: Entrega en Reus (versión 1) 🛠️ casi lista (14 nov)

**Objetivo:** que el robot funcione en casa de mi madre, tal cual, con Valetudo.

- ✅ Limpiar el cepillo principal y la entrada al depósito (estaba medio tapada de pelusa)
- ✅ Conectarlo al wifi de casa sin cambiar la contraseña del router, aunque lleva `#` → [cómo](docs/03-wifi-y-primer-mapa.md)
- ✅ *Persistent maps* + borrar el mapa de Barcelona + primera limpieza completa: **53 min, 50 m², sin atascos**
- ✅ Habitaciones: Valetudo creó 8 solas; divididas y renombradas a 11 (comedor, cocina, entrada y pasillo, pasillo 2, tendedor, baño 1, baño 2, matrimonio, hijo 1, hijo 2, despacho)
- ✅ IP del robot reservada en el Livebox (`192.168.1.23`) y apuntada en el manual
- ✅ **Autonomía:** ~1 %/min en potencia Normal → unos 75–80 min por carga. Con recarga a mitad, sigue solo
- ✅ La app instalada en la pantalla de inicio de su iPhone y funcionando (15 nov)
- ✅ Puertas dibujadas por mí sobre el plano: bordes de la cocina ajustados a sus puertas. Paredes invisibles delante del armario de espejos del comedor y del espejo de la entrada (15 nov)
- ✅ Primera prueba suya: «limpiar la cocina» salía al comedor. El borde de la cocina incluía una franja del comedor; dividida y unida al comedor (15 nov)
- 🛠️ Programar una limpieza automática: **programador en la app** instalado (15 nov), con días, hora y habitaciones. Usa los temporizadores de Valetudo y corrige solo el cambio de hora. Falta que ella elija día y hora
- ⬜ Probar el fregado de serie (depósito + paño) → manual, pestaña «El robot»
- ⬜ Probar el servo de la mopa con el ESP32 y reservar su IP → [firmware v0](firmware/README.md)
- ⬜ Apuntar la **lista de quejas de mamá**. De momento, en Barcelona: un atasco del cepillo grande (pelos) y el parachoques bloqueado junto a la base

**Listo cuando:** limpia la casa entera sola, vuelve a la base y mi madre sabe ponerlo en marcha.

## Fase 2: Puesta a punto ⬜

- ✅ Batería: **no hace falta cambiarla** (75–80 min de autonomía, el límite era 40)
- ⬜ Kit de cepillo de goma, cepillo lateral y filtros (el cepillo grande está gastado)
- ⬜ Revisar ruedas, rueda delantera y que el parachoques no se quede hundido

**Coste:** 10–20 €.

## Fase 3: App para mamá 🛠️ (en marcha desde el 12 nov)

**Objetivo:** sustituir la interfaz técnica de Valetudo por la app del prototipo: modo claro, mapa 3D y botones grandes.

| Paso | Qué | Estado |
|---|---|---|
| 3.1 | Leer el mapa de Valetudo y su formato | ✅ Probado con los mapas reales de Barcelona y Reus |
| 3.2 | Renderizarlo en **three.js** | ✅ Encuadre automático de la casa real |
| 3.3 | Robot y estela en directo, zoom, giro | ✅ Probado limpiando de verdad |
| 3.4 | Acciones: limpiar todo, habitaciones, volver, pausa, potencia, "¿dónde estás?" | ✅ Probadas con el robot real |
| 3.5 | Mensajes en castellano llano para los errores | ✅ Probados con errores reales (cepillo, parachoques) |
| 3.6 | Servidor en Go en el robot con arranque automático | ✅ Sobrevive a reinicios |
| 3.7 | Instalarla en el iPhone de mi madre: Safari → Compartir → «Añadir a pantalla de inicio» | ✅ 15 nov |
| 3.8 | 🛠️ **Capa de muebles:** detección automática de zonas candidatas ([tools/muebles](tools/muebles/detectar.py)) + página para etiquetarlas (mesa, cama, sofá…) o dibujar las que falten | Todas las zonas revisadas |
| 3.9 | 🛠️ Muebles en 3D en la app y botón «Limpiar debajo de la mesa» (limpieza por zona, con 25 cm de margen para las sillas). Instalado el 15 nov; los muebles salen de [exportar.py](tools/muebles/exportar.py) → `/mnt/data/muebles.json` | Mi madre lo usa después de comer |
| 3.10 | Detección de cambios: comparar cada mapa nuevo con el etiquetado y marcar **«objeto no identificado»** | Avisa cuando aparece algo nuevo |
| 3.11 | Aprender de los choques: guardar dónde frena y da marcha atrás en cada limpieza y, si se repite, proponer una pared invisible (p. ej. el armario de espejos del comedor) | La app propone la pared y mamá la acepta |

**Fallos encontrados probando con el robot real (12–14 nov), todos corregidos:** botones que se rehacían cada 2 s y perdían toques · Valetudo responde «OK» en texto y la app mostraba error en cada orden · aviso de «sin conexión» intermitente por los cortes de wifi al limpiar lejos del router · al recargar a mitad decía «la casa está tranquila» en vez de «cargando para seguir» · el mapa no se encuadraba al crecer · «Stuck front bumper» salía como «atascado» · habitaciones sin nombre todas iguales y distintas entre lista y mapa.

**Decisiones tomadas:** servidor propio en Go en el puerto 8080 que también hace de proxy de `/api` (Valetudo no envía cabeceras CORS), y three.js y las fuentes empaquetados dentro del binario, para que funcione sin internet. Ver [app/](app/README.md).

## Fase 4: Acceso remoto ✅ (12 nov)

**Objetivo:** poder revisar y actualizar el robot desde Barcelona.

- ✅ Tailscale 1.104.6 funcionando en el robot, con arranque automático → [guía](docs/04-acceso-remoto.md). Probado desde el móvil con 5G y desde Reus.
- ⬜ Avisos al móvil si el robot se queda atascado o da error

## Fase 5: Módulo de mopa con ESP32 (versión 2) ⬜ (1–2 meses)

**Objetivo:** fregado de gama media: mopas giratorias, agua dosificada y mopa que se levanta en las alfombras.

| Paso | Qué | Listo cuando |
|---|---|---|
| 5.1 | Comprar las piezas → [lista](hardware/lista-de-compra.md) | Todo recibido |
| 5.2 | 🛠️ **Banco de pruebas** en la mesa: ESP32 + servo con el robot real ([firmware v0](firmware/README.md)); faltan DRV8833, motores y bomba | Cada pieza responde desde el ESP32 |
| 5.3 | Firmware: leer el estado de Valetudo por REST y aplicar la lógica de [firmware/](firmware/README.md) | Las mopas se paran y se levantan solas al volver a la base |
| 5.4 | Mecánica en 3D: discos, soporte de motores y elevación ([boceto](hardware/modulo-mopa-boceto.png)) | Encaja bajo el robot y pasa por debajo de los muebles |
| 5.5 | Alimentación desde la batería del robot, con fusible y convertidores | Funciona sin pilas aparte |
| 5.6 | Pruebas de 1–2 semanas **en mi casa** | Sin fugas, sin atascos, autonomía aceptable |
| 5.7 | Instalarlo en Reus en una visita: quitar el depósito original, cable con fusible a la batería, enganchar el módulo | Mi madre lo usa a diario |

**Coste:** 20–37 €. Impresora 3D: tengo acceso a una.

## Fase 6: Base que lava (versión 3) ⬜

Bandeja con estrías + bomba de agua limpia + bomba de agua sucia + ventilador de secado, gobernados por un ESP32 al detectar "robot en la base".

## Fase 7: Autovaciado (versión 4) ⬜

Depósito impreso con compuerta inferior, junta, rampa de alineado y motor de aspiración de una base de segunda mano. Es la fase más difícil, porque hay que modificar el chasis.

## Fase 8: Publicar ⬜

- ⬜ Documentación en inglés, con fotos y un vídeo
- ⬜ Compartirlo en r/valetudorobotusers y en foros de makers
- ⬜ Plantear el módulo como **kit de mejora para robots viejos**

---

## Decisiones (12–14 nov)

- Impresora 3D: sí, tengo acceso a una.
- Móvil de mi madre: **iPhone**. La app se instala desde Safari como app web.
- Router de su casa: tengo acceso. Se puede reservar IP para el robot y el ESP32.
- Primera visita a Reus: **sábado 14 nov**. Router de casa: Livebox 6 de Orange.
