using System;
using Kirurobo;
using UnityEngine;
using StageMate.Core;

namespace StageMate.Window
{
    public class StageMateWindowManager : MonoBehaviour
    {
        public UniWindowController windowController;
        public bool isTopmost = true;
        public bool isTransparent = true;
        public Vector2 defaultWindowSize = new Vector2(450f, 600f);
        public bool showDebugHUD = false;

        public event Action<WindowBoundsDto> OnWindowMoved;

        private bool isDraggingWindow;
        private Vector2 windowGrabOffset;
        private bool prevHitTestState;
        private bool hasInitializedPosition;

        private void Start()
        {
            if (windowController == null)
                windowController = GetComponent<UniWindowController>() ?? FindFirstObjectByType<UniWindowController>();

            if (windowController != null)
            {
                if (windowController.currentCamera == null)
                    windowController.currentCamera = Camera.main ?? FindFirstObjectByType<Camera>();

                windowController.isTopmost = isTopmost;
                windowController.transparentType = UniWindowController.TransparentType.ColorKey;
                windowController.keyColor = new Color32(1, 0, 1, 0);
                windowController.isHitTestEnabled = true;
                windowController.hitTestType = UniWindowController.HitTestType.Opacity;
                windowController.opacityThreshold = 0.05f;
                windowController.autoSwitchCameraBackground = true;
                windowController.alphaValue = 1.0f;
                windowController.isTransparent = isTransparent;
            }
        }

        private void Update()
        {
            // Toggle debug HUD with F12
            if (Input.GetKeyDown(KeyCode.F12))
            {
                showDebugHUD = !showDebugHUD;
            }

            // Toggle between ColorKey and Alpha transparency with F11
            if (Input.GetKeyDown(KeyCode.F11) && windowController != null)
            {
                var nextType = (windowController.transparentType == UniWindowController.TransparentType.ColorKey)
                    ? UniWindowController.TransparentType.Alpha
                    : UniWindowController.TransparentType.ColorKey;
                windowController.SetTransparentType(nextType);
                Debug.Log($"[StageMateWindowManager] Switched transparency type to: {nextType}");
            }

            // Self-initialize default position once window controller attaches
            if (!hasInitializedPosition && windowController != null)
            {
                var cur = windowController.windowSize;
                if (cur.x > 0f && cur.y > 0f)
                {
                    InitializeDefaultPosition();
                    hasInitializedPosition = true;
                }
            }
        }

        public void InitializeDefaultPosition()
        {
            if (windowController == null) return;

            int screenW = Display.main.systemWidth > 0 ? Display.main.systemWidth : Screen.currentResolution.width;
            int screenH = Display.main.systemHeight > 0 ? Display.main.systemHeight : Screen.currentResolution.height;

            windowController.windowSize = defaultWindowSize;

            // Anchor to bottom-right docked above taskbar
            float defaultX = Mathf.Max(0, screenW - defaultWindowSize.x - 40f);
            float defaultY = 60f; // Kirurobo bottom-left Y

            windowController.windowPosition = new Vector2(defaultX, defaultY);
            windowController.alphaValue = 1.0f;
            windowController.isTopmost = isTopmost;

            Debug.Log($"[StageMateWindowManager] Initialized default window bounds: {defaultWindowSize.x}x{defaultWindowSize.y} at ({defaultX}, {defaultY}) on {screenW}x{screenH} display");
        }

        public void SetBounds(int x, int y, int width, int height)
        {
            if (windowController == null) return;

            // Invert Y coordinate from top-left (web/electron) to bottom-left (Kirurobo)
            int screenH = Display.main.systemHeight > 0 ? Display.main.systemHeight : Screen.currentResolution.height;
            int screenW = Display.main.systemWidth > 0 ? Display.main.systemWidth : Screen.currentResolution.width;

            int unityY = Mathf.Max(0, screenH - (y + height));

            // Clamping guardrails to prevent off-screen spawning
            float safeX = Mathf.Clamp(x, 0, Mathf.Max(0, screenW - 100));
            float safeY = Mathf.Clamp(unityY, 0, Mathf.Max(0, screenH - 100));

            windowController.windowPosition = new Vector2(safeX, safeY);
            if (width > 0 && height > 0)
                windowController.windowSize = new Vector2(width, height);

            hasInitializedPosition = true;
            Debug.Log($"[StageMateWindowManager] Synced bounds: ({safeX}, {safeY}, {width}x{height})");
        }

        public WindowBoundsDto GetCurrentBounds()
        {
            if (windowController == null)
                return new WindowBoundsDto { x = 0, y = 0, width = Screen.width, height = Screen.height };

            Vector2 pos = windowController.windowPosition;
            Vector2 size = windowController.windowSize;

            int screenH = Display.main.systemHeight > 0 ? Display.main.systemHeight : Screen.currentResolution.height;
            int electronY = Mathf.Max(0, screenH - Mathf.RoundToInt(pos.y + size.y));

            return new WindowBoundsDto
            {
                x = Mathf.RoundToInt(pos.x),
                y = electronY,
                width = Mathf.RoundToInt(size.x),
                height = Mathf.RoundToInt(size.y)
            };
        }

        public void BeginWaistDrag()
        {
            if (windowController == null) return;
            isDraggingWindow = true;
            prevHitTestState = windowController.isHitTestEnabled;
            windowController.isHitTestEnabled = false;
            windowGrabOffset = windowController.windowPosition - windowController.cursorPosition;
        }

        public void UpdateWaistDrag()
        {
            if (!isDraggingWindow || windowController == null) return;
            windowController.windowPosition = windowController.cursorPosition + windowGrabOffset;
        }

        public void EndWaistDrag()
        {
            if (!isDraggingWindow || windowController == null) return;
            isDraggingWindow = false;
            windowController.isHitTestEnabled = prevHitTestState;
            OnWindowMoved?.Invoke(GetCurrentBounds());
        }

        private void OnGUI()
        {
            if (!showDebugHUD) return;

            // Top-left debug telemetry overlay
            Vector2 pos = windowController != null ? windowController.windowPosition : Vector2.zero;
            Vector2 sz = windowController != null ? windowController.windowSize : Vector2.zero;
            float alpha = windowController != null ? windowController.alphaValue : 1f;

            string debugText = $"[StageMate] Pos: ({pos.x:0}, {pos.y:0}) | Size: {sz.x:0}x{sz.y:0} | Alpha: {alpha:0.0} | FPS: {(1f / Time.unscaledDeltaTime):0} (F12: toggle HUD)";

            GUI.color = new Color(0, 0, 0, 0.7f);
            GUI.Box(new Rect(10, 10, 480, 24), GUIContent.none);
            GUI.color = Color.green;
            GUI.Label(new Rect(15, 12, 470, 20), debugText);
        }
    }
}
