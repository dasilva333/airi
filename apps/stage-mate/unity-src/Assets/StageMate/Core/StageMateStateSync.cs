using System;
using UnityEngine;
using StageMate.Window;
using StageMate.Viewport;
using StageMate.Companion;
using StageMate.Models;

namespace StageMate.Core
{
    public class StageMateStateSync : MonoBehaviour
    {
        [Header("Managed Components")]
        public StageMateSocket socket;
        public StageMateWindowManager windowManager;
        public StageMateViewportController viewportController;
        public StageMateCameraRig cameraRig;
        public StageMateTactileHandler tactileHandler;
        public StageMateLocomotion locomotion;
        public StageMatePlushBed plushBed;
        public VrmModelDriver vrmDriver;
        public string fallbackModelPath;

        private string activeModelPath;
        private string activeModelId;

        private void Start()
        {
            if (socket == null) socket = GetComponent<StageMateSocket>();

            if (socket != null)
            {
                socket.OnMessageReceived += HandleMessage;
            }

            if (windowManager != null)
            {
                windowManager.OnWindowMoved += (bounds) =>
                {
                    var msg = new WindowBoundsUpdateMessage { bounds = bounds };
                    socket?.SendJson(JsonUtility.ToJson(msg));
                };
            }

            if (viewportController != null)
            {
                viewportController.OnModelTransformChanged += (pos, rot, scale) =>
                {
                    var msg = new ModelPositionUpdateMessage
                    {
                        modelId = activeModelId,
                        position = pos,
                        rotation = rot,
                        scale = scale
                    };
                    socket?.SendJson(JsonUtility.ToJson(msg));
                };
            }

            // Resolve initial model to display on startup (even standalone)
            string initialModel = ResolveInitialModelPath();
            if (!string.IsNullOrEmpty(initialModel) && vrmDriver != null)
            {
                Debug.Log($"[StageMateStateSync] Loading initial model on start: {initialModel}");
                _ = LoadModelAsyncInternal(initialModel);
            }
            else
            {
                Debug.LogWarning("[StageMateStateSync] No initial model found to load on start");
            }
        }

        private string ResolveInitialModelPath()
        {
            // 1. CLI parameter: --model <path> or -model <path>
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i].Equals("--model", StringComparison.OrdinalIgnoreCase) ||
                    args[i].Equals("-model", StringComparison.OrdinalIgnoreCase))
                {
                    string p = args[i + 1].Trim('"');
                    if (System.IO.File.Exists(p)) return p;
                }
            }

            // 2. Environment variable: AIRI_VRM_MODEL
            string envModel = Environment.GetEnvironmentVariable("AIRI_VRM_MODEL");
            if (!string.IsNullOrEmpty(envModel) && System.IO.File.Exists(envModel))
                return envModel;

            // 3. Fallback model property configured at build/scene time
            if (!string.IsNullOrEmpty(fallbackModelPath) && System.IO.File.Exists(fallbackModelPath))
                return fallbackModelPath;

            // 4. Look relative to the runtime executable and project
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string[] candidates = new string[]
            {
                System.IO.Path.Combine(baseDir, "test-model.vrm"),
                System.IO.Path.Combine(baseDir, "../test-model.vrm"),
                System.IO.Path.Combine(baseDir, "../../test-model.vrm"),
                System.IO.Path.Combine(baseDir, "../../../test-model.vrm"),
                System.IO.Path.Combine(Application.dataPath, "../../test-model.vrm"),
                System.IO.Path.Combine(Application.dataPath, "../../../test-model.vrm"),
            };

            foreach (var cand in candidates)
            {
                try
                {
                    string full = System.IO.Path.GetFullPath(cand);
                    if (System.IO.File.Exists(full))
                        return full;
                }
                catch { }
            }

            return "";
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
                    viewportController?.SetMode(mode);
                    break;

                case "control:viewport-drag":
                    viewportController?.SetMode("drag");
                    break;

                case "control:viewport-orbit":
                    viewportController?.SetMode("orbit");
                    break;

                case "control:viewport-tactile":
                case "control:viewport-spin":
                    viewportController?.SetMode("tactile");
                    break;

                case "control:stage":
                    if (env.data != null && windowManager?.windowController != null)
                    {
                        windowManager.windowController.alphaValue = env.data.enabled ? 1.0f : 0.0f;
                    }
                    break;

                case "control:always-on-top":
                    if (env.data != null && windowManager?.windowController != null)
                    {
                        windowManager.windowController.isTopmost = env.data.enabled;
                    }
                    break;

                case "stage:vrm:load":
                    string loadPath = env.data != null ? env.data.modelPath : env.path;
                    if (!string.IsNullOrEmpty(loadPath))
                        _ = LoadModelAsyncInternal(loadPath);
                    break;

                case "stage:vrm:idle":
                    if (env.data?.idleAnimations != null && vrmDriver != null)
                    {
                        vrmDriver.ApplyIdleKeys(env.data.idleAnimations);
                    }
                    break;

                case "stage:vrm:lip-sync":
                    float rms = env.data != null ? env.data.rms : 0f;
                    var lipMsg = JsonUtility.FromJson<LipSyncMessage>(json);
                    if (lipMsg?.payload != null) rms = lipMsg.payload.rms;
                    vrmDriver?.SetLipSync(rms);
                    break;

                case "stage:vrm:gaze":
                    var gazeMsg = JsonUtility.FromJson<GazeMessage>(json);
                    if (gazeMsg?.payload != null)
                        vrmDriver?.SetGazeTarget(gazeMsg.payload.target.ToVector3(), gazeMsg.payload.enableSaccades, gazeMsg.payload.weight);
                    break;

                case "stage:act":
                    var actMsg = JsonUtility.FromJson<ActMessage>(json);
                    HandleAct(actMsg);
                    break;
            }
        }

        private void HandleStateSync(string json)
        {
            var syncMsg = JsonUtility.FromJson<StateSyncMessage>(json);
            if (syncMsg == null) return;

            // Handle AIRI wire format (syncMsg.data)
            if (syncMsg.data != null)
            {
                var d = syncMsg.data;

                // 1. Window Bounds
                if (d.window != null && windowManager != null)
                {
                    windowManager.SetBounds(d.window.x, d.window.y, d.window.width, d.window.height);
                    if (windowManager.windowController != null)
                        windowManager.windowController.isTopmost = d.window.alwaysOnTop;
                }

                // 2. Viewport Mode
                if (d.viewport != null && !string.IsNullOrEmpty(d.viewport.mode) && viewportController != null)
                {
                    viewportController.SetMode(d.viewport.mode);
                }

                // 3. Stage Visibility
                if (d.stage != null && windowManager?.windowController != null)
                {
                    windowManager.windowController.alphaValue = d.stage.enabled ? 1.0f : 0.0f;
                }

                // 4. Model Transform
                if (d.positioning != null && viewportController != null)
                {
                    viewportController.SetModelTransform(new Vector3(d.positioning.x, d.positioning.y, 0), Vector3.zero, Vector3.one * (d.positioning.scale > 0.01f ? d.positioning.scale : 1f));
                }

                // 5. Model Load
                if (d.model != null && !string.IsNullOrEmpty(d.model.modelPath) && d.model.modelPath != activeModelPath && vrmDriver != null)
                {
                    activeModelPath = d.model.modelPath;
                    activeModelId = d.model.modelId;
                    _ = LoadModelAsyncInternal(activeModelPath);
                }
                return;
            }

            // Handle Harness payload format (syncMsg.payload)
            if (syncMsg.payload != null)
            {
                var p = syncMsg.payload;
                activeModelId = p.activeModelId;

                if (p.windowBounds != null && windowManager != null)
                {
                    windowManager.SetBounds(p.windowBounds.x, p.windowBounds.y, p.windowBounds.width, p.windowBounds.height);
                }

                if (!string.IsNullOrEmpty(p.stageMode) && viewportController != null)
                {
                    viewportController.SetMode(p.stageMode);
                }

                if (p.modelTransform != null && viewportController != null)
                {
                    Vector3 pos = p.modelTransform.position != null ? p.modelTransform.position.ToVector3() : Vector3.zero;
                    Vector3 rot = p.modelTransform.rotation != null ? p.modelTransform.rotation.ToVector3() : Vector3.zero;
                    Vector3 scale = p.modelTransform.scale != null ? p.modelTransform.scale.ToVector3() : Vector3.one;
                    viewportController.SetModelTransform(pos, rot, scale);
                }

                if (!string.IsNullOrEmpty(p.currentModelPath) && p.currentModelPath != activeModelPath && vrmDriver != null)
                {
                    activeModelPath = p.currentModelPath;
                    _ = LoadModelAsyncInternal(activeModelPath);
                }
            }
        }

        private async System.Threading.Tasks.Task LoadModelAsyncInternal(string path)
        {
            bool success = await vrmDriver.LoadModelAsync(path);
            if (success)
            {
                tactileHandler?.BindModelDriver(vrmDriver);
                locomotion?.BindModelDriver(vrmDriver);
                plushBed?.BindModelDriver(vrmDriver);
            }
        }

        private void HandleAct(ActMessage act)
        {
            if (act == null || string.IsNullOrEmpty(act.action)) return;

            switch (act.action.ToLowerInvariant())
            {
                case "face_zoom":
                    cameraRig?.ToggleFaceZoom();
                    break;
                case "chibi":
                    vrmDriver?.ToggleChibiMode();
                    break;
                case "macaron":
                case "bed":
                    plushBed?.ToggleMacaronBed();
                    break;
                case "sit":
                    locomotion?.ToggleSitPose();
                    break;
                case "drop":
                    locomotion?.Unsnap();
                    break;
            }
        }
    }
}
