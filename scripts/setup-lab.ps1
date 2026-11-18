param(
  [switch]$CheckOnly,
  [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $labRoot

function Find-Tool([string] $Name) {
  $app = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($app) { return $app.Source }
}

function Refresh-ToolPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$env:Path;$machine;$user"
}

function Install-Tool([string] $Id) {
  if (-not (Find-Tool 'winget.exe')) { throw 'WinGet is missing. Install Microsoft App Installer, then try again.' }
  Write-Host ("Installing from WinGet: " + $Id)
  & winget.exe install --id $Id --exact --source winget --no-upgrade
  if ($LASTEXITCODE -ne 0) { throw "WinGet could not install $Id. Read its message and retry." }
  Refresh-ToolPath
}

function Find-Gcc {
  $gcc = Find-Tool 'gcc.exe'
  if ($gcc) { return $gcc }
  $msys = if ($env:LEARNVERSE_MSYS2) { $env:LEARNVERSE_MSYS2 } else { Join-Path $env:SystemDrive 'msys64' }
  $candidate = Join-Path $msys 'ucrt64\bin\gcc.exe'
  if (Test-Path -LiteralPath $candidate) { return $candidate }
}

function Find-Jdk {
  $compiler = Find-Tool 'javac.exe'
  $runtime = Find-Tool 'java.exe'
  if ($compiler -and $runtime) { return @($compiler, $runtime) }
  if ($env:JAVA_HOME) {
    $compiler = Join-Path $env:JAVA_HOME 'bin\javac.exe'
    $runtime = Join-Path $env:JAVA_HOME 'bin\java.exe'
    if ((Test-Path $compiler) -and (Test-Path $runtime)) { return @($compiler, $runtime) }
  }
  $temurin = Join-Path $env:ProgramFiles 'Eclipse Adoptium'
  $available = Get-ChildItem -LiteralPath $temurin -Directory -ErrorAction SilentlyContinue |
    Where-Object { (Test-Path (Join-Path $_.FullName 'bin\javac.exe')) -and (Test-Path (Join-Path $_.FullName 'bin\java.exe')) } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($available) { return @((Join-Path $available.FullName 'bin\javac.exe'), (Join-Path $available.FullName 'bin\java.exe')) }
}

function Test-NodeVersion {
  $node = Find-Tool 'node.exe'
  if (-not $node) { return $false }
  $version = (& $node -p "process.versions.node" 2>$null)
  if ($LASTEXITCODE -ne 0 -or -not $version) { return $false }
  return ([version]$version -ge [version]'22.12.0')
}

$gcc = Find-Gcc
$jdk = @(Find-Jdk)
if ($CheckOnly) {
  [pscustomobject]@{ Node22_12OrNewer = Test-NodeVersion; GCC = $gcc; JavaCompiler = $jdk[0]; JavaRuntime = $jdk[1] } | ConvertTo-Json -Compress
  return
}

if (-not [Environment]::Is64BitOperatingSystem) { throw 'This installer requires 64-bit Windows.' }
Write-Host 'LEARNVERSE desktop lab. Missing tools only: Node.js LTS, Temurin JDK 21, and MSYS2 UCRT64 GCC.'
Write-Host 'The local compiler is private to this computer. It runs only code you choose, with your Windows account.'
if (-not (Test-NodeVersion)) { Install-Tool 'OpenJS.NodeJS.LTS' }
if (-not (Test-NodeVersion)) { throw 'Node.js 22.12 or newer is required. Open this launcher again after installation.' }
if ($jdk.Count -lt 2) {
  Install-Tool 'EclipseAdoptium.Temurin.21.JDK'
  $jdk = @(Find-Jdk)
}
if (-not $gcc) {
  $msys = if ($env:LEARNVERSE_MSYS2) { $env:LEARNVERSE_MSYS2 } else { Join-Path $env:SystemDrive 'msys64' }
  $bash = Join-Path $msys 'usr\bin\bash.exe'
  if (-not (Test-Path -LiteralPath $bash)) { Install-Tool 'MSYS2.MSYS2' }
  if (-not (Test-Path -LiteralPath $bash)) { throw 'MSYS2 was not found. If installed elsewhere, set LEARNVERSE_MSYS2 to its folder and try again.' }
  $env:MSYSTEM = 'UCRT64'
  $env:CHERE_INVOKING = '1'
  # The first update can replace the MSYS2 runtime and close its shell. A new shell completes the update.
  & $bash -lc 'pacman --noconfirm -Syu'
  & $bash -lc 'pacman --noconfirm -Syu --needed mingw-w64-ucrt-x86_64-gcc'
  if ($LASTEXITCODE -ne 0) { throw 'MSYS2 package installation failed. Read the pacman message and retry.' }
  $gcc = Find-Gcc
}
if (-not $gcc -or $jdk.Count -lt 2) { throw 'Could not locate both native compilers. Run the check-only mode to see missing paths.' }

$env:LEARNVERSE_GCC = $gcc
$env:LEARNVERSE_JAVAC = $jdk[0]
$env:LEARNVERSE_JAVA = $jdk[1]
$env:Path = (Split-Path -Parent $gcc) + ';' + $env:Path

& npm.cmd ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm could not install the website dependencies.' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'The website build failed.' }

if (-not $NoLaunch) {
  Write-Host 'Keep this window open while using the local lab.'
  & node.exe (Join-Path $PSScriptRoot 'local-lab.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Could not start the local lab.' }
}
