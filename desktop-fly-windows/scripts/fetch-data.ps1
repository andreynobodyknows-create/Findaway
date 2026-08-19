$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root "data"
New-Item -ItemType Directory -Force -Path $data | Out-Null

$rawBase = "https://raw.githubusercontent.com/DenisSergeevitch/desktop-fly/master/data"
$apiBase = "https://api.github.com/repos/DenisSergeevitch/desktop-fly/contents/data"

function Get-UpstreamFile([string]$name) {
    $dest = Join-Path $data $name
    $headers = @{ "User-Agent" = "DesktopFly-Windows" }

    if ($env:GITHUB_TOKEN) {
        $headers["Authorization"] = "Bearer $env:GITHUB_TOKEN"
        $headers["Accept"] = "application/vnd.github.raw+json"
        $headers["X-GitHub-Api-Version"] = "2022-11-28"
        Invoke-WebRequest "$apiBase/$name`?ref=master" -Headers $headers -OutFile $dest
    }
    else {
        Invoke-WebRequest "$rawBase/$name" -Headers $headers -OutFile $dest
    }
}

Write-Host "Fetching derived FlyWire FAFB v783 data..."
Get-UpstreamFile "circuit.json"
Get-UpstreamFile "brain_points.json"
Get-UpstreamFile "DATA_LICENSE.md"

foreach ($name in @("circuit.json", "brain_points.json", "DATA_LICENSE.md")) {
    $path = Join-Path $data $name
    if (-not (Test-Path $path) -or (Get-Item $path).Length -eq 0) {
        throw "$name was not downloaded correctly"
    }
}

Write-Host "Done. Data written to $data"
Write-Host "Data is CC BY-NC 4.0; see data/DATA_LICENSE.md."
