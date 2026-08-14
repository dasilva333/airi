/**
 * Cross-platform live desktop screen capture engine for Attention Ecology harness.
 * Supports macOS (screencapture), Windows (PowerShell GDI BitBlt), and Linux (import/scrot/grim/maim).
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { execFileSync, execSync } from 'node:child_process'

export interface CaptureResult {
  success: boolean
  method: string
  error?: string
}

export class DesktopCaptureManager {
  private winScriptPath: string | null = null

  public getMethodName(): string {
    if (process.platform === 'darwin')
      return 'macOS screencapture'
    if (process.platform === 'win32')
      return 'Windows GDI'
    if (process.platform === 'linux')
      return 'Linux Screen Capture'
    return 'Generic Desktop Capture'
  }

  private ensureWindowsScript(): string {
    if (this.winScriptPath && fs.existsSync(this.winScriptPath)) {
      return this.winScriptPath
    }
    const scriptPath = path.join(os.tmpdir(), 'airi-wincap.ps1')
    const psCode = `param([string]$outPath)
$code = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class WinCap {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, int dwRop);
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    public static bool Capture(string path) {
        try {
            int w = GetSystemMetrics(0);
            int h = GetSystemMetrics(1);
            if (w <= 0 || h <= 0) return false;
            IntPtr hDesk = GetDesktopWindow();
            IntPtr hdcSrc = GetDC(hDesk);
            using (Bitmap bmp = new Bitmap(w, h)) {
                using (Graphics g = Graphics.FromImage(bmp)) {
                    IntPtr hdcDest = g.GetHdc();
                    BitBlt(hdcDest, 0, 0, w, h, hdcSrc, 0, 0, 0x00CC0020);
                    g.ReleaseHdc(hdcDest);
                }
                bmp.Save(path, ImageFormat.Png);
            }
            ReleaseDC(hDesk, hdcSrc);
            return true;
        } catch {
            return false;
        }
    }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'WinCap').Type) {
    Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
}
[WinCap]::Capture($outPath)
`
    fs.writeFileSync(scriptPath, psCode, 'utf-8')
    this.winScriptPath = scriptPath
    return scriptPath
  }

  public capture(destPath: string): CaptureResult {
    try {
      if (process.platform === 'darwin') {
        execSync(`screencapture -x "${destPath}"`, { stdio: 'ignore' })
        if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
          return { success: true, method: 'macOS screencapture' }
        }
        return { success: false, method: 'macOS screencapture', error: 'Empty screen capture output' }
      }

      if (process.platform === 'win32') {
        const script = this.ensureWindowsScript()
        execFileSync('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          script,
          destPath,
        ], { stdio: 'ignore' })
        if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
          return { success: true, method: 'Windows GDI' }
        }
        return { success: false, method: 'Windows GDI', error: 'Empty screen capture output' }
      }

      if (process.platform === 'linux') {
        const tools = [
          `import -window root "${destPath}"`,
          `scrot "${destPath}"`,
          `grim "${destPath}"`,
          `maim "${destPath}"`,
        ]
        for (const cmd of tools) {
          try {
            execSync(cmd, { stdio: 'ignore' })
            if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
              return { success: true, method: cmd.split(' ')[0] }
            }
          }
          catch {}
        }
        return { success: false, method: 'Linux Screen Capture', error: 'No working Linux screen capture tool found (install scrot/grim/maim/imagemagick)' }
      }

      return { success: false, method: 'Generic', error: `Unsupported platform: ${process.platform}` }
    }
    catch (err: any) {
      return { success: false, method: this.getMethodName(), error: err.message || String(err) }
    }
  }

  public dispose() {
    if (this.winScriptPath && fs.existsSync(this.winScriptPath)) {
      try {
        fs.unlinkSync(this.winScriptPath)
      }
      catch {}
    }
  }
}
