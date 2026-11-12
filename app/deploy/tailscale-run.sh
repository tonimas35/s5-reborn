#!/bin/sh
# Mantiene tailscaled en marcha y limita su memoria.
export GOGC=50
export GOMEMLIMIT=40MiB
while true; do
    /mnt/data/tailscale/tailscaled \
        --state=/mnt/data/tailscale/state/tailscaled.state \
        --statedir=/mnt/data/tailscale/state \
        --socket=/var/run/tailscale/tailscaled.sock \
        --port=41641 > /tmp/tailscaled.log 2>&1
    sleep 10
done
