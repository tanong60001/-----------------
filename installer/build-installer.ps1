$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$staging = Join-Path $env:TEMP "sk-pos-installer-$([guid]::NewGuid().ToString('N'))"
$sourceRoot = Join-Path $staging 'source'
$projectRoot = Join-Path $staging 'project'
$publishRoot = Join-Path $staging 'publish'
$launcherPublish = Join-Path $staging 'launcher-publish'
New-Item -ItemType Directory -Path $sourceRoot,$projectRoot,$publishRoot,$launcherPublish -Force | Out-Null

$runtimeExtensions = @('.html', '.js', '.css', '.json', '.webmanifest', '.ps1')
Get-ChildItem -LiteralPath $root -File -Force | Where-Object {
  $runtimeExtensions -contains $_.Extension.ToLowerInvariant()
} | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $sourceRoot -Force }
$assetsRoot = Join-Path $root 'assets'
Get-ChildItem -LiteralPath $assetsRoot -Recurse -File | ForEach-Object {
  $relative = $_.FullName.Substring($assetsRoot.Length).TrimStart('\')
  $dest = Join-Path $sourceRoot (Join-Path 'assets' $relative)
  New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
  Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
}

# Build the app launcher first. The PNG is wrapped as a PNG-backed ICO so the
# Desktop/Start Menu shortcut uses the SK POS icon instead of PowerShell's icon.
$png = [IO.File]::ReadAllBytes((Join-Path $root 'assets\app-icon-sk-192.png'))
$ico = Join-Path $projectRoot 'app.ico'
$stream = [IO.MemoryStream]::new(); $writer = [IO.BinaryWriter]::new($stream)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22); $writer.Write($png)
$writer.Flush(); [IO.File]::WriteAllBytes($ico, $stream.ToArray()); $writer.Dispose(); $stream.Dispose()
Copy-Item -LiteralPath (Join-Path $root 'installer\Launcher.csproj') -Destination $projectRoot -Force
Copy-Item -LiteralPath (Join-Path $root 'installer\Launcher.cs') -Destination $projectRoot -Force
& dotnet publish (Join-Path $projectRoot 'Launcher.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $launcherPublish
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
$launcherExe = Join-Path $launcherPublish 'SK POS.exe'
if (-not (Test-Path -LiteralPath $launcherExe)) { throw "Launcher creation failed: $launcherExe" }
Copy-Item -LiteralPath $launcherExe -Destination (Join-Path $sourceRoot 'SK POS.exe') -Force

$archive = Join-Path $projectRoot 'payload.tar'
& tar.exe -cf $archive -C $sourceRoot .
Copy-Item -LiteralPath (Join-Path $root 'installer\Installer.csproj') -Destination $projectRoot -Force
Copy-Item -LiteralPath (Join-Path $root 'installer\Program.cs') -Destination $projectRoot -Force

& dotnet publish (Join-Path $projectRoot 'Installer.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $publishRoot
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed' }
$exe = Join-Path $publishRoot 'SK POS Setup.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "Installer creation failed: $exe" }
$target = Join-Path $root 'SK POS Setup.exe'
Copy-Item -LiteralPath $exe -Destination $target -Force
Write-Host "Installer created: $target" -ForegroundColor Green
Remove-Item -LiteralPath $staging -Recurse -Force
