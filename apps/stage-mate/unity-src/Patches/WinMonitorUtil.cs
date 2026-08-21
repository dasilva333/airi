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

#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
    [DllImport("user32.dll", EntryPoint = "GetActiveWindow")]
    static extern IntPtr GetActiveWindow_Win32();

    [DllImport("user32.dll", EntryPoint = "GetWindowRect")]
    static extern bool GetWindowRect_Win32(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll")]
    static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    const uint MONITOR_DEFAULTTONEAREST = 2;
#endif

    public static IntPtr GetActiveWindow()
    {
#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            return GetActiveWindow_Win32();
        }
        catch { }
#endif
        return IntPtr.Zero;
    }

    public static bool GetWindowRect(IntPtr hWnd, out RECT lpRect)
    {
        lpRect = default;
#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            return GetWindowRect_Win32(hWnd, out lpRect);
        }
        catch { }
#endif
        int w = UnityEngine.Screen.width;
        int h = UnityEngine.Screen.height;
        lpRect = new RECT { left = 0, top = 0, right = w, bottom = h };
        return true;
    }

    // -----------------------------
    // Public helper
    // -----------------------------

    public static bool TryGetCurrentMonitor(out RECT monitorRect)
    {
        monitorRect = default;

#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            IntPtr hwnd = GetActiveWindow();
            if (hwnd != IntPtr.Zero)
            {
                IntPtr monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                if (monitor != IntPtr.Zero)
                {
                    MONITORINFO info = new MONITORINFO();
                    info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));

                    if (GetMonitorInfo(monitor, ref info))
                    {
                        monitorRect = info.rcMonitor;
                        return true;
                    }
                }
            }
        }
        catch { }
#endif

        int w = UnityEngine.Screen.width > 0 ? UnityEngine.Screen.width : UnityEngine.Screen.currentResolution.width;
        int h = UnityEngine.Screen.height > 0 ? UnityEngine.Screen.height : UnityEngine.Screen.currentResolution.height;
        if (w <= 0) w = 1920;
        if (h <= 0) h = 1080;
        monitorRect = new RECT { left = 0, top = 0, right = w, bottom = h };
        return true;
    }
}
