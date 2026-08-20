using System;
using System.Runtime.InteropServices;
using UnityEngine;

public static class MonitorHelper
{
#if (UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX)
    [DllImport("__Internal")]
    private static extern void GetMacScreenDockRect(out float x, out float y, out float width, out float height);
#endif

    // -- Monitor lookup ----------------------------------------------------
    public const uint MONITOR_DEFAULTTONEAREST = 0x00000002;

#if UNITY_STANDALONE_WIN
    [DllImport("user32.dll")]
    public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    [StructLayout(LayoutKind.Sequential)]
    struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct RECT
    {
        public int Left, Top, Right, Bottom;
    }
#endif

    /// <summary>
    /// Returns the taskbar/dock Rect on whichever monitor contains the given window handle.
    /// </summary>
    public static Rect GetTaskbarRectForWindow(IntPtr windowHandle)
    {
#if (UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX)
        try
        {
            GetMacScreenDockRect(out float dx, out float dy, out float dw, out float dh);
            if (dw > 0f && dh > 0f)
            {
                return new Rect(dx, dy, dw, dh);
            }
        }
        catch { }

        // Dynamic fallback for macOS Editor or if native bridge is not bound
        float screenW = Display.main.systemWidth > 0 ? Display.main.systemWidth : Screen.width;
        float dockH = 66f;
        return new Rect(0, 0, screenW, dockH);
#elif UNITY_STANDALONE_WIN
        var hMon = MonitorFromWindow(windowHandle, MONITOR_DEFAULTTONEAREST);
        var mi = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
        if (!GetMonitorInfo(hMon, ref mi))
            return new Rect(0, 0, 0, 0);

        var mon = new Rect(mi.rcMonitor.Left,
                            mi.rcMonitor.Top,
                            mi.rcMonitor.Right - mi.rcMonitor.Left,
                            mi.rcMonitor.Bottom - mi.rcMonitor.Top);
        var work = new Rect(mi.rcWork.Left,
                            mi.rcWork.Top,
                            mi.rcWork.Right - mi.rcWork.Left,
                            mi.rcWork.Bottom - mi.rcWork.Top);

        // whichever edge of work is smaller than mon is the taskbar
        if (work.yMin > mon.yMin)
            return new Rect(mon.xMin, mon.yMin, mon.width, work.yMin - mon.yMin);
        if (work.xMin > mon.xMin)
            return new Rect(mon.xMin, mon.yMin, work.xMin - mon.xMin, mon.height);
        if (work.xMax < mon.xMax)
            return new Rect(work.xMax, mon.yMin, mon.xMax - work.xMax, mon.height);
        if (work.yMax < mon.yMax)
            return new Rect(mon.xMin, work.yMax, mon.width, mon.yMax - work.yMax);

        return new Rect(0, 0, 0, 0);
#else
        return new Rect(0, 0, 0, 0);
#endif
    }

    // -- DPI / scaling lookup ----------------------------------------------
#if UNITY_STANDALONE_WIN
    enum MONITOR_DPI_TYPE
    {
        MDT_EFFECTIVE_DPI = 0,
        MDT_ANGULAR_DPI = 1,
        MDT_RAW_DPI = 2
    }

    [DllImport("Shcore.dll")]
    static extern int GetDpiForMonitor(
        IntPtr hmonitor,
        MONITOR_DPI_TYPE dpiType,
        out uint dpiX,
        out uint dpiY
    );
#endif

    /// <summary>
    /// Returns the scale factor (e.g. 1.5 for 150% DPI) for the monitor containing the given window.
    /// </summary>
    public static float GetScaleForWindow(IntPtr windowHandle)
    {
#if UNITY_STANDALONE_WIN
        var hMon = MonitorFromWindow(windowHandle, MONITOR_DEFAULTTONEAREST);
        if (GetDpiForMonitor(hMon, MONITOR_DPI_TYPE.MDT_EFFECTIVE_DPI, out var dpiX, out var dpiY) == 0)
            return dpiX / 96f;  // Windows uses 96 DPI as "100%"

        return 1f;  // fallback on failure
#else
        return 1f;
#endif
    }
}
