# Recoge del robot la configuración que se escribió en el formulario mopa-wifi-form
# y se la envía al ESP32 por el cable USB (comando SETWIFI del firmware).
# La contraseña no se muestra en pantalla ni se guarda en el PC; el fichero del robot se borra.
#
# Uso: .\mopa-wifi-usb.ps1 -Port COM5 -Robot 192.168.0.40 -Key .\clave_robot
param(
  [string]$Port = "COM5",
  [string]$Robot = "192.168.0.40",
  [string]$Key = "$PSScriptRoot\clave_robot",
  [string]$KnownHosts = "$PSScriptRoot\known_hosts_robot"
)

$ssh = @('-i', $Key, '-o', 'HostKeyAlgorithms=+ssh-rsa', '-o', 'PubkeyAcceptedAlgorithms=+ssh-rsa',
         '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', "UserKnownHostsFile=$KnownHosts")

$data = (ssh @ssh "root@$Robot" 'cat /tmp/mopa-wifi.txt 2>/dev/null; rm -f /tmp/mopa-wifi.txt') -join "`n"
if (-not $data.StartsWith("SETWIFI")) { Write-Host "Todavía no hay nada enviado desde el formulario."; exit 1 }

# Abrir el puerto sin tocar DTR/RTS para no reiniciar el ESP32 a mitad del envío
$sp = New-Object System.IO.Ports.SerialPort $Port, 115200, 'None', 8, 'One'
$sp.DtrEnable = $false; $sp.RtsEnable = $false; $sp.NewLine = "`n"; $sp.ReadTimeout = 500
$sp.Open()
Start-Sleep -Milliseconds 1500
$null = $sp.ReadExisting()
$sp.Write($data.TrimEnd("`n") + "`n")
$data = $null

$out = ""; $t = Get-Date
while (((Get-Date) - $t).TotalSeconds -lt 25) {
  try { $out += $sp.ReadExisting() } catch {}
  if ($out -match 'Conectado\. IP: [0-9.]+' -or $out -match 'Modo configuraci') { Start-Sleep 1; $out += $sp.ReadExisting(); break }
  Start-Sleep -Milliseconds 200
}
$sp.Close()
($out -split "`n") | Where-Object { $_ -match 'SETWIFI|Conectado|Conectando|Modo configuraci' } | ForEach-Object { $_.Trim() }
