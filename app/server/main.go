// s5app: servidor diminuto que corre dentro del robot.
// Sirve la app (incrustada en el binario) y reenvía /api/ a Valetudo,
// así la app y la API comparten origen y no hay problemas de CORS.
package main

import (
	"bytes"
	"compress/gzip"
	"embed"
	"flag"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strings"
	"time"
)

//go:embed web
var webFiles embed.FS

type asset struct {
	raw  []byte
	gz   []byte
	mime string
}

func loadAssets() map[string]*asset {
	sub, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatal(err)
	}
	assets := map[string]*asset{}
	err = fs.WalkDir(sub, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		raw, err := fs.ReadFile(sub, p)
		if err != nil {
			return err
		}
		ext := path.Ext(p)
		ctype := mime.TypeByExtension(ext)
		switch ext {
		case ".webmanifest":
			ctype = "application/manifest+json"
		case ".js":
			ctype = "text/javascript; charset=utf-8"
		case ".woff2":
			ctype = "font/woff2"
		}
		if ctype == "" {
			ctype = "application/octet-stream"
		}
		a := &asset{raw: raw, mime: ctype}
		if strings.HasPrefix(ctype, "text/") || strings.Contains(ctype, "json") || strings.Contains(ctype, "javascript") || ext == ".svg" {
			var buf bytes.Buffer
			zw, _ := gzip.NewWriterLevel(&buf, gzip.BestCompression)
			zw.Write(raw)
			zw.Close()
			a.gz = buf.Bytes()
		}
		assets["/"+p] = a
		return nil
	})
	if err != nil {
		log.Fatal(err)
	}
	return assets
}

func main() {
	listen := flag.String("listen", ":8080", "dirección donde escuchar")
	upstream := flag.String("valetudo", "http://127.0.0.1:80", "dirección de Valetudo")
	flag.Parse()

	target, err := url.Parse(*upstream)
	if err != nil {
		log.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.FlushInterval = -1 // necesario para los eventos en directo (SSE) de Valetudo
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("proxy: %v", err)
		http.Error(w, "Valetudo no responde", http.StatusBadGateway)
	}

	assets := loadAssets()
	started := time.Now()

	mux := http.NewServeMux()
	mux.Handle("/api/", proxy)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/" {
			p = "/index.html"
		}
		a, ok := assets[p]
		if !ok {
			a = assets["/index.html"]
		}
		h := w.Header()
		h.Set("Content-Type", a.mime)
		h.Set("Cache-Control", "no-cache")
		h.Set("Last-Modified", started.UTC().Format(http.TimeFormat))
		h.Set("Vary", "Accept-Encoding")
		if ims, err := http.ParseTime(r.Header.Get("If-Modified-Since")); err == nil && !started.Truncate(time.Second).After(ims) {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		body := a.raw
		if a.gz != nil && strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			h.Set("Content-Encoding", "gzip")
			body = a.gz
		}
		w.Write(body)
	})

	log.Printf("s5app escuchando en %s (Valetudo en %s, %d ficheros)", *listen, *upstream, len(assets))
	srv := &http.Server{Addr: *listen, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	log.Fatal(srv.ListenAndServe())
}
