param(
    [Parameter(Mandatory=$true)][string]$Directory,
    [string]$Profile = 'neural-chess',
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$TerraformArguments
)
$ErrorActionPreference = 'Stop'
# Older Terraform S3 backends do not understand AWS CLI browser-login profiles.
# Pass temporary credentials in this process only; never print or save them.
$pogoCredentials = aws configure export-credentials --profile $Profile --format process | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'No se pudo obtener la sesión temporal de AWS.' }
$pogoSaved = @{}
$pogoNames = @('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN')
foreach ($pogoName in $pogoNames) { $pogoSaved[$pogoName] = [Environment]::GetEnvironmentVariable($pogoName, 'Process') }
try {
    $env:AWS_ACCESS_KEY_ID = $pogoCredentials.AccessKeyId
    $env:AWS_SECRET_ACCESS_KEY = $pogoCredentials.SecretAccessKey
    $env:AWS_SESSION_TOKEN = $pogoCredentials.SessionToken
    & "$PSScriptRoot/../.tools/terraform/terraform.exe" "-chdir=$Directory" @TerraformArguments
    $pogoExitCode = $LASTEXITCODE
} finally {
    foreach ($pogoName in $pogoNames) { [Environment]::SetEnvironmentVariable($pogoName, $pogoSaved[$pogoName], 'Process') }
}
exit $pogoExitCode
