// mopa-wifi-form: formulario temporal que corre en el robot para configurar el wifi
// del ESP32 de la mopa desde el móvil, sin acercarse al ESP32.
//
// Flujo: el móvil abre http://<robot>:8081, la persona escribe la contraseña y el
// formulario la guarda en /tmp (RAM) con permisos 600. Desde el PC, el script
// tools/mopa-wifi-usb.ps1 recoge el fichero por SSH, lo borra y se lo envía al ESP32
// por el cable USB (comando SETWIFI del firmware). El programa se cierra solo tras
// recibir un envío o a los 20 minutos. Nunca escribe la contraseña en el log.
package main

import (
	"encoding/json"
	"flag"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

const page = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Wifi de la mopa</title><style>
body{margin:0;background:#F4F3F0;font-family:system-ui,-apple-system,sans-serif;color:#1E1E1C}
main{max-width:440px;margin:0 auto;padding:28px 20px;display:flex;flex-direction:column;gap:14px}
h1{margin:0;font-size:26px}.muted{color:#6B665E;font-size:15px;margin:0}
form{background:#fff;border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:10px}
label{font-size:14px;font-weight:600}
input{font:inherit;font-size:17px;min-height:48px;border-radius:14px;border:1.5px solid #D6D2C9;padding:0 14px}
button{font:inherit;font-size:17px;min-height:52px;border-radius:14px;border:0;background:#3F5747;color:#fff;font-weight:600;margin-top:6px}
</style></head><body><main>
{{if .Done}}<h1>Hecho</h1><p class="muted">Ya lo tengo. Puedes cerrar esta página y avisar en el chat.</p>
{{else}}<h1>Wifi de la mopa</h1><p class="muted">Escribe la contraseña del wifi. Se envía al ESP32 por el cable y se borra del robot.</p>
<form method="post" action="/guardar">
<label for="s">Wifi</label><input id="s" name="s" value="{{.SSID}}" autocapitalize="off" autocorrect="off">
<label for="p">Contraseña del wifi</label><input id="p" name="p" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" autofocus>
<label for="r">IP del robot</label><input id="r" name="r" value="{{.Robot}}" inputmode="decimal">
<button>Enviar a la mopa</button></form>{{end}}
</main></body></html>`

func currentSSID() string {
	c := http.Client{Timeout: 4 * time.Second}
	res, err := c.Get("http://127.0.0.1/api/v2/robot/capabilities/WifiConfigurationCapability")
	if err != nil {
		return ""
	}
	defer res.Body.Close()
	var v struct {
		Details struct {
			SSID string `json:"ssid"`
		} `json:"details"`
	}
	json.NewDecoder(res.Body).Decode(&v)
	return v.Details.SSID
}

func clean(s string) string { return strings.TrimSpace(strings.NewReplacer("\r", "", "\n", "").Replace(s)) }

func main() {
	listen := flag.String("listen", ":8081", "dirección donde escuchar")
	out := flag.String("out", "/tmp/mopa-wifi.txt", "fichero donde dejar la configuración")
	robot := flag.String("robot", "192.168.0.40", "IP del robot que se propone en el formulario")
	ttl := flag.Duration("ttl", 20*time.Minute, "se cierra solo pasado este tiempo")
	flag.Parse()

	tpl := template.Must(template.New("p").Parse(page))
	ssid := currentSSID()
	done := make(chan struct{}, 1)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		tpl.Execute(w, map[string]any{"SSID": ssid, "Robot": *robot})
	})
	http.HandleFunc("/guardar", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		s, p, rb := clean(r.FormValue("s")), clean(r.FormValue("p")), clean(r.FormValue("r"))
		if s == "" || p == "" {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		data := "SETWIFI\n" + s + "\n" + p + "\n" + rb + "\n"
		if err := os.WriteFile(*out, []byte(data), 0o600); err != nil {
			http.Error(w, "No he podido guardarlo", http.StatusInternalServerError)
			return
		}
		log.Printf("configuración recibida para el wifi %q", s)
		w.Header().Set("Cache-Control", "no-store")
		tpl.Execute(w, map[string]any{"Done": true})
		select {
		case done <- struct{}{}:
		default:
		}
	})

	go func() {
		select {
		case <-done:
			time.Sleep(2 * time.Second)
		case <-time.After(*ttl):
			log.Print("tiempo agotado")
		}
		os.Exit(0)
	}()
	log.Printf("formulario en %s (wifi detectado: %q)", *listen, ssid)
	log.Fatal(http.ListenAndServe(*listen, nil))
}
