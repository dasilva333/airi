using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace StageMate.Effects
{
    /// <summary>
    /// Procedural cartoon bullet hole & screen puncture decal manager.
    /// Generates runtime textures in-memory with zero external asset dependencies,
    /// manages screen-space overlay decals, and ensures non-blocking click-through.
    /// </summary>
    public sealed class BulletHoleManager : MonoBehaviour
    {
        private static BulletHoleManager instance;
        public static BulletHoleManager Instance
        {
            get
            {
                if (instance == null)
                {
                    var go = new GameObject("BulletHoleManager");
                    instance = go.AddComponent<BulletHoleManager>();
                    DontDestroyOnLoad(go);
                }
                return instance;
            }
        }

        private Sprite bulletHoleSprite;
        private Canvas overlayCanvas;

        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }
            instance = this;
            DontDestroyOnLoad(gameObject);

            EnsureCanvas();
            GenerateProceduralSprite();
            Debug.Log("[BulletHoleManager] Initialized procedural cartoon bullet hole subsystem.");
        }

        private void EnsureCanvas()
        {
            if (overlayCanvas != null) return;

            var canvasGO = new GameObject("BulletHoleCanvas");
            canvasGO.transform.SetParent(transform, false);

            overlayCanvas = canvasGO.AddComponent<Canvas>();
            overlayCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            overlayCanvas.sortingOrder = 9999;

            var scaler = canvasGO.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;

            var raycaster = canvasGO.AddComponent<GraphicRaycaster>();
            raycaster.blockingObjects = GraphicRaycaster.BlockingObjects.None;
        }

        /// <summary>
        /// Generates a 128x128 cartoon jagged puncture texture dynamically at runtime.
        /// Features a dark charcoal core, radial jagged spikes, and a soft shadow halo.
        /// </summary>
        private void GenerateProceduralSprite()
        {
            int size = 128;
            float center = size * 0.5f;
            float coreRadius = 22f;

            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };

            Color[] pixels = new Color[size * size];

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = x - center;
                    float dy = y - center;
                    float dist = Mathf.Sqrt(dx * dx + dy * dy);
                    float angle = Mathf.Atan2(dy, dx);

                    // Procedural jagged edge using multi-harmonic sine waves
                    float jaggedRadius = coreRadius * (1f
                        + 0.18f * Mathf.Sin(5f * angle)
                        + 0.14f * Mathf.Cos(9f * angle)
                        + 0.08f * Mathf.Sin(13f * angle));

                    // Sharp radiating comic fracture spikes
                    float spikeFactor = Mathf.Pow(Mathf.Max(0f, Mathf.Cos(3.5f * angle)), 12f) * 16f
                                      + Mathf.Pow(Mathf.Max(0f, Mathf.Sin(4.5f * angle + 1.2f)), 14f) * 18f;
                    float outerCrackRadius = jaggedRadius + spikeFactor;

                    Color pixelColor = Color.clear;

                    if (dist <= jaggedRadius - 2f)
                    {
                        // Solid dark charcoal center
                        pixelColor = new Color(0.06f, 0.06f, 0.08f, 0.96f);
                    }
                    else if (dist <= outerCrackRadius)
                    {
                        // Jagged comic border / cracks
                        float edgeFade = Mathf.Clamp01(1f - (dist - jaggedRadius) / Mathf.Max(1f, outerCrackRadius - jaggedRadius));
                        pixelColor = new Color(0.10f, 0.10f, 0.12f, edgeFade * 0.90f);
                    }
                    else if (dist <= outerCrackRadius + 8f)
                    {
                        // Soft dark drop-shadow halo for depth
                        float shadowFade = Mathf.Clamp01(1f - (dist - outerCrackRadius) / 8f);
                        pixelColor = new Color(0.03f, 0.03f, 0.04f, shadowFade * 0.35f);
                    }

                    pixels[y * size + x] = pixelColor;
                }
            }

            texture.SetPixels(pixels);
            texture.Apply();

            bulletHoleSprite = Sprite.Create(
                texture,
                new Rect(0, 0, size, size),
                new Vector2(0.5f, 0.5f),
                100f
            );
        }

        /// <summary>
        /// Spawns a cartoon bullet hole at the specified screen coordinate.
        /// </summary>
        /// <param name="screenPos">Screen pixel coordinate (e.g. Input.mousePosition)</param>
        public void SpawnAt(Vector2 screenPos)
        {
            EnsureCanvas();
            if (bulletHoleSprite == null)
            {
                GenerateProceduralSprite();
            }

            var decalGO = new GameObject("CartoonBulletHole");
            decalGO.transform.SetParent(overlayCanvas.transform, false);

            var rectTransform = decalGO.AddComponent<RectTransform>();
            rectTransform.position = new Vector3(screenPos.x, screenPos.y, 0f);
            rectTransform.sizeDelta = new Vector2(60f, 60f);

            // Random rotation (0..360°) and scale variation (0.85x..1.25x)
            rectTransform.localRotation = Quaternion.Euler(0f, 0f, Random.Range(0f, 360f));
            float randomScale = Random.Range(0.85f, 1.25f);
            rectTransform.localScale = new Vector3(randomScale, randomScale, 1f);

            // Image setup: raycastTarget = false ensures complete click-through safety
            var image = decalGO.AddComponent<Image>();
            image.sprite = bulletHoleSprite;
            image.color = Color.white;
            image.raycastTarget = false;

            // Self-contained decay lifecycle
            decalGO.AddComponent<BulletHoleDecay>();
        }
    }
}
