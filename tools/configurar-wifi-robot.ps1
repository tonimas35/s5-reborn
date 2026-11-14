# Configura el wifi del robot escribiendo /mnt/data/miio/wifi.conf por SSH, sin pasar por Valetudo.
#
# Para qué: Valetudo rechaza contraseñas con ; \ / # ' " porque algunos firmwares se rompen con
# ellas. En el S5 con firmware 2008, /opt/rockrobo/wlan/wifi_start.sh pasa la contraseña entre
# comillas a wpa_passphrase y funciona (probado con una clave que termina en "#").
#
# Uso: con el robot en modo punto de acceso (cuadradito + enchufe 3 s) y el PC conectado a su red:
#   .\configurar-wifi-robot.ps1 -Ssid "MiWifi"
# La contraseña se teclea en la ventana: no se muestra ni se guarda en el PC.
param(
  [Parameter(Mandatory)][string]$Ssid,
  [string]$Robot = "192.168.8.1",
  [string]$Key = "$PSScriptRoot\clave_robot",
  [string]$KnownHosts = "$PSScriptRoot\known_hosts_robot_ap"
)
$sec = Read-Host -AsSecureString "Contraseña del wifi '$Ssid'"
$p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
$esc = $p.Replace('\','\\').Replace('"','\"')   # wifi_start.sh deshace estos escapes
$conf = "ssid=""$Ssid""`npsk=""$esc""`nkey_mgmt=WPA`n"
$p = $null; $esc = $null
$o = @('-i',$Key,'-o','HostKeyAlgorithms=+ssh-rsa','-o','PubkeyAcceptedAlgorithms=+ssh-rsa','-o','BatchMode=yes',
       '-o','ConnectTimeout=10','-o','StrictHostKeyChecking=accept-new','-o',"UserKnownHostsFile=$KnownHosts")
$conf | ssh @o "root@$Robot" 'cat > /mnt/data/miio/wifi.conf.new && mv /mnt/data/miio/wifi.conf.new /mnt/data/miio/wifi.conf && chmod 600 /mnt/data/miio/wifi.conf && sync && grep -v psk /mnt/data/miio/wifi.conf'
$conf = $null
ssh @o "root@$Robot" '(sleep 2; reboot) >/dev/null 2>&1 &'
Write-Host "Guardado. El robot se reinicia y se conecta a $Ssid."
