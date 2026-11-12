# 4. Acceso remoto con Tailscale

Para revisar y actualizar el robot desde otra ciudad. Probado el 12/11/2026 con Tailscale **1.104.6** en el S5 (kernel 3.4, ARMv7): funciona en modo túnel normal (`/dev/net/tun` existe).

## Instalación

1. Descarga `tailscale_<versión>_arm.tgz` de [pkgs.tailscale.com/stable](https://pkgs.tailscale.com/stable/) y comprueba su SHA-256.
2. Cópialo al robot y descomprímelo en `/mnt/data/tailscale` (se conserva aunque se reinstale el firmware):
   ```sh
   cd /mnt/data && tar xzf tailscale_*_arm.tgz && mv tailscale_*_arm tailscale && mkdir -p tailscale/state
   ```
3. Arranque automático: copia [`app/deploy/tailscale-run.sh`](../app/deploy/tailscale-run.sh) a `/mnt/data/tailscale/run.sh` y [`app/deploy/S13tailscale`](../app/deploy/S13tailscale) a `/etc/init/S13tailscale`. Después, `/etc/init/S13tailscale start`.
4. Vincúlalo a tu cuenta:
   ```sh
   /mnt/data/tailscale/tailscale --socket=/var/run/tailscale/tailscaled.sock up \
       --hostname=robot-casa --accept-dns=false --netfilter-mode=off
   ```
   Abre el enlace que aparece e inicia sesión.

Notas:
- `--accept-dns=false`: el robot mantiene su DNS. Valetudo usa `/etc/hosts` para bloquear la nube.
- `--netfilter-mode=off`: el `iptables 1.4.21` del robot no admite `--set-mark`. No hace falta, porque no usamos el robot como enrutador.
- Consumo: unos 30–40 MB de RAM. El script limita el recolector de memoria de Go (`GOMEMLIMIT=40MiB`).

## Uso

Con la app de Tailscale en el móvil o el PC (misma cuenta):

- App de mamá: `http://<IP Tailscale>:8080`
- Valetudo: `http://<IP Tailscale>`
- SSH: `ssh -i clave_robot root@<IP Tailscale>`

Probado desde un iPhone con datos 5G y sin wifi: la app carga con los datos reales del robot.
