param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$target = Join-Path $repoRoot "public\nature-assets"
$temp = Join-Path $env:TEMP ("pixelchat-nature-pack-" + [guid]::NewGuid().ToString("N"))

try {
  if (-not (Test-Path -LiteralPath $ZipPath)) {
    throw "ZIP not found: $ZipPath"
  }

  Expand-Archive -LiteralPath $ZipPath -DestinationPath $temp -Force
  $packRoot = Join-Path $temp "PixelChat_Nature_Mega_Pack_v1"
  if (-not (Test-Path -LiteralPath $packRoot)) {
    throw "The ZIP does not contain PixelChat_Nature_Mega_Pack_v1."
  }

  $pngs = Get-ChildItem -LiteralPath $packRoot -Recurse -Filter *.png
  if ($pngs.Count -lt 45) {
    throw "Only $($pngs.Count) PNG assets found. Refusing to replace the existing pack."
  }

  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Get-ChildItem -LiteralPath $target -Force | Remove-Item -Recurse -Force

  Get-ChildItem -LiteralPath $packRoot -Directory | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
  }

  $installed = Get-ChildItem -LiteralPath $target -Recurse -Filter *.png
  Write-Host "Installed $($installed.Count) Nature Mega Pack PNG assets." -ForegroundColor Green
  Write-Host "Location: $target"
} finally {
  if (Test-Path -LiteralPath $temp) {
    Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
