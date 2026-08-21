using System.Runtime.InteropServices;

public static class WinMessageBox
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int MessageBoxW(
        System.IntPtr hWnd,
        string lpText,
        string lpCaption,
        uint uType
    );

    public static void Show(string text, string title = "Debug")
    {
        MessageBoxW(System.IntPtr.Zero, text, title, 0);
    }
}
