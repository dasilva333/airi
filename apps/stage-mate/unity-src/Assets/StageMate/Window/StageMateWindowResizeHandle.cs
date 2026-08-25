using System;
using UnityEngine;
using Kirurobo;
using StageMate.Core;

namespace StageMate.Window
{
    [Flags]
    public enum ResizeEdge
    {
        None = 0,
        Left = 1 << 0,
        Right = 1 << 1,
        Top = 1 << 2,
        Bottom = 1 << 3,
        TopLeft = Top | Left,
        TopRight = Top | Right,
        BottomLeft = Bottom | Left,
        BottomRight = Bottom | Right,
    }

    public class StageMateWindowResizeHandle : MonoBehaviour
    {
        [Header("Resize Configuration")]
        public float borderThickness = 14f;
        public Vector2 minWindowSize = new Vector2(220f, 300f);
        public Vector2 maxWindowSize = new Vector2(3840f, 2160f);

        [Header("State (Read-Only)")]
        public ResizeEdge hoveredEdge = ResizeEdge.None;
        public bool isResizing = false;

        public ResizeEdge CurrentHoveredEdge => hoveredEdge;
        public bool IsResizing => isResizing;

        private StageMateWindowManager windowManager;
        private UniWindowController windowController;

        private ResizeEdge activeDragEdge = ResizeEdge.None;
        private Vector2 startCursorPos;
        private Vector2 startWindowPos;
        private Vector2 startWindowSize;
        private bool prevHitTestState = true;
        private bool isOverridingHitTest = false;

        private bool prevMouseDown = false;
        private Texture2D cursorHoriz;
        private Texture2D cursorVert;
        private Texture2D cursorNwse;
        private Texture2D cursorNesw;

        private const string SizePrefKey = "MATE_Window_Size";
        private const char SizePrefDelimiter = 'x';

        private void Awake()
        {
            windowManager = GetComponent<StageMateWindowManager>() ?? FindFirstObjectByType<StageMateWindowManager>();
            windowController = GetComponent<UniWindowController>() ?? FindFirstObjectByType<UniWindowController>();
            InitCursorTextures();
        }

        private void InitCursorTextures()
        {
            cursorHoriz = CreateArrowCursor(true, false);
            cursorVert = CreateArrowCursor(false, true);
            cursorNwse = CreateDiagonalCursor(true);
            cursorNesw = CreateDiagonalCursor(false);
        }

        private void Update()
        {
            if (windowController == null)
            {
                windowController = GetComponent<UniWindowController>() ?? FindFirstObjectByType<UniWindowController>();
                if (windowController == null) return;
            }

            if (windowManager == null)
            {
                windowManager = GetComponent<StageMateWindowManager>() ?? FindFirstObjectByType<StageMateWindowManager>();
            }

            UpdateHoveredEdge();
            HandleResizeInput();
        }

        private void UpdateHoveredEdge()
        {
            if (isResizing)
                return;

            Vector2 mousePos;
            if (windowController != null)
            {
                Vector2 globalCursor = windowController.cursorPosition;
                Vector2 winPos = windowController.windowPosition;
                mousePos = new Vector2(globalCursor.x - winPos.x, globalCursor.y - winPos.y);
            }
            else
            {
                mousePos = Input.mousePosition;
            }

            int screenW = Screen.width;
            int screenH = Screen.height;

            if (mousePos.x < 0 || mousePos.x > screenW || mousePos.y < 0 || mousePos.y > screenH)
            {
                SetHoveredEdge(ResizeEdge.None);
                return;
            }

            bool isLeft = mousePos.x <= borderThickness;
            bool isRight = mousePos.x >= screenW - borderThickness;
            bool isBottom = mousePos.y <= borderThickness;
            bool isTop = mousePos.y >= screenH - borderThickness;

            ResizeEdge edge = ResizeEdge.None;

            if (isLeft) edge |= ResizeEdge.Left;
            if (isRight) edge |= ResizeEdge.Right;
            if (isBottom) edge |= ResizeEdge.Bottom;
            if (isTop) edge |= ResizeEdge.Top;

            SetHoveredEdge(edge);
        }

        private void SetHoveredEdge(ResizeEdge edge)
        {
            hoveredEdge = edge;
            UpdateCursor(edge);

            // When hovering over a border zone, override click-through so mouse events are captured
            if (hoveredEdge != ResizeEdge.None || isResizing)
            {
                if (!isOverridingHitTest && windowController != null)
                {
                    prevHitTestState = windowController.isHitTestEnabled;
                    windowController.isHitTestEnabled = false;
                    windowController.isClickThrough = false;
                    isOverridingHitTest = true;
                }
            }
            else
            {
                if (isOverridingHitTest && windowController != null)
                {
                    windowController.isHitTestEnabled = prevHitTestState;
                    isOverridingHitTest = false;
                }
            }
        }

        private void UpdateCursor(ResizeEdge edge)
        {
            if (edge == ResizeEdge.TopLeft || edge == ResizeEdge.BottomRight)
            {
                Cursor.SetCursor(cursorNwse, new Vector2(16, 16), CursorMode.Auto);
            }
            else if (edge == ResizeEdge.TopRight || edge == ResizeEdge.BottomLeft)
            {
                Cursor.SetCursor(cursorNesw, new Vector2(16, 16), CursorMode.Auto);
            }
            else if ((edge & (ResizeEdge.Left | ResizeEdge.Right)) != 0)
            {
                Cursor.SetCursor(cursorHoriz, new Vector2(16, 16), CursorMode.Auto);
            }
            else if ((edge & (ResizeEdge.Top | ResizeEdge.Bottom)) != 0)
            {
                Cursor.SetCursor(cursorVert, new Vector2(16, 16), CursorMode.Auto);
            }
            else
            {
                Cursor.SetCursor(null, Vector2.zero, CursorMode.Auto);
            }
        }

        private void HandleResizeInput()
        {
            if (windowController == null) return;

            bool isMouseDown = Input.GetMouseButton(0) || GlobalMouse.LeftMouseDown();
            bool isMouseDownInitial = Input.GetMouseButtonDown(0) || (isMouseDown && !prevMouseDown);

            // Begin resize drag on left mouse button down over a border
            if (!isResizing && hoveredEdge != ResizeEdge.None && isMouseDownInitial)
            {
                isResizing = true;
                activeDragEdge = hoveredEdge;
                startCursorPos = windowController.cursorPosition;
                startWindowPos = windowController.windowPosition;
                startWindowSize = windowController.windowSize;
            }

            // Process active resize drag
            if (isResizing)
            {
                if (isMouseDown)
                {
                    Vector2 currentCursor = windowController.cursorPosition;
                    Vector2 cursorDelta = currentCursor - startCursorPos;

                    float newW = startWindowSize.x;
                    float newH = startWindowSize.y;
                    float newX = startWindowPos.x;
                    float newY = startWindowPos.y;

                    // Horizontal Resize
                    if ((activeDragEdge & ResizeEdge.Right) != 0)
                    {
                        newW = Mathf.Clamp(startWindowSize.x + cursorDelta.x, minWindowSize.x, maxWindowSize.x);
                    }
                    else if ((activeDragEdge & ResizeEdge.Left) != 0)
                    {
                        newW = Mathf.Clamp(startWindowSize.x - cursorDelta.x, minWindowSize.x, maxWindowSize.x);
                        newX = startWindowPos.x + (startWindowSize.x - newW);
                    }

                    // Vertical Resize (Kirurobo: 0 is bottom, Y increases going UP)
                    if ((activeDragEdge & ResizeEdge.Top) != 0)
                    {
                        newH = Mathf.Clamp(startWindowSize.y + cursorDelta.y, minWindowSize.y, maxWindowSize.y);
                    }
                    else if ((activeDragEdge & ResizeEdge.Bottom) != 0)
                    {
                        newH = Mathf.Clamp(startWindowSize.y - cursorDelta.y, minWindowSize.y, maxWindowSize.y);
                        newY = startWindowPos.y + (startWindowSize.y - newH);
                    }

                    windowController.windowSize = new Vector2(newW, newH);
                    windowController.windowPosition = new Vector2(newX, newY);
                }
                else
                {
                    // End resize drag
                    isResizing = false;
                    activeDragEdge = ResizeEdge.None;

                    if (windowController != null)
                    {
                        Vector2 finalSize = windowController.windowSize;
                        PlayerPrefs.SetString(SizePrefKey, $"{Mathf.RoundToInt(finalSize.x)}{SizePrefDelimiter}{Mathf.RoundToInt(finalSize.y)}");
                        PlayerPrefs.Save();
                    }

                    if (windowManager != null)
                    {
                        windowManager.NotifyWindowMoved();
                    }

                    // Re-evaluate hover state on release
                    UpdateHoveredEdge();
                }
            }

            prevMouseDown = isMouseDown;
        }

        private static Texture2D CreateArrowCursor(bool horizontal, bool vertical)
        {
            var tex = new Texture2D(32, 32, TextureFormat.RGBA32, false);
            Color clear = Color.clear;
            Color white = Color.white;
            Color black = new Color(0.1f, 0.1f, 0.1f, 0.9f);

            for (int y = 0; y < 32; y++)
                for (int x = 0; x < 32; x++)
                    tex.SetPixel(x, y, clear);

            if (horizontal)
            {
                // Horizontal double-headed arrow
                for (int x = 6; x <= 25; x++)
                {
                    tex.SetPixel(x, 15, black);
                    tex.SetPixel(x, 16, white);
                    tex.SetPixel(x, 17, black);
                }
                // Arrow heads
                for (int i = 0; i <= 4; i++)
                {
                    tex.SetPixel(6 + i, 16 + i, white);
                    tex.SetPixel(6 + i, 16 - i, white);
                    tex.SetPixel(25 - i, 16 + i, white);
                    tex.SetPixel(25 - i, 16 - i, white);
                }
            }
            else if (vertical)
            {
                // Vertical double-headed arrow
                for (int y = 6; y <= 25; y++)
                {
                    tex.SetPixel(15, y, black);
                    tex.SetPixel(16, y, white);
                    tex.SetPixel(17, y, black);
                }
                // Arrow heads
                for (int i = 0; i <= 4; i++)
                {
                    tex.SetPixel(16 + i, 6 + i, white);
                    tex.SetPixel(16 - i, 6 + i, white);
                    tex.SetPixel(16 + i, 25 - i, white);
                    tex.SetPixel(16 - i, 25 - i, white);
                }
            }

            tex.Apply();
            return tex;
        }

        private static Texture2D CreateDiagonalCursor(bool nwse)
        {
            var tex = new Texture2D(32, 32, TextureFormat.RGBA32, false);
            Color clear = Color.clear;
            Color white = Color.white;

            for (int y = 0; y < 32; y++)
                for (int x = 0; x < 32; x++)
                    tex.SetPixel(x, y, clear);

            for (int i = 8; i <= 23; i++)
            {
                int y = nwse ? (31 - i) : i;
                tex.SetPixel(i, y, white);
                tex.SetPixel(i + 1, y, white);
            }

            tex.Apply();
            return tex;
        }

        private void OnDisable()
        {
            if (isOverridingHitTest && windowController != null)
            {
                windowController.isHitTestEnabled = prevHitTestState;
                isOverridingHitTest = false;
            }
            isResizing = false;
            hoveredEdge = ResizeEdge.None;
        }
    }
}
