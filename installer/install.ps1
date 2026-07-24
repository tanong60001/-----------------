$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $env:LOCALAPPDATA 'SK POS'

New-Item -ItemType Directory -Path $target -Force | Out-Null
$archive = Join-Path $source 'payload.tar'
if (-not (Test-Path -LiteralPath $archive)) {
  $parts = @(Get-ChildItem -LiteralPath $source -Filter 'payload.part*' -File | Sort-Object Name)
  if ($parts.Count) {
    $archive = Join-Path $env:TEMP ("sk-pos-payload-$([guid]::NewGuid().ToString('N')).tar")
    $out = [IO.File]::OpenWrite($archive)
    try { foreach ($part in $parts) { $bytes = [IO.File]::ReadAllBytes($part.FullName); $out.Write($bytes, 0, $bytes.Length) } }
    finally { $out.Close() }
  }
}
if (Test-Path -LiteralPath $archive) {
  & tar.exe -xf $archive -C $target
  if ($archive -like "$env:TEMP\sk-pos-payload-*.tar") { Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue }
} else {
  Get-ChildItem -LiteralPath $source -Force | Where-Object { $_.Name -ne 'install.ps1' } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
  }
}

$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
New-Item -ItemType Directory -Path $startMenu -Force | Out-Null

function New-SkShortcut([string]$path) {
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$target\offline-server.ps1`""
  $shortcut.WorkingDirectory = $target
  $shortcut.Description = 'SK POS Offline'
  $shortcut.Save()
}

New-SkShortcut (Join-Path $desktop 'SK POS.lnk')
New-SkShortcut (Join-Path $startMenu 'SK POS.lnk')
$launcher = Get-ChildItem -LiteralPath $target -Filter '*.bat' -File | Select-Object -First 1
if ($launcher) { Start-Process $launcher.FullName }
