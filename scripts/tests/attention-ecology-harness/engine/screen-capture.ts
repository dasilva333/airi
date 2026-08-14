/**
 * Cross-platform desktop screen capture engine for Attention Ecology harness.
 * Supports macOS (screencapture), Windows (PowerShell GDI BitBlt), and Linux (import/scrot/grim).
 * Automatically provides fixture frame simulation mode for headless CI or fallback.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { execFileSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURES_DIR = path.join(HARNESS_ROOT, 'test-screenshots')

export const FIXTURE_FRAMES = [
  { id: '01', file: '01-static-editor.png', desc: 'Baseline Work Centroid v0 (VS Code)' },
  { id: '02', file: '02-static-editor-cursor.png', desc: 'Static Micro-Change (Stage 0 Filtered)' },
  { id: '03', file: '03-window-switch-term.png', desc: 'Context Switch to Terminal (Stage 1 Novelty Spike)' },
  { id: '04', file: '04-term-error-stack.png', desc: 'Terminal Error Cascade (Stage 2 OCR Promoted)' },
  { id: '05a', file: '05a-browser-video-frame1.png', desc: 'Browser Video Stream Baseline' },
  { id: '05b', file: '05b-browser-video-frame2.png', desc: 'Browser Video Drift (Stage 1 Centroid Muted)' },
]

export interface CaptureResult {
  success: boolean
  method: string
  isSimulated: boolean
  error?: string
  fixtureDesc?: string
}

export class DesktopCaptureManager {
  private simulated: boolean = false
  private simulationTick: number = 0
  private winScriptPath: string | null = null

  constructor(options?: { simulated?: boolean }) {
    this.simulated = !!options?.simulated
  }

  public get isSimulated(): boolean {
    return this.simulated
  }

  public set isSimulated(val: boolean) {
    this.simulated = val
  }

  public toggleSimulation(): boolean {
    this.simulated = !this.simulated
    return this.simulated
  }

  public getMethodName(): string {
    if (this.simulated)
      return 'Simulation (Test Fixtures)'
    if (process.platform === 'darwin')
      return 'macOS screencapture'
    if (process.platform === 'win32')
      return 'Windows GDI BitBlt'
    if (process.platform === 'linux')
      return 'Linux Screen Capture'
    return 'Generic Desktop'
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
    if (this.simulated) {
      const fixture = FIXTURE_FRAMES[this.simulationTick % FIXTURE_FRAMES.length]
      this.simulationTick++
      const fixturePath = path.join(FIXTURES_DIR, fixture.file)
      if (fs.existsSync(fixturePath)) {
        fs.copyFileSync(fixturePath, destPath)
        return {
          success: true,
          method: 'Simulation (Test Fixture)',
          isSimulated: true,
          fixtureDesc: `[#${fixture.id}] ${fixture.desc}`,
        }
      }
    }

    // Attempt Native Screen Capture
    try {
      if (process.platform === 'darwin') {
        execSync(`screencapture -x "${destPath}"`, { stdio: 'ignore' })
        if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
          return { success: true, method: 'macOS screencapture', isSimulated: false }
        }
      }
      else if (process.platform === 'win32') {
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
          return { success: true, method: 'Windows GDI', isSimulated: false }
        }
      }
      else if (process.platform === 'linux') {
        // Try common Linux capture tools in order
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
              return { success: true, method: cmd.split(' ')[0], isSimulated: false }
            }
          }
          catch {}
        }
      }
    }
    catch (err: any) {
      // Native capture failed; fallback to simulation
      this.simulated = true
      return this.capture(destPath)
    }

    // If native capture didn't produce a valid file, fallback to simulation
    this.simulated = true
    return this.capture(destPath)
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
