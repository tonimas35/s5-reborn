#!/bin/sh
# Mantiene la app en marcha: si se cierra, la vuelve a abrir.
export GOGC=50
export GOMEMLIMIT=48MiB
while true; do
    /mnt/data/s5app/s5app -listen :8080 -valetudo http://127.0.0.1:80 >> /tmp/s5app.log 2>&1
    sleep 5
done
