using System;
using System.Collections;
using System.IO;
using Kirurobo;
using UnityEngine;
using UnityEngine.EventSystems;
using VRM;
using UniVRM10;

namespace StageMate.Core
{
    public class StageMateBridge : MonoBehaviour
    {
        public StageMateSocket socket;
        public UniWindowController windowController;
        public VRMLoader vrmLoader;
        public string fallbackModelPath;

        private string activeModelPath;
        private string activeModelId;

        private void Awake()
        {
            if (socket == null) socket = GetComponent<StageMateSocket>() ?? gameObject.AddComponent<StageMateSocket>();
            if (windowController == null) windowController = FindFirstObjectByType<UniWindowController>();
            if (vrmLoader == null) vrmLoader = FindFirstObjectByType<VRMLoader>();
            gameObject.AddComponent<MateTelemetryProbe>();
        }

        private void Start()
        {
            if (socket != null)
            {
                socket.OnMessageReceived += HandleMessage;
            }

            if (windowController != null)
            {
                windowController.isTopmost = true;
                windowController.transparentType = UniWindowController.TransparentType.Alpha;
#if UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
                windowController.isHitTestEnabled = false;
                windowController.windowSize = new Vector2(768, 512);
#else
                windowController.isHitTestEnabled = true;
                windowController.hitTestType = UniWindowController.HitTestType.Opacity;
                windowController.opacityThreshold = 0.05f;
#endif
                windowController.autoSwitchCameraBackground = true;
                windowController.isTransparent = true;
                windowController.alphaValue = 1.0f;
            }

            // Mark tutorial done so TutorialMenu.IsActive is false and companion interactions are unlocked
            if (SaveLoadHandler.Instance != null)
            {
                SaveLoadHandler.Instance.data.tutorialDone = true;
            }

            // Suppress standalone non-sidecar UI menus in sidecar mode
            SuppressStandaloneUI();

            // Attach Telemetry Probe for runtime event tracking
            if (GetComponent<MateTelemetryProbe>() == null)
            {
                gameObject.AddComponent<MateTelemetryProbe>();
            }
        }

        private void Update()
        {
            // Toggle between Alpha and ColorKey with F11 for live comparison if needed
            if (Input.GetKeyDown(KeyCode.F11) && windowController != null)
            {
                var nextType = (windowController.transparentType == UniWindowController.TransparentType.ColorKey)
                    ? UniWindowController.TransparentType.Alpha
                    : UniWindowController.TransparentType.ColorKey;
                windowController.SetTransparentType(nextType);
                Debug.Log($"[StageMateBridge] Switched transparency type to: {nextType}");
            }
        }

        private void OnDestroy()
        {
            if (socket != null)
                socket.OnMessageReceived -= HandleMessage;
        }

        public void HandleMessage(string json)
        {
            if (string.IsNullOrEmpty(json)) return;

            var env = JsonUtility.FromJson<WireEnvelope>(json);
            if (env == null || string.IsNullOrEmpty(env.type)) return;

            switch (env.type)
            {
                case "stage:state:sync":
                    HandleStateSync(json);
                    break;

                case "control:stage":
                case "stage:visibility":
                    bool stageEn = env.data != null ? env.data.enabled : true;
                    if (windowController != null) windowController.alphaValue = stageEn ? 1.0f : 0.0f;
                    Debug.Log($"[StageMateBridge] Set Stage Visibility: {stageEn}");
                    break;

                case "stage:size-preset":
                case "control:size-preset":
                    if (env.data != null && !string.IsNullOrEmpty(env.data.preset))
                        ApplySizePreset(env.data.preset);
                    break;

                case "stage:window:bounds":
                case "control:window:bounds":
                    if (env.data != null && windowController != null)
                    {
                        if (env.data.x != 0 || env.data.y != 0)
                            windowController.windowPosition = new Vector2(env.data.x, env.data.y);
                        if (env.data.scale > 0) // if width/height used
                            windowController.windowSize = new Vector2(env.data.scale, env.data.scale);
                    }
                    break;

                case "control:viewport:mode":
                    string mode = env.data != null && !string.IsNullOrEmpty(env.data.mode) ? env.data.mode : env.mode;
                    SetViewportMode(mode);
                    break;

                case "control:viewport-drag":
                    SetViewportMode("drag");
                    break;

                case "control:viewport-orbit":
                    SetViewportMode("orbit");
                    break;

                case "control:viewport-tactile":
                case "control:viewport-spin":
                    SetViewportMode("tactile");
                    break;

                case "stage:vrm:lip-sync":
                    if (env.data != null)
                        ApplyLipSync(env.data.rms);
                    break;

                case "stage:vrm:expression":
                    if (env.data != null)
                    {
                        string expr = !string.IsNullOrEmpty(env.data.name) ? env.data.name : env.data.expression;
                        float w = env.data.weight > 0f ? env.data.weight : 1f;
                        float dur = env.data.durationMs > 0f ? env.data.durationMs / 1000f : 2.5f;
                        ApplyExpression(expr ?? "Angry", w, dur);
                    }
                    break;

                case "control:always-on-top":
                case "stage:always-on-top":
                    bool aot = env.data != null ? env.data.enabled : true;
                    if (windowController != null) windowController.isTopmost = aot;
                    if (SaveLoadHandler.Instance != null && SaveLoadHandler.Instance.data != null)
                        SaveLoadHandler.Instance.data.isTopmost = aot;
                    Debug.Log($"[StageMateBridge] Set AlwaysOnTop: {aot}");
                    break;

                case "control:model:load":
                case "stage:vrm:load":
                    string p = env.data != null && !string.IsNullOrEmpty(env.data.modelPath) ? env.data.modelPath : env.path;
                    if (!string.IsNullOrEmpty(p))
                    {
                        activeModelPath = p;
                        if (env.data != null && !string.IsNullOrEmpty(env.data.modelId))
                            activeModelId = env.data.modelId;
                        LoadModel(p);
                    }
                    break;

                case "stage:vrm:reload-outfits":
                case "stage:vrm:sync-outfits":
                    string syncPath = env.data != null && !string.IsNullOrEmpty(env.data.modelPath) ? env.data.modelPath : activeModelPath;
                    if (vrmLoader == null) vrmLoader = FindFirstObjectByType<VRMLoader>();
                    if (vrmLoader != null && !string.IsNullOrEmpty(syncPath))
                    {
                        Debug.Log($"[StageMateBridge] Direct reload of dynamic outfits requested: {syncPath}");
                        vrmLoader.ReloadDynamicOutfits(syncPath);
                    }
                    break;

                case "stage:prop:macaron":
                case "set_macaron_materials":
                case "control:prop:macaron":
                    string shell = env.data != null ? (env.data.materials != null ? env.data.materials.shell : env.data.shell) : null;
                    string whip = env.data != null ? (env.data.materials != null ? env.data.materials.whip : env.data.whip) : null;
                    string heart = env.data != null ? (env.data.materials != null ? env.data.materials.heart : env.data.heart) : null;
                    ApplyMacaronMaterials(shell, whip, heart);
                    break;
            }
        }

        private void HandleStateSync(string json)
        {
            var syncMsg = JsonUtility.FromJson<StateSyncMessage>(json);
            if (syncMsg == null) return;

            // AIRI Main unified payload format (syncMsg.data)
            if (syncMsg.data != null)
            {
                var d = syncMsg.data;

                if (d.window != null && windowController != null)
                {
                    windowController.windowPosition = new Vector2(d.window.x, d.window.y);
                    if (d.window.width > 0 && d.window.height > 0)
                        windowController.windowSize = new Vector2(d.window.width, d.window.height);
                    windowController.isTopmost = d.window.alwaysOnTop;
                    if (SaveLoadHandler.Instance != null && SaveLoadHandler.Instance.data != null)
                        SaveLoadHandler.Instance.data.isTopmost = d.window.alwaysOnTop;
                }

                if (d.viewport != null && !string.IsNullOrEmpty(d.viewport.mode))
                {
                    SetViewportMode(d.viewport.mode);
                }

                if (d.stage != null && windowController != null)
                {
                    windowController.alphaValue = d.stage.enabled ? 1.0f : 0.0f;
                }

                if (d.model != null && !string.IsNullOrEmpty(d.model.modelPath))
                {
                    activeModelPath = d.model.modelPath;
                    activeModelId = d.model.modelId;
                    LoadModel(activeModelPath);
                }
                return;
            }

            // Harness payload format (syncMsg.payload)
            if (syncMsg.payload != null)
            {
                var p = syncMsg.payload;
                activeModelId = p.activeModelId;

                if (p.windowBounds != null && windowController != null)
                {
                    windowController.windowPosition = new Vector2(p.windowBounds.x, p.windowBounds.y);
                    if (p.windowBounds.width > 0 && p.windowBounds.height > 0)
                        windowController.windowSize = new Vector2(p.windowBounds.width, p.windowBounds.height);
                }

                if (!string.IsNullOrEmpty(p.stageMode))
                {
                    SetViewportMode(p.stageMode);
                }

                if (!string.IsNullOrEmpty(p.currentModelPath))
                {
                    activeModelPath = p.currentModelPath;
                    LoadModel(activeModelPath);
                }
            }
        }

        private void SetViewportMode(string mode)
        {
            if (string.IsNullOrEmpty(mode)) return;
            Debug.Log($"[StageMateBridge] Setting viewport mode: {mode}");

            // Handle standard mode strings
            if (mode == "tactileMode" || mode == "tactile" || mode == "touch")
            {
                if (tactileHandler != null) tactileHandler.enabled = true;
                if (locomotion != null) locomotion.enabled = false;
            }
            else if (mode == "dragMode" || mode == "drag" || mode == "interactive")
            {
                if (tactileHandler != null) tactileHandler.enabled = false;
                if (locomotion != null) locomotion.enabled = false;
            }
            else if (mode == "companionMode" || mode == "companion" || mode == "locomotion")
            {
                if (tactileHandler != null) tactileHandler.enabled = true;
                if (locomotion != null) locomotion.enabled = true;
            }
            else
            {
                if (tactileHandler != null) tactileHandler.enabled = false;
                if (locomotion != null) locomotion.enabled = false;
            }
        }

        private void LoadModel(string path)
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path))
            {
                Debug.LogWarning($"[StageMateBridge] Model file not found: {path}");
                return;
            }

            if (vrmLoader == null) vrmLoader = FindFirstObjectByType<VRMLoader>();
            if (vrmLoader != null)
            {
                // If model is already active in scene, hot-reload dynamic outfits in-place
                if (vrmLoader.GetCurrentModel() != null && path.Equals(activeModelPath, StringComparison.OrdinalIgnoreCase))
                {
                    Debug.Log($"[StageMateBridge] Hot-reloading dynamic outfits for active model: {path}");
                    vrmLoader.ReloadDynamicOutfits(path);
                    socket?.SendJson($"{{\"type\":\"stage:vrm:ready\",\"data\":{{\"modelPath\":\"{path.Replace("\\", "\\\\")}\",\"modelId\":\"{activeModelId}\"}}}}");
                    return;
                }

                Debug.Log($"[StageMateBridge] Invoking native VRMLoader for: {path}");
                vrmLoader.LoadVRM(path);
                socket?.SendJson($"{{\"type\":\"stage:vrm:ready\",\"data\":{{\"modelPath\":\"{path.Replace("\\", "\\\\")}\",\"modelId\":\"{activeModelId}\"}}}}");
            }
            else
            {
                Debug.LogError("[StageMateBridge] VRMLoader not found in scene!");
            }
        }

        private void ApplySizePreset(string preset)
        {
            if (string.IsNullOrEmpty(preset) || windowController == null) return;
            string p = preset.Trim().ToLowerInvariant();
            if (p == "mini")
            {
                windowController.windowSize = new Vector2(220, 315);
            }
            else if (p == "med." || p == "medium" || p == "med")
            {
                windowController.windowSize = new Vector2(450, 600);
            }
            else if (p == "large")
            {
                windowController.windowSize = new Vector2(800, 1000);
            }
            else if (p == "full")
            {
                windowController.windowPosition = Vector2.zero;
                windowController.windowSize = new Vector2(Screen.currentResolution.width, Screen.currentResolution.height);
            }
            Debug.Log($"[StageMateBridge] Applied size preset: {p} -> {windowController.windowSize}");
        }

        private void ApplyLipSync(float rms)
        {
            var animators = FindObjectsByType<Animator>(FindObjectsSortMode.None);
            foreach (var a in animators)
            {
                var vrm10 = a.GetComponent<Vrm10Instance>();
                if (vrm10 != null && vrm10.Runtime != null && vrm10.Runtime.Expression != null)
                {
                    vrm10.Runtime.Expression.SetWeight(ExpressionKey.Aa, Mathf.Clamp01(rms));
                    return;
                }
                var vrm0 = a.GetComponent<VRMBlendShapeProxy>();
                if (vrm0 != null)
                {
                    vrm0.SetValue(BlendShapeKey.CreateFromPreset(BlendShapePreset.A), Mathf.Clamp01(rms));
                    return;
                }
            }
        }

        private Coroutine activeExpressionCoroutine;

        private void ApplyExpression(string exprName, float weight, float duration)
        {
            if (activeExpressionCoroutine != null)
                StopCoroutine(activeExpressionCoroutine);
            activeExpressionCoroutine = StartCoroutine(ExpressionRoutine(exprName, weight, duration));
        }

        private IEnumerator ExpressionRoutine(string exprName, float peakWeight, float duration)
        {
            float holdTime = Mathf.Max(0.3f, duration - 0.6f);
            float fadeOutTime = 0.6f;

            SetVrmExpressionWeight(exprName, peakWeight);

            yield return new WaitForSeconds(holdTime);

            float elapsed = 0f;
            while (elapsed < fadeOutTime)
            {
                elapsed += Time.deltaTime;
                float w = Mathf.Lerp(peakWeight, 0f, elapsed / fadeOutTime);
                SetVrmExpressionWeight(exprName, w);
                yield return null;
            }

            SetVrmExpressionWeight(exprName, 0f);
            activeExpressionCoroutine = null;
        }

        private void SetVrmExpressionWeight(string exprName, float weight)
        {
            if (string.IsNullOrEmpty(exprName)) return;
            string nameLower = exprName.Trim().ToLowerInvariant();

            var animators = FindObjectsByType<Animator>(FindObjectsSortMode.None);
            foreach (var a in animators)
            {
                var vrm10 = a.GetComponent<Vrm10Instance>();
                if (vrm10 != null && vrm10.Runtime != null && vrm10.Runtime.Expression != null)
                {
                    ExpressionKey key = nameLower switch
                    {
                        "angry" => ExpressionKey.Angry,
                        "happy" or "joy" => ExpressionKey.Happy,
                        "sad" or "sorrow" => ExpressionKey.Sad,
                        "relaxed" or "neutral" => ExpressionKey.Relaxed,
                        "surprised" => ExpressionKey.Surprised,
                        "blink" => ExpressionKey.Blink,
                        "aa" => ExpressionKey.Aa,
                        _ => ExpressionKey.CreateCustom(exprName)
                    };
                    vrm10.Runtime.Expression.SetWeight(key, Mathf.Clamp01(weight));
                    return;
                }

                var vrm0 = a.GetComponent<VRMBlendShapeProxy>();
                if (vrm0 != null)
                {
                    BlendShapeKey key = nameLower switch
                    {
                        "angry" => BlendShapeKey.CreateFromPreset(BlendShapePreset.Angry),
                        "happy" or "joy" => BlendShapeKey.CreateFromPreset(BlendShapePreset.Joy),
                        "sad" or "sorrow" => BlendShapeKey.CreateFromPreset(BlendShapePreset.Sorrow),
                        "neutral" => BlendShapeKey.CreateFromPreset(BlendShapePreset.Neutral),
                        "blink" => BlendShapeKey.CreateFromPreset(BlendShapePreset.Blink),
                        "a" or "aa" => BlendShapeKey.CreateFromPreset(BlendShapePreset.A),
                        _ => BlendShapeKey.CreateUnknown(exprName)
                    };
                    vrm0.SetValue(key, Mathf.Clamp01(weight));
                    return;
                }
            }
        }

        private GameObject cachedMacaronGo;

        private GameObject GetMacaronGameObject()
        {
            if (cachedMacaronGo != null) return cachedMacaronGo;
            var allGos = Resources.FindObjectsOfTypeAll<GameObject>();
            foreach (var go in allGos)
            {
                if (go != null && go.name.Equals("Macaroon", StringComparison.OrdinalIgnoreCase) && go.GetComponent<MeshRenderer>() != null)
                {
                    cachedMacaronGo = go;
                    return go;
                }
            }
            return null;
        }

        public void ApplyMacaronMaterials(string shell, string whip, string heart)
        {
            var macaronGo = GetMacaronGameObject();
            if (macaronGo == null)
            {
                Debug.LogWarning("[StageMateBridge] Macaroon GameObject not found in scene.");
                return;
            }

            var mr = macaronGo.GetComponent<MeshRenderer>();
            if (mr == null) return;

            var mats = mr.materials;
            if (mats.Length < 3) mats = new Material[3];

            if (!string.IsNullOrEmpty(shell))
            {
                var mat = Resources.Load<Material>($"Materials/Base/{shell}") ?? FindMaterialFallback(shell);
                if (mat != null) mats[0] = mat;
            }

            if (!string.IsNullOrEmpty(whip))
            {
                var mat = Resources.Load<Material>($"Materials/Whip/{whip}") ?? FindMaterialFallback(whip);
                if (mat != null) mats[1] = mat;
            }

            if (!string.IsNullOrEmpty(heart))
            {
                var mat = Resources.Load<Material>($"Materials/Heart/{heart}") ?? FindMaterialFallback(heart);
                if (mat != null) mats[2] = mat;
            }

            mr.materials = mats;
            mr.sharedMaterials = mats;
            Debug.Log($"[StageMateBridge] Applied Macaron Materials -> Shell:{shell}, Whip:{whip}, Heart:{heart}");
        }

        private Material FindMaterialFallback(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            name = name.Trim();

            var allMaterials = Resources.FindObjectsOfTypeAll<Material>();
            foreach (var m in allMaterials)
            {
                if (m != null && m.name.Equals(name, StringComparison.OrdinalIgnoreCase))
                    return m;
            }
            return null;
        }

        private void SuppressStandaloneUI()
        {
            // Close all registered menus in MenuActions
            var menuActions = FindFirstObjectByType<MenuActions>();
            if (menuActions != null)
            {
                menuActions.CloseAllMenus();
            }

            // Ensure tutorial is marked done and deactivated
            if (SaveLoadHandler.Instance != null && SaveLoadHandler.Instance.data != null)
            {
                SaveLoadHandler.Instance.data.tutorialDone = true;
            }
            var tut = FindFirstObjectByType<TutorialMenu>(FindObjectsInactive.Include);
            if (tut != null)
            {
                if (tut.tutorialRoot != null) tut.tutorialRoot.SetActive(false);
                tut.gameObject.SetActive(false);
            }

            // Deactivate all modal canvases by name (including with Canvas suffix)
            string[] standaloneCanvasNames = new[] { 
                "SettingsMenuCanvas", "SettingsMenu", 
                "AvatarLibraryCanvas", "AvatarLibrary", 
                "TutorialMenuCanvas", "TutorialMenu", 
                "QuickMenuCanvas", "QuickMenu",
                "AlarmsMenuCanvas", "AlarmsMenu",
                "ChatCanvas", "ChatBox"
            };

            foreach (var canvasName in standaloneCanvasNames)
            {
                var go = GameObject.Find(canvasName);
                if (go != null)
                {
                    go.SetActive(false);
                }
            }

            // Ensure an active EventSystem exists for UI and radial menu pointer rays
            if (EventSystem.current == null)
            {
                var existing = FindFirstObjectByType<EventSystem>(FindObjectsInactive.Include);
                if (existing != null)
                {
                    existing.gameObject.SetActive(true);
                    existing.enabled = true;
                }
                else
                {
                    var esGo = new GameObject("StageMateEventSystem");
                    esGo.AddComponent<EventSystem>();
                    esGo.AddComponent<StandaloneInputModule>();
                }
            }

            // Ensure CircleSelector and its parent Canvas/UI root are active
            var circleSelector = FindFirstObjectByType<Xamin.CircleSelector>(FindObjectsInactive.Include);
            if (circleSelector != null)
            {
                Transform cur = circleSelector.transform;
                while (cur != null)
                {
                    if (!cur.gameObject.activeSelf)
                        cur.gameObject.SetActive(true);
                    cur = cur.parent;
                }
                Debug.Log("[StageMateBridge] Activated CircleSelector and its parent UI hierarchy.");
            }
        }

        private string ResolveInitialModelPath()
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i].Equals("--model", StringComparison.OrdinalIgnoreCase) ||
                    args[i].Equals("-model", StringComparison.OrdinalIgnoreCase))
                {
                    string p = args[i + 1].Trim('"');
                    if (File.Exists(p)) return p;
                }
            }

            string envModel = Environment.GetEnvironmentVariable("AIRI_VRM_MODEL");
            if (!string.IsNullOrEmpty(envModel) && File.Exists(envModel))
                return envModel;

            if (!string.IsNullOrEmpty(fallbackModelPath) && File.Exists(fallbackModelPath))
                return fallbackModelPath;

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string[] candidates = new string[]
            {
                Path.Combine(baseDir, "test-model.vrm"),
                Path.Combine(baseDir, "../test-model.vrm"),
                Path.Combine(baseDir, "../../test-model.vrm"),
                Path.Combine(baseDir, "../../../test-model.vrm"),
                Path.Combine(Application.dataPath, "../../test-model.vrm"),
                Path.Combine(Application.dataPath, "../../../test-model.vrm"),
            };

            foreach (var cand in candidates)
            {
                try
                {
                    string full = Path.GetFullPath(cand);
                    if (File.Exists(full)) return full;
                }
                catch { }
            }

            return "";
        }
    }
}
