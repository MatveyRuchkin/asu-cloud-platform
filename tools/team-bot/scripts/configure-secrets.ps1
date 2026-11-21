param([string]$WorkerUrl)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $botNode = $nodeCommand.Source }
else { $botNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $botNode)) { throw 'Install Node.js LTS, then reopen PowerShell.' }
$env:PATH = (Split-Path -Parent $botNode) + ';' + $env:PATH
$botWrangler = Join-Path (Get-Location) 'node_modules\wrangler\bin\wrangler.js'
if (-not $WorkerUrl) { $WorkerUrl = Read-Host 'Worker URL (https://...workers.dev)' }
if ($WorkerUrl -notmatch '^https://[a-zA-Z0-9.-]+\.workers\.dev/?$') { throw 'Use the HTTPS workers.dev URL.' }
function Set-BotSecret([string]$Name, [string]$Value) {
    $Value | & $botNode scripts/put-secret.mjs $Name
    if ($LASTEXITCODE -ne 0) { throw "Secret setup failed: $Name" }
}
function New-BotSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
}
$botSecure = Read-Host 'Telegram token from BotFather (input hidden)' -AsSecureString
$botPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($botSecure)
try { $botToken = ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($botPointer)).Trim() }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($botPointer) }
$botAdmins = Read-Host 'Your numeric Telegram ID (or comma-separated admin IDs)'
if ($botAdmins -notmatch '^\d+(,\d+)*$') { throw 'Admin IDs must be numeric.' }
$botWebhook = New-BotSecret
$botDiagnostic = New-BotSecret
try {
    Set-BotSecret 'TELEGRAM_BOT_TOKEN' $botToken
    Set-BotSecret 'ADMIN_TELEGRAM_IDS' $botAdmins
    Set-BotSecret 'TELEGRAM_WEBHOOK_SECRET' $botWebhook
    Set-BotSecret 'DIAGNOSTIC_SECRET' $botDiagnostic
    # Leave time for new secret versions to propagate to workers.dev.
    Start-Sleep -Seconds 8
    $botResult = Invoke-RestMethod -Uri "$($WorkerUrl.TrimEnd('/'))/diagnostics/telegram" -Method Post `
        -Headers @{Authorization="Bearer $botDiagnostic"} -ContentType 'application/json' -Body '{"send":false}'
    if (-not $botResult.getMe) { throw 'Worker getMe did not pass.' }
    Write-Host 'getMe from the deployed Cloudflare Worker passed.'
    $botBody = @{url="$($WorkerUrl.TrimEnd('/'))/webhook";secret_token=$botWebhook;allowed_updates=@('message','callback_query');drop_pending_updates=$false;max_connections=2} | ConvertTo-Json
    $botResult = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/setWebhook" -Method Post -ContentType 'application/json' -Body $botBody
    if (-not $botResult.ok) { throw 'setWebhook did not pass.' }
    Write-Host 'Webhook registered. Open the bot, press Start, select yourself, then use /pending as admin.'
    Write-Host 'Approve yourself after checking ID; enable notifications in /settings. Then press Enter here.'
    Read-Host | Out-Null
    $botResult = Invoke-RestMethod -Uri "$($WorkerUrl.TrimEnd('/'))/diagnostics/telegram" -Method Post `
        -Headers @{Authorization="Bearer $botDiagnostic"} -ContentType 'application/json' -Body '{"send":true}'
    Write-Host "Worker sendMessage result: $($botResult.sendMessage)"
} catch {
    # Do not print PowerShell exception objects: request URLs may contain the Telegram token.
    Write-Host 'Setup incomplete. No token details were printed. Check Cloudflare secrets, Worker URL, registration and network, then rerun.'
    exit 1
} finally {
    $botToken = $null; $botWebhook = $null; $botDiagnostic = $null; $botBody = $null
    $botSecure.Dispose()
}
