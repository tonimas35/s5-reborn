/*
  s5-reborn · Módulo de mopa (banco de pruebas v0)

  Qué hace:
  - Se conecta al wifi de casa y pregunta a Valetudo el estado del robot cada 2 s.
  - Si el robot está limpiando, baja la mopa (servo). En cualquier otro estado, la sube.
  - Fallo seguro: si pierde el contacto con el robot más de ~10 s, sube la mopa.
  - Página web propia (http://mopa-s5.local o su IP) para ver el estado y probar a mano.
  - Primera vez (o si no encuentra el wifi): crea la red "Mopa-S5-config". Conéctate con el
    móvil, se abre una página donde eliges tu wifi, escribes la contraseña y la IP del robot.

  Placa: ESP32 (core de Arduino 3.x). Servo SG90:
    marrón -> GND · rojo -> 5V (VIN) · naranja -> GPIO18
*/

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <DNSServer.h>
#include <ESPmDNS.h>

// ---------- Pines ----------
const int SERVO_PIN = 18;
const int LED_PIN = 2;
// Reservados para la v2 (DRV8833): mopas AIN1=25, AIN2=26 · bomba BIN1=27, BIN2=14 · nSLEEP=13

// ---------- Ajustes ----------
const int MOP_DOWN_DEG = 20;          // mopa apoyada en el suelo
const int MOP_UP_DEG = 110;           // mopa levantada
const uint32_t POLL_MS = 2000;        // cada cuánto preguntar al robot
const uint8_t MAX_FAILS = 5;          // 5 fallos seguidos (~10 s) -> subir mopa
const char *AP_NAME = "Mopa-S5-config";
const char *HOSTNAME = "mopa-s5";

WebServer server(80);
DNSServer dns;
Preferences prefs;

String wifiSsid, wifiPass, robotHost;
bool configMode = false;
bool autoMode = true;

String robotStatus = "desconocido";
uint8_t fails = 0;
uint32_t lastPoll = 0;
uint32_t lastOk = 0;

int currentDeg = MOP_UP_DEG;
int targetDeg = MOP_UP_DEG;
uint32_t lastStep = 0;

// ---------- Servo con LEDC (sin librerías) ----------
void servoWriteDeg(int deg) {
  deg = constrain(deg, 0, 180);
  uint32_t us = map(deg, 0, 180, 500, 2400);
  uint32_t duty = (us * 16383UL) / 20000UL; // 14 bits a 50 Hz
  ledcWrite(SERVO_PIN, duty);
}

void servoTick() {
  if (currentDeg == targetDeg || millis() - lastStep < 15) return;
  lastStep = millis();
  currentDeg += (targetDeg > currentDeg) ? 2 : -2;
  if (abs(targetDeg - currentDeg) < 2) currentDeg = targetDeg;
  servoWriteDeg(currentDeg);
}

const char *mopText() {
  if (currentDeg != targetDeg) return targetDeg == MOP_DOWN_DEG ? "bajando" : "subiendo";
  return currentDeg == MOP_DOWN_DEG ? "abajo" : "arriba";
}

// ---------- Leer el estado del robot ----------
String extractStatus(const String &json) {
  int cls = json.indexOf("StatusStateAttribute");
  if (cls < 0) return "";
  int v = json.indexOf("\"value\":\"", cls);
  if (v < 0) return "";
  v += 9;
  int end = json.indexOf('"', v);
  return end > v ? json.substring(v, end) : "";
}

void pollRobot() {
  if (WiFi.status() != WL_CONNECTED || robotHost.isEmpty()) { fails++; return; }
  HTTPClient http;
  http.setTimeout(1500);
  http.begin("http://" + robotHost + "/api/v2/robot/state/attributes");
  int code = http.GET();
  if (code == 200) {
    String s = extractStatus(http.getString());
    if (s.length()) {
      if (s != robotStatus) Serial.printf("Robot: %s -> %s\n", robotStatus.c_str(), s.c_str());
      robotStatus = s;
      fails = 0;
      lastOk = millis();
    } else {
      fails++;
    }
  } else {
    fails++;
    Serial.printf("Valetudo no responde (%d)\n", code);
  }
  http.end();
}

void applyLogic() {
  if (!autoMode) return;
  if (fails >= MAX_FAILS) { targetDeg = MOP_UP_DEG; robotStatus = "sin conexión"; return; }
  targetDeg = (robotStatus == "cleaning") ? MOP_DOWN_DEG : MOP_UP_DEG;
}

// ---------- Páginas web ----------
const char PAGE_HEAD[] PROGMEM = R"HTML(<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Mopa S5</title><style>
body{margin:0;background:#F4F3F0;font-family:system-ui,sans-serif;color:#1E1E1C}
main{max-width:440px;margin:0 auto;padding:24px 20px;display:flex;flex-direction:column;gap:14px}
h1{margin:0;font-size:26px}.muted{color:#6B665E;font-size:14px}
.card{background:#fff;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:8px}
.row{display:flex;justify-content:space-between;font-size:15px}.row b{font-weight:600}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}
button,select,input{font:inherit;min-height:48px;border-radius:14px;border:1.5px solid #D6D2C9;background:#fff;padding:0 14px}
button.primary{background:#3F5747;border-color:#3F5747;color:#fff;font-weight:600}
label{font-size:14px;font-weight:600}</style></head><body><main>)HTML";

void handleRoot() {
  String h = FPSTR(PAGE_HEAD);
  h += "<h1>Mopa S5</h1><p class='muted'>Banco de pruebas · s5-reborn</p><div class='card'>";
  h += "<div class='row'><span>Robot</span><b>" + robotStatus + "</b></div>";
  h += "<div class='row'><span>Mopa</span><b>" + String(mopText()) + " (" + currentDeg + "°)</b></div>";
  h += "<div class='row'><span>Modo</span><b>" + String(autoMode ? "automático" : "manual") + "</b></div>";
  h += "<div class='row'><span>Wifi</span><b>" + WiFi.SSID() + " · " + WiFi.RSSI() + " dBm</b></div>";
  h += "<div class='row'><span>Robot en</span><b>" + robotHost + "</b></div></div>";
  h += "<div class='btns'><form action='/down' method='post'><button style='width:100%'>Bajar mopa</button></form>";
  h += "<form action='/up' method='post'><button style='width:100%'>Subir mopa</button></form></div>";
  h += "<form action='/auto' method='post'><button class='primary' style='width:100%'>";
  h += autoMode ? "Pasar a modo manual" : "Volver a modo automático";
  h += "</button></form><form action='/reset' method='post'><button style='width:100%'>Cambiar wifi o robot</button></form>";
  h += "<p class='muted'>En modo automático la mopa baja cuando el robot limpia y sube en cualquier otro caso.</p>";
  h += "<script>setTimeout(()=>location.reload(),3000)</script></main></body></html>";
  server.send(200, "text/html; charset=utf-8", h);
}

void redirectHome() { server.sendHeader("Location", "/"); server.send(303); }

void handleConfigPage() {
  String h = FPSTR(PAGE_HEAD);
  h += "<h1>Configurar la mopa</h1><p class='muted'>Elige tu wifi (2,4 GHz) y escribe la IP del robot.</p>";
  h += "<form class='card' action='/save' method='post'><label>Wifi</label><select name='s'>";
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    String s = WiFi.SSID(i);
    if (s.length()) h += "<option>" + s + "</option>";
  }
  h += "</select><label>Contraseña del wifi</label><input name='p' type='password' autocomplete='off'>";
  h += "<label>IP del robot</label><input name='r' value='" + robotHost + "' placeholder='192.168.0.40'>";
  h += "<button class='primary'>Guardar y reiniciar</button></form></main></body></html>";
  server.send(200, "text/html; charset=utf-8", h);
}

void handleSave() {
  prefs.putString("ssid", server.arg("s"));
  prefs.putString("pass", server.arg("p"));
  prefs.putString("robot", server.arg("r"));
  String h = FPSTR(PAGE_HEAD);
  h += "<h1>Guardado</h1><p class='muted'>La mopa se reinicia y se conecta a tu wifi. Ya puedes volver a tu red.</p></main></body></html>";
  server.send(200, "text/html; charset=utf-8", h);
  delay(1500);
  ESP.restart();
}

// ---------- Arranque ----------
void startConfigPortal() {
  configMode = true;
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_NAME);
  dns.start(53, "*", WiFi.softAPIP());
  server.on("/", handleConfigPage);
  server.on("/save", HTTP_POST, handleSave);
  server.onNotFound(handleConfigPage);
  server.begin();
  Serial.printf("Modo configuración: conéctate a la red '%s' y abre http://%s\n", AP_NAME, WiFi.softAPIP().toString().c_str());
}

bool connectWifi() {
  if (wifiSsid.isEmpty()) return false;
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  Serial.printf("Conectando a %s", wifiSsid.c_str());
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    delay(250);
    Serial.print('.');
  }
  Serial.println();
  return WiFi.status() == WL_CONNECTED;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  ledcAttach(SERVO_PIN, 50, 14);
  servoWriteDeg(currentDeg);

  prefs.begin("mopa", false);
  wifiSsid = prefs.getString("ssid", "");
  wifiPass = prefs.getString("pass", "");
  robotHost = prefs.getString("robot", "");

  if (!connectWifi()) { startConfigPortal(); return; }

  Serial.printf("Conectado. IP: %s · Robot: %s\n", WiFi.localIP().toString().c_str(), robotHost.c_str());
  MDNS.begin(HOSTNAME);
  server.on("/", handleRoot);
  server.on("/down", HTTP_POST, []() { autoMode = false; targetDeg = MOP_DOWN_DEG; redirectHome(); });
  server.on("/up", HTTP_POST, []() { autoMode = false; targetDeg = MOP_UP_DEG; redirectHome(); });
  server.on("/auto", HTTP_POST, []() { autoMode = !autoMode; redirectHome(); });
  server.on("/reset", HTTP_POST, []() { prefs.clear(); redirectHome(); delay(500); ESP.restart(); });
  server.on("/status.json", []() {
    server.send(200, "application/json", "{\"robot\":\"" + robotStatus + "\",\"mop\":\"" + mopText() + "\",\"deg\":" + currentDeg + ",\"auto\":" + (autoMode ? "true" : "false") + "}");
  });
  server.begin();
}

void loop() {
  if (configMode) {
    dns.processNextRequest();
    server.handleClient();
    digitalWrite(LED_PIN, (millis() / 1000) % 2);
    return;
  }
  server.handleClient();
  if (millis() - lastPoll > POLL_MS) {
    lastPoll = millis();
    pollRobot();
    applyLogic();
  }
  servoTick();
  digitalWrite(LED_PIN, fails == 0 ? HIGH : (millis() / 300) % 2);
  if (WiFi.status() != WL_CONNECTED && millis() % 30000 < 20) WiFi.reconnect();
}
