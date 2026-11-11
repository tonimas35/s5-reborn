# Lista de compra: módulo de mopa v2

Precios orientativos de noviembre de 2026 (AliExpress/Amazon). Ya tengo: ESP32, servo SG90, zumbador, cables y protoboard.

## Electrónica

| Pieza | Para qué | Qué buscar | ~€ |
|---|---|---|---|
| Driver de motores | Mopas y bomba | **DRV8833** (2 canales, 1,5 A/canal) | 1–2 |
| 2× micromotor | Girar las mopas | **N20 6 V, 150–200 rpm** | 4–6 |
| Minibomba | Agua dosificada | **Bomba peristáltica 5 V** (con cable) | 4–7 |
| Convertidor DC-DC ×2 | Bajar los 14,4 V de la batería a 5 V | **LM2596** o **Mini560**, ≥3 A. Uno para potencia y otro para lógica | 2–4 |
| Portafusibles + fusible 2 A | Protección de la toma de batería | Portafusibles en línea | 1–2 |
| *Opcional:* sensor ultrasónico | Detectar alfombras | **HC-SR04**, con divisor de tensión en ECHO | 1–2 |

**Truco:** los dos motores van **al mismo canal** del DRV8833, uno con la polaridad invertida, para que giren en sentidos opuestos como en los robots comerciales. El segundo canal queda para la bomba.

## Mecánica

| Pieza | ~€ |
|---|---|
| 2 mopas redondas de microfibra con velcro (mide el diámetro antes de diseñar los discos) | 3–6 |
| Tubo de silicona de 2–3 mm, 1 m | 1–2 |
| Cable de silicona 22 AWG, termorretráctil, tornillería M2/M3 | 3–5 |
| PETG para discos, soporte y elevación | — |

**Total estimado: 20–37 €.**

## Puesta a punto del robot (aparte)

- Batería 14,4 V 5200 mAh `BRR-2P4S-5200S`, solo si la prueba de autonomía sale mal: 30–45 €.
- Kit de cepillos y filtros S5: 5–20 €.
