using System;
using System.Runtime.InteropServices;
using UnityEngine;

public static class WinMessageBox
{
#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int MessageBoxW(
        IntPtr hWnd,
        string lpText,
        string lpCaption,
        uint uType
    );
#endif

    public static void Show(string text, string title = "Debug")
    {
#if (UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        try
        {
            MessageBoxW(IntPtr.Zero, text, title, 0);
            return;
        }
        catch { }
#endif
        Debug.Log($"[MessageBox: {title}] {text}");
    }
}
