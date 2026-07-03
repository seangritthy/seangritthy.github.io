# Makes your GitHub repo's contents EXACTLY match this local folder.
# Equivalent to "delete everything on GitHub, then upload my files" — but done as
# one normal commit (NOT a force-push), so history is preserved and it's reversible.
#
# Usage:
#   1. Open PowerShell in this folder.
#   2. Run:  ./sync-repo-to-github.ps1
#   3. Sign in with YOUR GitHub account when prompted.

$ErrorActionPreference = 'Stop'

$repoUrl  = 'https://github.com/seangritthy/seangritthy.github.io.git'
$source   = $PSScriptRoot
$cloneDir = Join-Path $env:TEMP ("ghsync_" + [System.Guid]::NewGuid().ToString('N').Substring(0,8))

Write-Host "Cloning $repoUrl ..." -ForegroundColor Cyan
git clone $repoUrl $cloneDir
if ($LASTEXITCODE -ne 0) { throw "git clone failed. Check the repo URL / your access." }

# 1) Delete everything currently in the repo EXCEPT the .git folder.
Write-Host "Clearing old repo contents (keeping .git) ..." -ForegroundColor Yellow
Get-ChildItem -LiteralPath $cloneDir -Force |
    Where-Object { $_.Name -ne '.git' } |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force }

# 2) Copy this local folder into the clone (skip node_modules, .git, and TEMP clone).
Write-Host "Copying local files into the repo ..." -ForegroundColor Green
robocopy $source $cloneDir /E /XD node_modules .git $cloneDir /XF "sync-repo-to-github.ps1" /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed (code $LASTEXITCODE)." }

# 3) Commit and push (normal commit, not force).
Push-Location $cloneDir
try {
    git add -A
    git commit -m "Sync site + add ad-free CloudNestra resolver / Render blueprint" 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "Nothing to commit (already up to date)." -ForegroundColor Yellow }
    Write-Host "Pushing to main ..." -ForegroundColor Cyan
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "git push failed. Sign in with your GitHub account and re-run." }
    Write-Host "`nDone. GitHub now matches your local folder. Go to Render and click Retry." -ForegroundColor Green
}
finally {
    Pop-Location
}
