# 2. Copia de seguridad de fábrica

Cada robot guarda datos **únicos** de fábrica: identidad, calibración y configuración. Si se pierden, no hay forma de recuperarlos, así que la copia se hace **justo después de rootear**.

El S5 usa **eMMC** (`/dev/mmcblk0`), no NAND, así que no existen los `/dev/nandb` y `/dev/nandk` que menciona la guía genérica de Valetudo.

| Partición | Punto de montaje | Contenido |
|---|---|---|
| `mmcblk0p6` (64 MB) | `/mnt/default` (solo lectura) | Configuración de fábrica: `device.conf`, `roborock.conf`, `vinda`, `librrafm.so`, sonidos |
| `mmcblk0p11` (16 MB) | `/mnt/reserve` | Datos reservados |
| `mmcblk0p5` (16 MB) | — | Partición pequeña sin montar |

## Hacer la copia

En el robot, por SSH:

```sh
mkdir -p /mnt/data/backup && cd /mnt/data/backup
for p in 5 6 11; do dd if=/dev/mmcblk0p$p bs=1M 2>/dev/null | gzip > mmcblk0p$p.img.gz; done
tar czf default-files.tar.gz -C /mnt default
md5sum * > md5sums.txt
```

Y en el PC:

```powershell
scp -O -i clave_robot -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa "root@192.168.8.1:/mnt/data/backup/*" .\backup-fabrica\
```

Comprueba los MD5 contra `md5sums.txt` y **guarda la carpeta en dos sitios**, por ejemplo el PC y la nube.

> ⚠️ `backup-fabrica/` está en `.gitignore`. **Nunca la subas a un repositorio**: identifica a tu robot.
