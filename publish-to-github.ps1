# Publishes the ad-free resolver + Render blueprint to your GitHub repo.
# It clones a FRESH copy of your repo (so nothing is force-pushed/overwritten),
# copies the new/changed files into it, commits, and pushes to main.
#
# Usage:
#   1. Open PowerShell in this folder (the ZIP-extracted site folder).
#   2. Run:  ./publish-to-github.ps1
#   3. When git asks, sign in with YOUR GitHub account (browser or token).

$ErrorActionPreference = 'Stop'

$repoUrl   = 'https://github.com/seangritthy/seangritthy.github.io.git'
$source    = $PSScriptRoot
$cloneDir  = Join-Path $env:TEMP ("ghpub_" + [System.Guid]::NewGuid().ToString('N').Substring(0,8))

# Files/folders to publish (relative to this folder).
$items = @(
    'render.yaml',
    'Dockerfile',
    '.dockerignore',
    'server.js',
    'package.json',
    'play.html',
    'api',
    'cloudflare-worker'
)

Write-Host "Cloning $repoUrl ..." -ForegroundColor Cyan
git clone $repoUrl $cloneDir
if ($LASTEXITCODE -ne 0) { throw "git clone failed. Check the repo URL / your access." }

foreach ($item in $items) {
    $src = Join-Path $source $item
    if (-not (Test-Path $src)) { Write-Host "  skip (missing): $item" -ForegroundColor DarkYellow; continue }
    $dest = Join-Path $cloneDir $item
    Write-Host "  copy: $item" -ForegroundColor Green
    if (Test-Path $src -PathType Container) {
        Copy-Item $src $dest -Recurse -Force
    } else {
        Copy-Item $src $dest -Force
    }
}

Push-Location $cloneDir
try {
    git add -A
    git -c user.name="$(git config user.name)" commit -m "Add ad-free CloudNestra resolver + Render blueprint" 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "Nothing to commit (files may already be up to date)." -ForegroundColor Yellow }
    Write-Host "Pushing to main ..." -ForegroundColor Cyan
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "git push failed. Sign in with your GitHub account and re-run." }
    Write-Host "`nDone. render.yaml is now on main. Go back to Render and click Retry." -ForegroundColor Green
}
finally {
    Pop-Location
}
