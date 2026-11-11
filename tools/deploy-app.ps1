<#
  deploy-app.ps1: instala o actualiza la app en el robot desde Windows.
  Uso: .\deploy-app.ps1 -Robot 192.168.0.40 -Key ..\clave_robot -Dir .\app-files
  -Dir debe contener s5app, run.sh y S12s5app.
#>
param(
  [Parameter(Mandatory)] [string]$Robot,
  [Parameter(Mandatory)] [string]$Key,
  [string]$Dir = "."
)
$o = @('-i', $Key, '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL', '-o', 'LogLevel=ERROR',
       '-o', 'HostKeyAlgorithms=+ssh-rsa', '-o', 'PubkeyAcceptedAlgorithms=+ssh-rsa')
ssh @o "root@$Robot" "mkdir -p /mnt/data/s5app"
scp -O @o (Join-Path $Dir "s5app") (Join-Path $Dir "run.sh") (Join-Path $Dir "S12s5app") "root@${Robot}:/mnt/data/s5app/"
ssh @o "root@$Robot" "cd /mnt/data/s5app && sed -i 's/\r$//' run.sh S12s5app && chmod +x s5app run.sh S12s5app && cp S12s5app /etc/init/S12s5app && /etc/init/S12s5app restart"
Start-Sleep 3
try {
  $r = Invoke-WebRequest "http://${Robot}:8080/" -UseBasicParsing -TimeoutSec 10
  "App en marcha: http://${Robot}:8080 (HTTP $($r.StatusCode))"
} catch { "La app no responde todavía: $($_.Exception.Message)" }
