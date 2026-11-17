param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
$ErrorActionPreference='Stop'
# Reuse the user's existing Git credential for this host in memory only.
$pogoCredential = "protocol=https`nhost=github.com`n`n" | git credential fill
if($LASTEXITCODE -ne 0){throw 'No se pudo obtener la sesión de GitHub existente.'}
$pogoPassword = $pogoCredential | Where-Object {$_ -like 'password=*'} | Select-Object -First 1
if(-not $pogoPassword){throw 'GitHub requiere iniciar sesión.'}
$pogoOldToken = $env:GH_TOKEN
try {
    $env:GH_TOKEN = $pogoPassword.Substring(9)
    & "$PSScriptRoot/../.tools/gh/bin/gh.exe" @Arguments
    $pogoExit = $LASTEXITCODE
} finally {
    $env:GH_TOKEN = $pogoOldToken
    $pogoCredential = $null
    $pogoPassword = $null
}
exit $pogoExit
