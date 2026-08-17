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
                    viewportController?.SetMode(env.mode);
                    break;
                case "stage:vrm:lip-sync":
                    var lipMsg = JsonUtility.FromJson<LipSyncMessage>(json);
                    if (lipMsg?.payload != null)
                        vrmDriver?.SetLipSync(lipMsg.payload.rms);
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
            if (syncMsg?.payload == null) return;

            var p = syncMsg.payload;
            activeModelId = p.activeModelId;

            // 1. Window Bounds
            if (p.windowBounds != null && windowManager != null)
            {
                windowManager.SetBounds(p.windowBounds.x, p.windowBounds.y, p.windowBounds.width, p.windowBounds.height);
            }

            // 2. Viewport Mode
            if (!string.IsNullOrEmpty(p.stageMode) && viewportController != null)
            {
                viewportController.SetMode(p.stageMode);
            }

            // 3. Model Transform
            if (p.modelTransform != null && viewportController != null)
            {
                Vector3 pos = p.modelTransform.position != null ? p.modelTransform.position.ToVector3() : Vector3.zero;
                Vector3 rot = p.modelTransform.rotation != null ? p.modelTransform.rotation.ToVector3() : Vector3.zero;
                Vector3 scale = p.modelTransform.scale != null ? p.modelTransform.scale.ToVector3() : Vector3.one;
                viewportController.SetModelTransform(pos, rot, scale);
            }

            // 4. Model Load
            if (!string.IsNullOrEmpty(p.currentModelPath) && p.currentModelPath != activeModelPath && vrmDriver != null)
            {
                activeModelPath = p.currentModelPath;
                _ = LoadModelAsyncInternal(activeModelPath);
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
