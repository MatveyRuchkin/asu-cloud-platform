$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$botNode = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
$env:PATH = (Split-Path -Parent $botNode) + ';' + $env:PATH
$botSecure = Read-Host 'GitHub fine-grained READ-ONLY token (input hidden)' -AsSecureString
$botPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($botSecure)
try {
    $botValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($botPointer)
    $botValue | & $botNode node_modules\wrangler\bin\wrangler.js secret put GITHUB_TOKEN
    if ($LASTEXITCODE -ne 0) { throw 'Secret setup failed.' }
    # A PAT has an independent rate limit. Drop the anonymous-IP backoff only.
    & $botNode node_modules\wrangler\bin\wrangler.js d1 execute asu-team-bot --remote --command "DELETE FROM settings WHERE key='github_retry_at'"
    Write-Host 'GitHub read-only token configured. Value was not printed.'
} catch { Write-Host 'Setup failed. Check Cloudflare authorization and try again.'; exit 1 }
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($botPointer)
    $botValue = $null
    $botSecure.Dispose()
}
