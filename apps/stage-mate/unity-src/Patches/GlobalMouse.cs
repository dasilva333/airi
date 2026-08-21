using System;
using System.Runtime.InteropServices;
using UnityEngine;

public static class GlobalMouse
{
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int x;
        public int y;
    }

#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
    [DllImport("user32.dll")]
    static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    static extern short GetAsyncKeyState(int vKey);

    const int VK_LBUTTON = 0x01;
    const int VK_RBUTTON = 0x02;
#endif

    private static Vector2 streamedPosition = Vector2.zero;
    private static bool hasStreamedPosition = false;

    public static void SetStreamedPosition(float x, float y)
    {
        streamedPosition = new Vector2(x, y);
        hasStreamedPosition = true;
    }

    public static Vector2 GetPosition()
    {
        if (hasStreamedPosition)
        {
            return streamedPosition;
        }

#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            GetCursorPos(out POINT p);
            return new Vector2(p.x, p.y);
        }
        catch { }
#endif
        // Canonical top-left contract across macOS/Linux
        return new Vector2(Input.mousePosition.x, UnityEngine.Screen.height - Input.mousePosition.y);
    }

    static bool prevLeftDown;
    static bool prevRightDown;
    static bool LeftDown;
    static bool RightDown;
    static bool BothDown = false;
    static bool prevBothDown = false;
    static int wheelDelta;
    const int WM_MOUSEWHEEL = 0x020A;

    /// <summary>
    /// True only on the frame the left mouse button is released
    /// </summary>
    public static bool LeftMouseDown()
    {
#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            return (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;
        }
        catch { }
#endif
        return Input.GetMouseButton(0);
    }
    public static bool RightMouseDown()
    {
#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            return (GetAsyncKeyState(VK_RBUTTON) & 0x8000) != 0;
        }
        catch { }
#endif
        return Input.GetMouseButton(1);
    }
    public static bool LeftMouseUp()
    {
#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            bool isDown = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;
            bool upThisFrame = prevLeftDown && !isDown;
            BothDown = prevBothDown && !upThisFrame;
            prevLeftDown = isDown;
            return upThisFrame;
        }
        catch { }
#endif
        return Input.GetMouseButtonUp(0) || Input.GetMouseButtonDown(0);
    }
    public static bool RightMouseUp()
    {
#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            bool isDown = (GetAsyncKeyState(VK_RBUTTON) & 0x8000) != 0;
            bool upThisFrame = prevRightDown && !isDown;
            BothDown = prevBothDown && !upThisFrame;
            prevRightDown = isDown;
            return upThisFrame;
        }
        catch { }
#endif
        return Input.GetMouseButtonUp(1);
    }
    public static bool BothMouseDownOnce()
    {
        bool goif = false;
        //Debug.Log(BothDown.ToString());
        if (!BothDown)
        {
            prevBothDown = BothDown;
            BothDown = LeftMouseDown() && RightMouseDown();
            goif = BothDown;
        }
        return goif;
    }
    public static void OnMouseWheel(int delta)
    {
        wheelDelta += delta;
    }

    public static int ConsumeWheelDelta()
    {
        int delta = wheelDelta;
        wheelDelta = 0;
        return delta;
    }
    public static void AddWheelDelta(int delta)
    {
        wheelDelta += delta;
    }
    public static bool IsKeyDown(int vKey)
    {
#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            return (GetAsyncKeyState(vKey) & 0x8000) != 0;
        }
        catch { }
#endif
        return false;
    }

    //static void OnMouseHook(int msg, IntPtr lParam)
    //{
    //    if (msg == WM_MOUSEWHEEL)
    //    {
    //        // Kirurobo struct name may differ
    //        var data = Kirurobo.WinApi.MarshalHelper
    //            .PtrToStructure<Kirurobo.WinApi.MouseHookStruct>(lParam);

    //        int delta = (short)((data.mouseData >> 16) & 0xffff);
    //        GlobalMouse.AddWheelDelta(delta);
    //    }
    //}

}
