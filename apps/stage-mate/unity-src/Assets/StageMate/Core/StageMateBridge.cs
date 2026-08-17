using System;
using System.IO;
using Kirurobo;
using UnityEngine;

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
                windowController.isHitTestEnabled = true;
                windowController.hitTestType = UniWindowController.HitTestType.Opacity;
                windowController.opacityThreshold = 0.05f;
                windowController.autoSwitchCameraBackground = true;
                windowController.isTransparent = true;
                windowController.alphaValue = 1.0f;
            }

            // Suppress standalone non-sidecar UI menus in sidecar mode
            SuppressStandaloneUI();

            // Attach Telemetry Probe for runtime event tracking
            if (GetComponent<MateTelemetryProbe>() == null)
            {
                gameObject.AddComponent<MateTelemetryProbe>();
            }

            // Load initial model if specified
            string initial = ResolveInitialModelPath();
            if (!string.IsNullOrEmpty(initial))
            {
                Debug.Log($"[StageMateBridge] Loading initial model on start: {initial}");
                LoadModel(initial);
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

                case "control:viewport:mode":
                    string mode = env.data != null && !string.IsNullOrEmpty(env.data.mode) ? env.data.mode : env.mode;
                    SetViewportMode(mode);
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
                }

                if (d.viewport != null && !string.IsNullOrEmpty(d.viewport.mode))
                {
                    SetViewportMode(d.viewport.mode);
                }

                if (d.stage != null && windowController != null)
                {
                    windowController.alphaValue = d.stage.enabled ? 1.0f : 0.0f;
                }

                if (d.model != null && !string.IsNullOrEmpty(d.model.modelPath) && d.model.modelPath != activeModelPath)
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

                if (!string.IsNullOrEmpty(p.currentModelPath) && p.currentModelPath != activeModelPath)
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

            var animCtrl = FindFirstObjectByType<AvatarAnimatorController>();
            if (animCtrl != null)
            {
                // In TACTILE mode, dragging avatar by waist moves window and allows petting/IK
                // In DRAG / ORBIT mode, block native dragging so external controls can operate
                bool isTactile = mode.Equals("tactile", StringComparison.OrdinalIgnoreCase) ||
                                 mode.Equals("tactileMode", StringComparison.OrdinalIgnoreCase);
                animCtrl.BlockDraggingOverride = !isTactile;
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
                Debug.Log($"[StageMateBridge] Invoking native VRMLoader for: {path}");
                vrmLoader.LoadVRM(path);
                socket?.SendJson($"{{\"type\":\"stage:vrm:ready\",\"data\":{{\"modelPath\":\"{path.Replace("\\", "\\\\")}\",\"modelId\":\"{activeModelId}\"}}}}");
            }
            else
            {
                Debug.LogError("[StageMateBridge] VRMLoader not found in scene!");
            }
        }

        private void SuppressStandaloneUI()
        {
            // Deactivate standalone UI canvases that AIRI replaces
            string[] standaloneCanvasNames = new[] { "SettingsMenu", "AvatarLibrary", "TutorialMenu", "QuickMenu" };
            foreach (var canvasName in standaloneCanvasNames)
            {
                var go = GameObject.Find(canvasName);
                if (go != null)
                {
                    go.SetActive(false);
                }
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
