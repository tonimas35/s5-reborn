# Integración con Valetudo

El ESP32 no toca el firmware del robot. Se limita a **leer su estado** a través de Valetudo y actuar en consecuencia.

## Opción A: API REST (la más sencilla)

```
GET http://<ip-del-robot>/api/v2/robot/state/attributes
```

Devuelve una lista de atributos. Los que nos interesan son:

- `StatusStateAttribute.value`: `idle`, `cleaning`, `returning`, `docked`, `paused`, `error`, `manual_control`, `moving`…
- `BatteryStateAttribute.level`: porcentaje de batería.

El ESP32 consulta cada 1–2 s y decide.

## Opción B: MQTT

Valetudo puede publicar su estado en un broker MQTT (Ajustes → Conectividad → MQTT). Es útil si más adelante entra en juego Home Assistant: el ESP32 se suscribe al tema de estado y recibe los cambios al instante, sin consultar.

## Habitación actual

Para dosificar el agua por zonas (más en la cocina, menos en el parqué), el ESP32 necesita saber dónde está el robot. Valetudo publica el mapa con la posición del robot y los segmentos. Una opción es hacer ese cálculo en un script dentro del propio robot (hay acceso root) y que solo le pase al ESP32 el ID de la habitación.
