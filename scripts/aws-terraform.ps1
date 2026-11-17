param(
    [Parameter(Mandatory=$true)][string]$Directory,
    [string]$Profile = 'neural-chess',
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$TerraformArguments
)
$ErrorActionPreference = 'Stop'
# Bridge browser-login profiles through the standard credential process so the
# S3 backend can refresh credentials during long EKS apply/destroy operations.
$pogoSourceConfig = if($env:AWS_CONFIG_FILE){$env:AWS_CONFIG_FILE}else{Join-Path $env:USERPROFILE '.aws/config'}
$pogoTempConfig = Join-Path $PSScriptRoot "../.tools/terraform-auth-$([guid]::NewGuid().ToString('N')).config"
$pogoConfigText = Get-Content -LiteralPath $pogoSourceConfig -Raw
$pogoConfigText += "`n[profile pogo-terraform-bridge]`ncredential_process = aws configure export-credentials --profile $Profile --format process`n"
[IO.File]::WriteAllText($pogoTempConfig, $pogoConfigText)
$pogoSaved = @{}
$pogoNames = @('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_PROFILE', 'AWS_CONFIG_FILE', 'AWS_SDK_LOAD_CONFIG')
foreach ($pogoName in $pogoNames) { $pogoSaved[$pogoName] = [Environment]::GetEnvironmentVariable($pogoName, 'Process') }
try {
    foreach($pogoName in @('AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN')){Remove-Item "Env:$pogoName" -ErrorAction SilentlyContinue}
    $env:AWS_PROFILE = 'pogo-terraform-bridge'
    $env:AWS_CONFIG_FILE = [IO.Path]::GetFullPath($pogoTempConfig)
    $env:AWS_SDK_LOAD_CONFIG = '1'
    & "$PSScriptRoot/../.tools/terraform/terraform.exe" "-chdir=$Directory" @TerraformArguments
    $pogoExitCode = $LASTEXITCODE
} finally {
    foreach ($pogoName in $pogoNames) {
        if([string]::IsNullOrEmpty($pogoSaved[$pogoName])){Remove-Item "Env:$pogoName" -ErrorAction SilentlyContinue}
        else{[Environment]::SetEnvironmentVariable($pogoName, $pogoSaved[$pogoName], 'Process')}
    }
    Remove-Item -LiteralPath $pogoTempConfig
}
exit $pogoExitCode
