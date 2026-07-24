using System.Diagnostics;
using System.Formats.Tar;
using System;
using System.IO;
using System.Reflection;
using System.Text;

const string appName = "SK POS";
var target = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), appName);
var powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe");

// Allow the updater to replace the launcher executable even when the old
// installed version is still open.
foreach (var process in Process.GetProcessesByName("SK POS"))
{
    try { process.Kill(entireProcessTree: true); process.WaitForExit(3000); } catch { }
}

// The local HTTP server is a separate hidden PowerShell process. Stop only
// the instance belonging to this installation so an update cannot keep
// serving the previous files from the old process.
var targetForScript = target.Replace("'", "''");
var stopServerScript = $@"
$target = '{targetForScript}';
Get-CimInstance Win32_Process -Filter ""Name='powershell.exe'"" |
  Where-Object {{ $_.CommandLine -and $_.CommandLine -like '*offline-server.ps1*' -and $_.CommandLine -like ('*' + $target + '*') }} |
  ForEach-Object {{ try {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }} catch {{ }} }};
";
var stopServerEncoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(stopServerScript));
using (var stopServer = Process.Start(new ProcessStartInfo(powershell, "-NoProfile -ExecutionPolicy Bypass -EncodedCommand " + stopServerEncoded)
{
    UseShellExecute = false,
    CreateNoWindow = true
}))
{
    stopServer?.WaitForExit(10000);
}
Directory.CreateDirectory(target);

using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.tar")
    ?? throw new InvalidOperationException("Embedded program files are missing.");
TarFile.ExtractToDirectory(resource, target, overwriteFiles: true);

var launcher = Path.Combine(target, "SK POS.exe");
var launcherPath = launcher.Replace("'", "''");
var targetPath = target.Replace("'", "''");
var shortcutScript = $@"
$w = New-Object -ComObject WScript.Shell;
$desktop = [Environment]::GetFolderPath('Desktop');
$start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs';
New-Item -ItemType Directory -Path $start -Force | Out-Null;
foreach ($p in @((Join-Path $desktop 'SK POS.lnk'), (Join-Path $start 'SK POS.lnk'))) {{
  $s = $w.CreateShortcut($p); $s.TargetPath = '{launcherPath}';
  $s.Arguments = ''; $s.WorkingDirectory = '{targetPath}'; $s.IconLocation = '{launcherPath},0';
  $s.Description = 'SK POS Offline'; $s.Save();
}}
";
var encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(shortcutScript));
using var shortcut = Process.Start(new ProcessStartInfo(powershell, "-NoProfile -ExecutionPolicy Bypass -EncodedCommand " + encoded) { UseShellExecute = false, CreateNoWindow = true });
shortcut?.WaitForExit(10000);
Process.Start(new ProcessStartInfo(launcher) { UseShellExecute = true });

Console.WriteLine($"{appName} installed to {target}");
