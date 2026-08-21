using System;
using UnityEngine;
using UnityEngine.UI;
using StageMate.Core;
using Kirurobo;

namespace StageMate.Window
{
    public class StageMateBorderGlow : MonoBehaviour
    {
        [Header("Appearance")]
        public Color borderColor = new Color(0.659f, 0.333f, 0.969f, 0.7f); // #a855f7 (b-primary)
        public float borderWidth = 4f;
        public float cornerRadius = 16f;
        public float fadeSpeed = 4f; // 250ms fade duration
        public float pulsePeriod = 3f; // 3-second breathing pulse

        private CanvasGroup canvasGroup;
        private StageMateWindowManager windowManager;
        private float currentFade = 0f;
        private bool isHovered = false;

        private Kirurobo.UniWindowController uniWindow;
        private Canvas canvas;

        private void Awake()
        {
            windowManager = GetComponent<StageMateWindowManager>() ?? FindFirstObjectByType<StageMateWindowManager>();
            uniWindow = GetComponent<Kirurobo.UniWindowController>() ?? FindFirstObjectByType<Kirurobo.UniWindowController>();
            BuildBorderUI();
            Debug.Log("[StageMateBorderGlow] Initialized StageMateBorderGlow component");
        }

        private void BuildBorderUI()
        {
            // 1. Create Canvas GameObject
            GameObject canvasGO = new GameObject("StageMate_BorderHighlight");
            canvasGO.transform.SetParent(transform, false);

            canvas = canvasGO.AddComponent<Canvas>();
            Camera cam = (windowManager != null && windowManager.windowController != null && windowManager.windowController.currentCamera != null)
                ? windowManager.windowController.currentCamera
                : ((uniWindow != null && uniWindow.currentCamera != null) ? uniWindow.currentCamera : (Camera.main ?? FindFirstObjectByType<Camera>()));

            if (cam != null)
            {
                canvas.renderMode = RenderMode.ScreenSpaceCamera;
                canvas.worldCamera = cam;
                canvas.planeDistance = 0.5f;
            }
            else
            {
                canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            }
            canvas.sortingOrder = 999;

            CanvasScaler scaler = canvasGO.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            int w = Screen.width > 0 ? Screen.width : 1536;
            int h = Screen.height > 0 ? Screen.height : 1024;
            scaler.referenceResolution = new Vector2(w, h);

            canvasGroup = canvasGO.AddComponent<CanvasGroup>();
            canvasGroup.alpha = 0f;
            canvasGroup.blocksRaycasts = false;
            canvasGroup.interactable = false;

            // 2. Create Border Image
            GameObject imageGO = new GameObject("BorderImage");
            imageGO.transform.SetParent(canvasGO.transform, false);

            RectTransform rt = imageGO.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;

            Image img = imageGO.AddComponent<Image>();
            img.raycastTarget = false;
            img.color = borderColor;
            img.sprite = CreateRoundedRectBorderSprite(64, (int)borderWidth, (int)cornerRadius);
            img.type = Image.Type.Sliced;
        }

        private Sprite CreateRoundedRectBorderSprite(int size, int border, int radius)
        {
            Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            tex.filterMode = FilterMode.Bilinear;
            tex.wrapMode = TextureWrapMode.Clamp;

            Color clear = Color.clear;
            Color solid = Color.white;

            float r = Mathf.Min(radius, size / 2f);
            float innerR = Mathf.Max(0, r - border);

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    // Find distance to closest corner
                    float cx = (x < r) ? r : (x >= size - r ? size - 1 - r : x);
                    float cy = (y < r) ? r : (y >= size - r ? size - 1 - r : y);

                    float dist = 0f;
                    if (x < r || x >= size - r || y < r || y >= size - r)
                    {
                        float dx = x - cx;
                        float dy = y - cy;
                        dist = Mathf.Sqrt(dx * dx + dy * dy);
                    }

                    // Check outer boundary
                    bool isInsideOuter = (dist <= r);
                    if (x >= r && x < size - r && y >= r && y < size - r)
                        isInsideOuter = true;

                    // Check inner boundary (hollow center)
                    bool isInsideInner = false;
                    if (x >= border && x < size - border && y >= border && y < size - border)
                    {
                        float innerCx = (x < r) ? r : (x >= size - r ? size - 1 - r : x);
                        float innerCy = (y < r) ? r : (y >= size - r ? size - 1 - r : y);
                        float innerDist = 0f;
                        if (x < r || x >= size - r || y < r || y >= size - r)
                        {
                            float dx = x - innerCx;
                            float dy = y - innerCy;
                            innerDist = Mathf.Sqrt(dx * dx + dy * dy);
                        }
                        if (innerDist <= innerR || (x >= r && x < size - r && y >= r && y < size - r))
                            isInsideInner = true;
                    }

                    if (isInsideOuter && !isInsideInner)
                    {
                        tex.SetPixel(x, y, solid);
                    }
                    else
                    {
                        tex.SetPixel(x, y, clear);
                    }
                }
            }

            tex.Apply();
            Vector4 borderBorder = new Vector4(radius + 2, radius + 2, radius + 2, radius + 2);
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, borderBorder);
        }

        private void Update()
        {
            if (canvas != null && canvas.renderMode == RenderMode.ScreenSpaceCamera && canvas.worldCamera == null)
            {
                Camera cam = (windowManager != null && windowManager.windowController != null && windowManager.windowController.currentCamera != null)
                    ? windowManager.windowController.currentCamera
                    : ((uniWindow != null && uniWindow.currentCamera != null) ? uniWindow.currentCamera : (Camera.main ?? FindFirstObjectByType<Camera>()));
                if (cam != null)
                {
                    canvas.worldCamera = cam;
                    canvas.planeDistance = 0.5f;
                }
            }

            Vector2 mousePos = GlobalMouse.GetPosition(); // canonical top-left

            if (windowManager != null)
            {
                var bounds = windowManager.GetCurrentBounds();
                isHovered = (mousePos.x >= bounds.x && mousePos.x <= bounds.x + bounds.width &&
                             mousePos.y >= bounds.y && mousePos.y <= bounds.y + bounds.height);
            }
            else if (uniWindow != null)
            {
                Vector2 pos = uniWindow.windowPosition;
                Vector2 size = uniWindow.windowSize;
                int screenH = Screen.height > 0 ? Screen.height : 1024;
                float winX = pos.x;
                float winY = Mathf.Max(0, screenH - (pos.y + size.y));
                isHovered = (mousePos.x >= winX && mousePos.x <= winX + size.x &&
                             mousePos.y >= winY && mousePos.y <= winY + size.y);
            }
            else
            {
                int screenW = Screen.width > 0 ? Screen.width : 1536;
                int screenH = Screen.height > 0 ? Screen.height : 1024;
                isHovered = (mousePos.x >= 0 && mousePos.x <= screenW &&
                             mousePos.y >= 0 && mousePos.y <= screenH);
            }

            float targetAlpha = isHovered ? 1f : 0f;
            currentFade = Mathf.MoveTowards(currentFade, targetAlpha, Time.deltaTime * fadeSpeed);

            if (canvasGroup != null)
            {
                // Continuous 3-second breathing pulse (50% to 100% opacity)
                float pulse = 0.75f + 0.25f * Mathf.Sin((Time.time * Mathf.PI * 2f) / pulsePeriod);
                canvasGroup.alpha = currentFade * pulse;
            }
        }

        private void OnGUI()
        {
            if (currentFade <= 0.01f) return;

            Color oldColor = GUI.color;
            float pulse = 0.75f + 0.25f * Mathf.Sin((Time.time * Mathf.PI * 2f) / pulsePeriod);
            GUI.color = new Color(borderColor.r, borderColor.g, borderColor.b, borderColor.a * currentFade * pulse);

            int w = Screen.width;
            int h = Screen.height;
            int b = Mathf.Max(2, (int)borderWidth);

            // Draw 4 border rectangles (Top, Bottom, Left, Right)
            GUI.DrawTexture(new Rect(0, 0, w, b), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(0, h - b, w, b), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(0, 0, b, h), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(w - b, 0, b, h), Texture2D.whiteTexture);

            GUI.color = oldColor;
        }
    }
}
