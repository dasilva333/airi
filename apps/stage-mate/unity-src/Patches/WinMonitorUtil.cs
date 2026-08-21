using System;
using System.Runtime.InteropServices;

public static class WinMonitorUtil
{
    // -----------------------------
    // Win32 structs
    // -----------------------------

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int left, top, right, bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    // -----------------------------
    // Win32 imports
    // -----------------------------

    [DllImport("user32.dll")]
    public static extern IntPtr GetActiveWindow();

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll")]
    static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    const uint MONITOR_DEFAULTTONEAREST = 2;

    // -----------------------------
    // Public helper
    // -----------------------------

    public static bool TryGetCurrentMonitor(out RECT monitorRect)
    {
        monitorRect = default;

        IntPtr hwnd = GetActiveWindow();
        if (hwnd == IntPtr.Zero)
            return false;

        IntPtr monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if (monitor == IntPtr.Zero)
            return false;

        MONITORINFO info = new MONITORINFO();
        info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));

        if (!GetMonitorInfo(monitor, ref info))
            return false;

        monitorRect = info.rcMonitor;
        return true;
    }
}
