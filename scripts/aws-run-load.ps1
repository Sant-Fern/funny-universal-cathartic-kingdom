param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$Label,
    [ValidateSet('PogoUser','SpectatorUser','LeaderboardUser')][string]$ClassName='PogoUser',
    [int]$Users=1000, [double]$Rate=2, [int]$Duration=1200,
    [ValidatePattern('^[A-Za-z0-9._-]+$')][string]$Tag='loadtest-20261116-01',
    [string]$Profile='neural-chess'
)
$ErrorActionPreference='Stop'
if($Users -lt 1 -or $Users -gt 1000 -or $Rate -le 0 -or $Rate -gt 100 -or $Duration -lt 10 -or $Duration -gt 1300){throw 'Carga fuera de los límites de esta demostración.'}
$pogoPlan=aws freetier get-account-plan-state --profile $Profile --region us-east-1 --output json --no-cli-pager | ConvertFrom-Json
if($LASTEXITCODE -ne 0 -or $pogoPlan.accountPlanType -ne 'FREE' -or $pogoPlan.accountPlanStatus -ne 'ACTIVE' -or [decimal]$pogoPlan.accountPlanRemainingCredits.amount -lt 40){throw 'La carga exige Free activo y al menos USD 40 de crédito.'}
$pogoOutput=& "$PSScriptRoot/aws-terraform.ps1" -Directory infra/aws -Profile $Profile -TerraformArguments @('output','-json') | ConvertFrom-Json
if($LASTEXITCODE -ne 0){throw 'No se pudo leer el entorno Terraform.'}
$pogoMachines=@($pogoOutput.load_generators.value)
if($pogoMachines.Count -ne 2){throw 'Se requieren exactamente dos generadores dedicados.'}
$pogoBucket=$pogoOutput.artifacts_bucket.value
$pogoRegistry=($pogoOutput.repositories.value.loadtest -split '/')[0]
$pogoHost=$pogoOutput.game_url.value
if($ClassName -eq 'LeaderboardUser'){$pogoHost=([uri]$pogoOutput.leaderboard_url.value).GetLeftPart([System.UriPartial]::Authority)}
$pogoMaster=$pogoMachines[0].private_ip
$pogoImage="$pogoRegistry/pogo/loadtest:$Tag"
$pogoEvidence=Join-Path $PSScriptRoot "../evidence/aws-load/$Label"
New-Item -ItemType Directory -Path $pogoEvidence -Force | Out-Null
$pogoCommands=@()
for($pogoIndex=0;$pogoIndex -lt 2;$pogoIndex++){
    $pogoMachine=$pogoMachines[$pogoIndex]
    $pogoWorkerArgs=if($pogoIndex -eq 1){" --worker-only --master-host $pogoMaster"}else{''}
    $pogoRemote=@(
        'set -eu',
        'systemctl is-active docker',
        "aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin $pogoRegistry",
        "docker pull $pogoImage",
        "mkdir -p /var/lib/pogo-results/$Label",
        "docker run --rm --name pogo-load-$Label --network host -v /var/lib/pogo-results/${Label}:/output -e AWS_DEFAULT_REGION=us-east-2 -e ARTIFACTS_BUCKET=$pogoBucket $pogoImage python loadtest/runner.py --host $pogoHost --label $Label --users $Users --rate $Rate --duration $Duration --class-name $ClassName --bucket $pogoBucket --generator $($pogoMachine.id)$pogoWorkerArgs"
    )
    $pogoInput=@{DocumentName='AWS-RunShellScript';InstanceIds=@($pogoMachine.id);TimeoutSeconds=180;Comment="Pogo integrator $Label";Parameters=@{commands=$pogoRemote;executionTimeout=@([string]($Duration+360))}}
    $pogoInputPath=Join-Path (Get-Location).Path ".tools/ssm-$Label-$pogoIndex.json"
    $pogoInput | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $pogoInputPath
    $pogoResponse=aws ssm send-command --profile $Profile --region us-east-2 --cli-input-json "file://$pogoInputPath" --output json --no-cli-pager | ConvertFrom-Json
    if($LASTEXITCODE -ne 0){throw 'No se pudo iniciar el generador.'}
    $pogoCommands += [pscustomobject]@{instance=$pogoMachine.id;command=$pogoResponse.Command.CommandId;master=($pogoIndex -eq 0)}
}
$pogoRecord=@{label=$Label;class=$ClassName;users=$Users;rate=$Rate;duration=$Duration;tag=$Tag;host=$pogoHost;started_utc=[datetime]::UtcNow.ToString('o');credit_before=$pogoPlan.accountPlanRemainingCredits;commands=$pogoCommands}
$pogoRecord | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $pogoEvidence 'commands.json')
$pogoRecord | ConvertTo-Json -Depth 8
