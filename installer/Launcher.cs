#nullable enable
using System.Diagnostics;
using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

const string url = "http://127.0.0.1:8765/index.html";
var root = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
var server = Path.Combine(root, "offline-server.ps1");
var powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe");

if (!await IsReady())
{
    Process.Start(new ProcessStartInfo(powershell,
        $"-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{server}\"")
    {
        UseShellExecute = false,
        CreateNoWindow = true,
        WindowStyle = ProcessWindowStyle.Hidden
    });
    for (var i = 0; i < 30 && !await IsReady(); i++) await Task.Delay(200);
}

var edge = FindEdge();
if (edge is not null)
{
    // Edge kiosk mode gives the POS a true full-screen app window without
    // address bars or browser chrome. Exit with Alt+F4.
    // Keep a separate profile so an already-open Edge/InPrivate session cannot
    // intercept the launch or restore the wrong start page.
    var edgeProfile = Path.Combine(root, "edge-profile");
    Directory.CreateDirectory(edgeProfile);
    Process.Start(new ProcessStartInfo(edge,
        $"--kiosk {url} --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --user-data-dir=\"{edgeProfile}\"")
    { UseShellExecute = true });
}
else
{
    Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
}

async Task<bool> IsReady()
{
    try { using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(350) }; using var response = await client.GetAsync(url); return response.IsSuccessStatusCode; }
    catch { return false; }
}

string? FindEdge()
{
    var candidates = new[]
    {
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe")
    };
    return candidates.FirstOrDefault(File.Exists);
}
