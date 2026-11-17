param([string]$Profile='neural-chess', [string]$Region='us-east-2', [Parameter(Mandatory=$true)][string]$Tag, [string[]]$Images=@('server','client','gateway'))
$ErrorActionPreference='Stop'
$pogoAccount = aws sts get-caller-identity --profile $Profile --query Account --output text
if ($LASTEXITCODE -ne 0) { throw 'Sesión AWS no disponible.' }
$pogoRegistry = "$pogoAccount.dkr.ecr.$Region.amazonaws.com"
$pogoAuth = aws ecr get-authorization-token --profile $Profile --region $Region --query 'authorizationData[0].authorizationToken' --output text
if ($LASTEXITCODE -ne 0) { throw 'No se pudo autorizar el registro privado.' }
# Isolate the temporary ECR login from broken Windows credential helpers.
$pogoConfigDir = Join-Path $PSScriptRoot '../.tools/ecr-login'
New-Item -ItemType Directory -Path $pogoConfigDir -Force | Out-Null
$pogoConfig = Join-Path (Resolve-Path $pogoConfigDir).Path 'config.json'
try {
    @{auths=@{$pogoRegistry=@{auth=$pogoAuth}}} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $pogoConfig
    foreach ($pogoImage in $Images) {
        $pogoRemote = "$pogoRegistry/pogo/${pogoImage}:$Tag"
        docker tag "pogo-${pogoImage}:aws" $pogoRemote
        if ($LASTEXITCODE -ne 0) { throw "No se pudo etiquetar $pogoImage" }
        docker --config $pogoConfigDir --host npipe:////./pipe/dockerDesktopLinuxEngine push $pogoRemote
        if ($LASTEXITCODE -ne 0) { throw "No se pudo publicar $pogoImage" }
    }
} finally {
    Remove-Item -LiteralPath $pogoConfig -Force -ErrorAction SilentlyContinue
    $pogoAuth = $null
}
