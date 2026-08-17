using UnityEngine;
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class SettingsMenuPosition : MonoBehaviour
{
    [System.Serializable]
    public class MenuConfig
    {
        public RectTransform settingsMenu;
        public float offsetRight = 30f;
        [HideInInspector] public float originalX;
        [HideInInspector] public float originalY;
        [HideInInspector] public Vector2 lastApplied;
    }

    [Header("Menus")]
    public List<MenuConfig> menus = new List<MenuConfig>();

    [Header("Settings")]
    public float monitorRefreshInterval = 0.5f;

    private IntPtr unityHWND;

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int left, top, right, bottom; }

    private delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);

#if UNITY_STANDALONE_WIN
    [DllImport("user32.dll")]
    private static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
#endif

    private readonly List<RECT> monitorRects = new List<RECT>();
    private MonitorEnumProc enumProc;
    private float checkTimer;
    private float monitorTimer;
    private bool lastAtRightEdge;
    private bool initedEdge;

    void Start()
    {
#if UNITY_STANDALONE_WIN
        unityHWND = Process.GetCurrentProcess().MainWindowHandle;
        enumProc = EnumProc;
        RefreshMonitors();
#endif
        foreach (var menu in menus)
        {
            if (!menu.settingsMenu) continue;
            menu.originalX = menu.settingsMenu.anchoredPosition.x;
            menu.originalY = menu.settingsMenu.anchoredPosition.y;
            menu.lastApplied = menu.settingsMenu.anchoredPosition;
        }
    }

    void Update()
    {
        if (unityHWND == IntPtr.Zero) return;

        monitorTimer += Time.unscaledDeltaTime;
        if (monitorTimer >= Mathf.Max(0.1f, monitorRefreshInterval))
        {
            monitorTimer = 0f;
            RefreshMonitors();
        }

        checkTimer += Time.unscaledDeltaTime;
        if (checkTimer >= 0.05f)
        {
            checkTimer = 0f;
            CheckAndAdjustPosition();
        }
    }

    private void RefreshMonitors()
    {
#if UNITY_STANDALONE_WIN
        monitorRects.Clear();
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, enumProc, IntPtr.Zero);
#endif
    }

    private bool EnumProc(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData)
    {
        monitorRects.Add(lprcMonitor);
        return true;
    }

    private void CheckAndAdjustPosition()
    {
#if UNITY_STANDALONE_WIN
        if (!GetWindowRect(unityHWND, out RECT winRect)) return;

        RECT currentMonitor = GetMonitorForWindow(winRect);
        int winWidth = winRect.right - winRect.left;

        bool atRightEdge = (winRect.left + winWidth >= currentMonitor.right - 100);

        if (!initedEdge || atRightEdge != lastAtRightEdge)
        {
            initedEdge = true;
            lastAtRightEdge = atRightEdge;

            foreach (var menu in menus)
            {
                if (!menu.settingsMenu) continue;

                float targetX = atRightEdge ? menu.offsetRight : menu.originalX;

                if (Mathf.Abs(menu.settingsMenu.anchoredPosition.x - targetX) > 0.5f)
                {
                    menu.settingsMenu.anchoredPosition = new Vector2(targetX, menu.originalY);
                    menu.lastApplied = menu.settingsMenu.anchoredPosition;
                }
            }
        }
#endif
    }

    private RECT GetMonitorForWindow(RECT winRect)
    {
        int winCenterX = (winRect.left + winRect.right) / 2;
        int winCenterY = (winRect.top + winRect.bottom) / 2;

        foreach (var mon in monitorRects)
        {
            if (winCenterX >= mon.left && winCenterX < mon.right &&
                winCenterY >= mon.top && winCenterY < mon.bottom)
                return mon;
        }

        return monitorRects.Count > 0 ? monitorRects[0] : new RECT { left = 0, top = 0, right = Screen.currentResolution.width, bottom = Screen.currentResolution.height };
    }
}
