$ErrorActionPreference = 'Stop'
$root = (Split-Path -Parent $MyInvocation.MyCommand.Path)
$port = 8765
$prefix = "http://127.0.0.1:$port/"

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "SK POS offline is running at $prefix" -ForegroundColor Green
Write-Host "Close this window to stop the local program." -ForegroundColor Yellow
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.gif' = 'image/gif'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'
}

function Minimize-SkPosWindow {
  if (-not ('SkPosWindowControl' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SkPosWindowControl {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr extra);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
  delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr extra);
  public static bool Minimize(uint[] processIds) {
    var found = false;
    EnumWindows((hWnd, extra) => {
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      var title = new StringBuilder(256);
      GetWindowText(hWnd, title, title.Capacity);
      // Customer display is a second window in the same Edge profile. Keep it
      // visible on the other monitor when the cashier minimizes the POS.
      var isCustomerDisplay = title.ToString().IndexOf("หน้าจอลูกค้า", StringComparison.OrdinalIgnoreCase) >= 0 ||
                              title.ToString().IndexOf("customer display", StringComparison.OrdinalIgnoreCase) >= 0;
      if (IsWindowVisible(hWnd) && !isCustomerDisplay && Array.IndexOf(processIds, pid) >= 0) {
        ShowWindowAsync(hWnd, 6);
        found = true;
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@
  }
  $profileToken = Join-Path $root 'edge-profile'
  $targets = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($profileToken, [StringComparison]::OrdinalIgnoreCase) -ge 0 }
  if (-not $targets) { return $false }
  return [SkPosWindowControl]::Minimize([uint32[]]@($targets | ForEach-Object { $_.ProcessId }))
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
      if ($relative -eq 'minimize') {
        $ok = Minimize-SkPosWindow
        $payload = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json @{ ok = [bool]$ok }))
        $context.Response.StatusCode = if ($ok) { 200 } else { 404 }
        $context.Response.ContentType = 'application/json; charset=utf-8'
        $context.Response.ContentLength64 = $payload.Length
        if ($context.Request.HttpMethod -ne 'HEAD') { $context.Response.OutputStream.Write($payload, 0, $payload.Length) }
        $context.Response.Close()
        continue
      }
      if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $relative))
      if (-not $file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
        $context.Response.StatusCode = 404
        $context.Response.Close()
        continue
      }
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
      $context.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $context.Response.ContentLength64 = $bytes.Length
      if ($context.Request.HttpMethod -ne 'HEAD') { $context.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
      $context.Response.Close()
    } catch {
      try { $context.Response.StatusCode = 500; $context.Response.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
