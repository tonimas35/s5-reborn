<#
  miio-status.ps1 — Consulta a un Roborock (protocolo miIO, UDP 54321) sin dependencias.

  Útil durante el rooteo para ver si el robot acepta órdenes locales y cómo va la
  instalación OTA. Funciona con el robot en modo punto de acceso (sin provisionar),
  porque en ese modo devuelve su token en la respuesta al "hello".

  Uso (con el PC conectado a la red roborock-vacuum-s5_miapXXXX):
    .\miio-status.ps1
    .\miio-status.ps1 -Methods miIO.get_ota_state,miIO.get_ota_progress -Loop 10

  Interpretación:
    miIO.info vacío            -> firmware nuevo que bloquea OTA local: haz reset de fábrica
    get_ota_state = installing -> está instalando, no lo toques
    get_ota_state = failed     -> la imagen no se pudo instalar (con la 2034 pasó al 55 %)
#>
param(
  [string]$Ip = "192.168.8.1",
  [string[]]$Methods = @("miIO.get_ota_state", "miIO.get_ota_progress", "get_status"),
  [int]$Loop = 1,
  [int]$IntervalSeconds = 15
)

function Md5([byte[]]$b) { [System.Security.Cryptography.MD5]::Create().ComputeHash($b) }

function Invoke-Miio([string]$Ip, [string[]]$Methods) {
  $udp = New-Object System.Net.Sockets.UdpClient(0)
  $udp.Client.ReceiveTimeout = 3000
  $ep = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse($Ip), 54321)
  $r = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
  try {
    $hello = [byte[]](0x21, 0x31, 0x00, 0x20) + [byte[]](, 0xFF * 28)
    [void]$udp.Send($hello, $hello.Length, $ep)
    $resp = $udp.Receive([ref]$r)
  } catch { $udp.Close(); return "sin respuesta (¿instalando o reiniciando?)" }

  $devid = $resp[8..11]; $sb = $resp[12..15]; $token = [byte[]]$resp[16..31]
  $stamp = ([uint32]$sb[0] -shl 24) -bor ([uint32]$sb[1] -shl 16) -bor ([uint32]$sb[2] -shl 8) -bor [uint32]$sb[3]
  $out = @("uptime=${stamp}s")

  $key = Md5 $token; $iv = Md5 ([byte[]]($key + $token))
  $aes = [System.Security.Cryptography.Aes]::Create()
  $aes.Key = $key; $aes.IV = $iv; $aes.Mode = 'CBC'; $aes.Padding = 'None'

  $i = 0
  foreach ($m in $Methods) {
    $i++
    $json = [System.Text.Encoding]::UTF8.GetBytes('{"id":' + (Get-Random -Min 1000 -Max 90000) + ',"method":"' + $m + '","params":[]}')
    $pad = 16 - ($json.Length % 16); $json = [byte[]]($json + [byte[]](, [byte]$pad * $pad))
    $enc = $aes.CreateEncryptor().TransformFinalBlock($json, 0, $json.Length)
    $len = 32 + $enc.Length; $st = $stamp + $i
    $hdr = [byte[]](0x21, 0x31, [byte](($len -shr 8) -band 0xFF), [byte]($len -band 0xFF), 0, 0, 0, 0) + $devid +
           [byte[]]([byte](($st -shr 24) -band 0xFF), [byte](($st -shr 16) -band 0xFF), [byte](($st -shr 8) -band 0xFF), [byte]($st -band 0xFF))
    $chk = Md5 ([byte[]]($hdr + $token + $enc))
    $pkt = [byte[]]($hdr + $chk + $enc)
    [void]$udp.Send($pkt, $pkt.Length, $ep)
    try {
      $rr = $udp.Receive([ref]$r)
      $d = $aes.CreateDecryptor().TransformFinalBlock($rr, 32, $rr.Length - 32)
      $txt = ([System.Text.Encoding]::UTF8.GetString($d) -replace '[\x00-\x10]', '').Trim()
      if (-not $txt) { $txt = "(vacío)" }
      $out += "${m}: $txt"
    } catch { $out += "${m}: timeout" }
  }
  $udp.Close()
  return ($out -join "`n  ")
}

for ($n = 0; $n -lt $Loop; $n++) {
  "{0}  {1}" -f (Get-Date -Format HH:mm:ss), (Invoke-Miio $Ip $Methods)
  if ($n -lt $Loop - 1) { Start-Sleep $IntervalSeconds }
}
