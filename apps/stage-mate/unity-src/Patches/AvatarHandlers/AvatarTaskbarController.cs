using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using UnityEngine;

[ExecuteAlways]
public class AvatarTaskbarController : MonoBehaviour
{
    [Header("Animator")]
    public Animator avatarAnimator;

    [Header("Detection Settings")]
    public Vector2 snapZoneOffset = new Vector2(0, 0);
    public Vector2 snapZoneSize = new Vector2(240, 80);

    [Header("Attach Settings")]
    public GameObject attachTarget;
    public HumanBodyBones attachBone = HumanBodyBones.Head;
    public bool keepOriginalRotation = false;

    [Header("Spawn / Despawn Animation")]
    public float spawnScaleTime = 0.2f;
    public float despawnScaleTime = 0.2f;

    [Header("Debug")]
    public bool showDebugGizmo = true;
    public Color taskbarGizmoColor = Color.green;
    public Color pinkZoneGizmoColor = Color.magenta;

    private IntPtr unityHWND = IntPtr.Zero;
    private Vector2 unityPos;
    private Rect taskbarRect;
    private Rect pinkZoneDesktopRect;

    private Animator animator;
    private Transform attachBoneTransform;
    private Transform originalAttachParent;

    private Vector3 originalScale = Vector3.one;
    private float scaleLerpT = 0f;
    private bool isScaling = false;
    private bool scalingUp = false;

    private bool wasAllowSpawn = false;
    private bool wasNearTaskbar = false;

    private static readonly int IsSitting = Animator.StringToHash("isSitting");
    private static readonly int IsTaskbarSit = Animator.StringToHash("isTaskbarSit");
    private static readonly int IsWindowSit = Animator.StringToHash("isWindowSit");
    private static readonly int WindowSitIndex = Animator.StringToHash("WindowSitIndex");

    void Start()
    {
#if UNITY_STANDALONE_WIN
        unityHWND = Process.GetCurrentProcess().MainWindowHandle;
#endif
        animator = avatarAnimator ?? GetComponent<Animator>();

        if (attachTarget != null)
        {
            originalScale = attachTarget.transform.localScale;
            originalAttachParent = attachTarget.transform.parent;
            attachTarget.SetActive(false);
        }

        UpdateTaskbarRect();
    }

    public void SetAnimator(Animator newAnimator)
    {
        avatarAnimator = newAnimator;
    }

    void Update()
    {
        if (animator == null)
            animator = avatarAnimator ?? GetComponent<Animator>();
        if (animator == null) return;

        UpdateUnityWindowPosition();
        UpdateTaskbarRect();
        UpdatePinkZone();

#if (UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX)
        // On macOS Cocoa: Dock is at bottom (y = 0..dockHeight)
        float dockHeight = taskbarRect.height > 0 ? taskbarRect.height : 66f;
        Rect dockZone = new Rect(taskbarRect.x, 0, taskbarRect.width, dockHeight + 45f);
        bool isNearTaskbar = pinkZoneDesktopRect.Overlaps(dockZone);
#else
        // Windows original: Taskbar top ledge is at taskbarRect.y
        Rect topBar = new Rect(taskbarRect.x, taskbarRect.y, taskbarRect.width, Mathf.Max(5f, taskbarRect.height * 0.35f));
        bool isNearTaskbar = pinkZoneDesktopRect.Overlaps(topBar);
#endif

        if (isNearTaskbar && !wasNearTaskbar)
        {
            animator.SetFloat(WindowSitIndex, UnityEngine.Random.Range(0, 4));
        }
        wasNearTaskbar = isNearTaskbar;

        animator.SetBool(IsSitting, isNearTaskbar);
        animator.SetBool(IsTaskbarSit, isNearTaskbar);
        animator.SetBool(IsWindowSit, isNearTaskbar);

        bool allowSpawn = isNearTaskbar && (
            animator.GetCurrentAnimatorStateInfo(0).IsName("Sitting") ||
            animator.GetCurrentAnimatorStateInfo(0).IsName("WindowSit") ||
            animator.GetCurrentAnimatorStateInfo(0).IsName("Sit")
        );

        if (attachBoneTransform == null && attachTarget != null)
            attachBoneTransform = animator.GetBoneTransform(attachBone);

        if (attachTarget != null)
        {
            if (allowSpawn && !keepOriginalRotation && attachBoneTransform != null)
                attachTarget.transform.SetParent(attachBoneTransform, false);
            else if (!allowSpawn && !keepOriginalRotation &&
                     attachTarget.transform.parent != originalAttachParent)
                attachTarget.transform.SetParent(originalAttachParent, false);
        }

        if (attachTarget != null && allowSpawn && !wasAllowSpawn)
        {
            attachTarget.SetActive(true);
            attachTarget.transform.localScale = Vector3.zero;
            scaleLerpT = 0f;
            scalingUp = true;
            isScaling = true;
        }

        if (attachTarget != null && !allowSpawn && attachTarget.activeSelf && (!isScaling || scalingUp))
        {
            scalingUp = false;
            isScaling = true;
            scaleLerpT = 0f;
        }

        if (attachTarget != null && isScaling && attachTarget.activeSelf)
        {
            float duration = scalingUp ? spawnScaleTime : despawnScaleTime;
            scaleLerpT += Time.deltaTime / Mathf.Max(duration, 0.0001f);
            float t = Mathf.Clamp01(scaleLerpT);
            Vector3 from = scalingUp ? Vector3.zero : originalScale;
            Vector3 to = scalingUp ? originalScale : Vector3.zero;
            attachTarget.transform.localScale = Vector3.Lerp(from, to, t);

            if (t >= 1f)
            {
                isScaling = false;
                if (!scalingUp)
                {
                    attachTarget.SetActive(false);
                    attachTarget.transform.localScale = originalScale;
                }
            }
        }

        if (attachTarget != null && attachTarget.activeSelf && keepOriginalRotation && attachBoneTransform != null)
            attachTarget.transform.position = attachBoneTransform.position;

        wasAllowSpawn = allowSpawn;
    }

    void UpdatePinkZone()
    {
        float unityWidth = 768f;
        float unityHeight = 512f;

        if (Kirurobo.UniWindowController.current != null)
        {
            var sz = Kirurobo.UniWindowController.current.windowSize;
            if (sz.x > 0 && sz.y > 0)
            {
                unityWidth = sz.x;
                unityHeight = sz.y;
            }
        }
#if UNITY_STANDALONE_WIN
        else if (unityHWND != IntPtr.Zero)
        {
            GetWindowRect(unityHWND, out RECT rect);
            unityWidth = rect.Right - rect.Left;
            unityHeight = rect.Bottom - rect.Top;
        }
#endif

        Transform hips = null;
        if (animator != null)
        {
            hips = animator.GetBoneTransform(HumanBodyBones.Hips);
        }

        var cam = Camera.main;

#if (UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX)
        // macOS Cocoa coordinates: origin (0,0) is bottom-left of screen
        if (hips != null && cam != null)
        {
            Vector3 screenPt = cam.WorldToScreenPoint(hips.position);
            float normX = screenPt.x / (float)Screen.width;
            float normY = screenPt.y / (float)Screen.height;

            float hipDesktopX = unityPos.x + normX * unityWidth + snapZoneOffset.x;
            float hipDesktopY = unityPos.y + normY * unityHeight + snapZoneOffset.y;

            pinkZoneDesktopRect = new Rect(hipDesktopX - snapZoneSize.x / 2f, hipDesktopY - snapZoneSize.y / 2f, snapZoneSize.x, snapZoneSize.y);
        }
        else
        {
            float centerX = unityPos.x + unityWidth / 2f + snapZoneOffset.x;
            float bottomY = unityPos.y + unityHeight * 0.40f + snapZoneOffset.y;
            pinkZoneDesktopRect = new Rect(centerX - snapZoneSize.x / 2f, bottomY - snapZoneSize.y / 2f, snapZoneSize.x, snapZoneSize.y);
        }
#else
        // Windows original coordinates: origin (0,0) is top-left of screen
        if (hips != null && cam != null)
        {
            Vector3 screenPt = cam.WorldToScreenPoint(hips.position);
            float normX = screenPt.x / (float)Screen.width;
            float normY = 1.0f - (screenPt.y / (float)Screen.height);

            float hipDesktopX = unityPos.x + normX * unityWidth + snapZoneOffset.x;
            float hipDesktopY = unityPos.y + normY * unityHeight + snapZoneOffset.y;

            pinkZoneDesktopRect = new Rect(hipDesktopX - snapZoneSize.x / 2f, hipDesktopY - snapZoneSize.y / 2f, snapZoneSize.x, snapZoneSize.y);
        }
        else
        {
            float centerX = unityPos.x + unityWidth / 2f + snapZoneOffset.x;
            float bottomY = unityPos.y + unityHeight + snapZoneOffset.y;
            pinkZoneDesktopRect = new Rect(centerX - snapZoneSize.x / 2f, bottomY - snapZoneSize.y / 2f, snapZoneSize.x, snapZoneSize.y);
        }
#endif
    }

    void UpdateUnityWindowPosition()
    {
        if (Kirurobo.UniWindowController.current != null)
        {
            unityPos = Kirurobo.UniWindowController.current.windowPosition;
        }
#if UNITY_STANDALONE_WIN
        else if (unityHWND != IntPtr.Zero)
        {
            GetWindowRect(unityHWND, out RECT rect);
            unityPos = new Vector2(rect.Left, rect.Top);
        }
#endif
    }

    void UpdateTaskbarRect()
    {
        taskbarRect = MonitorHelper.GetTaskbarRectForWindow(unityHWND);
    }

    void OnDrawGizmos()
    {
        if (!Application.isPlaying || !showDebugGizmo) return;
        float basePixel = 1000f;
        Rect bar = new Rect(taskbarRect.x, taskbarRect.y, taskbarRect.width, 5);
        Gizmos.color = taskbarGizmoColor;
        DrawDesktopRect(bar, basePixel);
        Gizmos.color = pinkZoneGizmoColor;
        DrawDesktopRect(pinkZoneDesktopRect, basePixel);
    }

    void DrawDesktopRect(Rect desktopRect, float basePixel)
    {
        float cx = desktopRect.x + desktopRect.width / 2f;
        float cy = desktopRect.y + desktopRect.height / 2f;
        int screenWidth = Display.main.systemWidth > 0 ? Display.main.systemWidth : Screen.width;
        int screenHeight = Display.main.systemHeight > 0 ? Display.main.systemHeight : Screen.height;

        float unityX = (cx - screenWidth / 2f) / basePixel;
        float unityY = -(cy - screenHeight / 2f) / basePixel;

        Vector3 worldPos = new Vector3(unityX, unityY, 0);
        Vector3 worldSize = new Vector3(desktopRect.width / basePixel, desktopRect.height / basePixel, 0);

        Gizmos.DrawWireCube(worldPos, worldSize);
    }

    #region WinAPI
#if UNITY_STANDALONE_WIN
    [StructLayout(LayoutKind.Sequential)]
    struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
#endif
    #endregion
}
