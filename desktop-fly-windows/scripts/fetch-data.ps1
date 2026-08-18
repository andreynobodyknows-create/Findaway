$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$data = Join-Path $root "data"
New-Item -ItemType Directory -Force -Path $data | Out-Null

$base = "https://raw.githubusercontent.com/DenisSergeevitch/desktop-fly/master/data"
Write-Host "Fetching derived FlyWire FAFB v783 data..."
Invoke-WebRequest "$base/circuit.json" -OutFile (Join-Path $data "circuit.json")
Invoke-WebRequest "$base/brain_points.json" -OutFile (Join-Path $data "brain_points.json")
Invoke-WebRequest "$base/DATA_LICENSE.md" -OutFile (Join-Path $data "DATA_LICENSE.md")
Write-Host "Done. Data is CC BY-NC 4.0; see data/DATA_LICENSE.md."
