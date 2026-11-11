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

## Fase 1: Entrega en Reus (versión 1) 🔜 este finde

**Objetivo:** que el robot funcione en casa de mi madre, tal cual, con Valetudo.

- ⬜ Antes de salir: limpiar el cepillo principal y dejarlo cargando
- ⬜ Conectarlo al wifi de casa (2,4 GHz) → [guía](docs/03-wifi-y-primer-mapa.md)
- ⬜ Activar *Persistent maps* y hacer la primera *Full Cleanup* con las puertas abiertas
- ⬜ Revisar los *Segments* y poner nombre a las habitaciones
- ⬜ Programar una limpieza automática (día y hora a elegir con ella)
- ⬜ Reservar la IP del robot en el router, si tengo acceso
- ⬜ **Medir la autonomía** en la primera limpieza
- ⬜ Apuntar la **lista de quejas de mamá**: dónde se atasca, qué zonas no limpia bien, qué le resulta difícil

**Listo cuando:** limpia la casa entera sola, vuelve a la base y mi madre sabe ponerlo en marcha.

## Fase 2: Puesta a punto ⬜ (semana siguiente)

- ⬜ Batería nueva `BRR-2P4S-5200S`, **solo si** la autonomía es menor de 40 min
- ⬜ Kit de cepillo de goma, cepillo lateral y filtros
- ⬜ Revisar ruedas y la rueda delantera

**Coste:** 5–65 €, según la batería.

## Fase 3: App para mamá ⬜ (2–3 semanas)

**Objetivo:** sustituir la interfaz técnica de Valetudo por la app del prototipo: modo claro, mapa 3D y botones grandes.

| Paso | Qué | Listo cuando |
|---|---|---|
| 3.1 | Leer el **mapa real** de Valetudo (`/api/v2/robot/state/map`) y entender su formato | Tengo un volcado JSON del mapa de Reus |
| 3.2 | Renderizarlo en **three.js**: suelo por habitaciones, paredes levantadas, luz suave | El mapa 3D muestra la casa real |
| 3.3 | Robot y estela en directo, zoom, giro con dos dedos y doble toque en una habitación | Se mueve fluido en el móvil |
| 3.4 | Acciones: limpiar todo, limpiar habitaciones, volver a la base, pausa | Funciona contra el robot real |
| 3.5 | Mensajes en castellano llano (atascado, depósito lleno, batería baja…) | Cada error de Valetudo tiene su mensaje |
| 3.6 | Servirla **desde el propio robot** y que arranque sola | Sobrevive a un reinicio |
| 3.7 | Instalarla en el móvil de mi madre como app (PWA) | Ella la abre sin ayuda |

**Decisiones técnicas abiertas:**
- ❓ Puerto y servidor web dentro del robot (Valetudo ya ocupa el 80). Opción: un servidor pequeño en otro puerto que también haga de proxy de `/api`, para evitar problemas de CORS.
- ❓ Llevar three.js empaquetado dentro de la app, sin CDN, para que funcione sin internet.

## Fase 4: Acceso remoto ⬜

**Objetivo:** poder revisar y actualizar el robot desde Barcelona.

- ❓ Probar si Tailscale funciona en el S5 (kernel antiguo). Plan B: un dispositivo pequeño en su casa.
- ⬜ Avisos al móvil si el robot se queda atascado o da error

## Fase 5: Módulo de mopa con ESP32 (versión 2) ⬜ (1–2 meses)

**Objetivo:** fregado de gama media: mopas giratorias, agua dosificada y mopa que se levanta en las alfombras.

| Paso | Qué | Listo cuando |
|---|---|---|
| 5.1 | Comprar las piezas → [lista](hardware/lista-de-compra.md) | Todo recibido |
| 5.2 | **Banco de pruebas** en la mesa: ESP32 + DRV8833 + motores + bomba + servo | Cada pieza responde desde el ESP32 |
| 5.3 | Firmware: leer el estado de Valetudo por REST y aplicar la lógica de [firmware/](firmware/README.md) | Las mopas se paran y se levantan solas al volver a la base |
| 5.4 | Mecánica en 3D: discos, soporte de motores y elevación | Encaja bajo el robot y pasa por debajo de los muebles |
| 5.5 | Alimentación desde la batería del robot, con fusible y convertidores | Funciona sin pilas aparte |
| 5.6 | Pruebas de 1–2 semanas **en mi casa** | Sin fugas, sin atascos, autonomía aceptable |
| 5.7 | Instalarlo en Reus | Mi madre lo usa a diario |

**Coste:** 20–37 €. ❓ Necesito una impresora 3D o acceso a una.

## Fase 6: Base que lava (versión 3) ⬜

Bandeja con estrías + bomba de agua limpia + bomba de agua sucia + ventilador de secado, gobernados por un ESP32 al detectar "robot en la base".

## Fase 7: Autovaciado (versión 4) ⬜

Depósito impreso con compuerta inferior, junta, rampa de alineado y motor de aspiración de una base de segunda mano. Es la fase más difícil, porque hay que modificar el chasis.

## Fase 8: Publicar ⬜

- ⬜ Documentación en inglés, con fotos y un vídeo
- ⬜ Compartirlo en r/valetudorobotusers y en foros de makers
- ⬜ Plantear el módulo como **kit de mejora para robots viejos**

---

## Preguntas abiertas

- ❓ ¿Impresora 3D propia o de alguien?
- ❓ ¿El móvil de mi madre es iPhone o Android? Afecta a cómo se instala la app.
- ❓ ¿Tengo acceso al router de su casa?
- ❓ ¿Cada cuánto voy a Reus? Marca el ritmo de las instalaciones.
