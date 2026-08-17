using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UniGLTF;
using VRM;
using UniVRM10;

#if UNITY_EDITOR
using UnityEditor;
#endif

namespace StageMate
{
    public enum ViewMode
    {
        ModelSpin = 0,
        Drag = 1,
        CameraOrbit = 2
    }

    [Serializable]
    public struct IdleClipEntry
    {
        public string name;
        public AnimationClip clip;
        public bool loopTime;
    }

    public class MateSidecar : MonoBehaviour
    {
        [Header("Configuration")]
        public int port = 6171;
        public string authToken = "mate-stage-dev-token";
        public string defaultModelPath = "";
        public RuntimeAnimatorController baseIdleController;

        [Header("Idle Animation Catalog (35 Clips)")]
        public List<IdleClipEntry> idleCatalog = new List<IdleClipEntry>();

        [Header("Scene References")]
        public Camera orbitCamera;
        public Transform modelRoot;
        public Light mainLight;

        [Header("Runtime State")]
        public ViewMode currentViewMode = ViewMode.Drag;
        public GameObject loadedModel;
        public string activeModelPath = "";
        public string activeIdleAnimationName = "";
        public bool isConnected = false;
        public bool isAuthenticated = false;

        // Private internals
        private ClientWebSocket _ws;
        private CancellationTokenSource _cts;
        private readonly Queue<Action> _mainThreadQueue = new Queue<Action>();
        private readonly object _queueLock = new object();

        private Animator _animator;
        private AnimatorOverrideController _overrideController;
        private bool _isStateA = true;
        private Coroutine _idleCycleCoroutine;
        private List<string> _activeIdlePool = new List<string>();

        private VRMBlendShapeProxy _vrm0BlendShapes;
        private Vrm10Instance _vrm10Instance;
        private Coroutine _expressionDecayCoroutine;

        // Camera / viewport state
        private Vector3 _cameraLookTarget = new Vector3(0f, 1.1f, 0f);
        private float _cameraDistance = 2.4f;
        private float _cameraPitch = 10f;
        private float _cameraYaw = 0f;
        private Vector3 _dragStartModelPos;
        private Plane _dragPlane;
        private bool _isDragging = false;
        private Vector3 _dragLastMousePos;

        // Visual status dot
        private float _yellowBlinkTimer = 0f;
        private string _statusMessage = "Starting Stage-Mate...";

        void Awake()
        {
            if (orbitCamera == null)
            {
                orbitCamera = Camera.main;
                if (orbitCamera == null)
                {
                    var camObj = new GameObject("StageMateCamera");
                    orbitCamera = camObj.AddComponent<Camera>();
                    orbitCamera.clearFlags = CameraClearFlags.Color;
                    orbitCamera.backgroundColor = new Color(0.08f, 0.08f, 0.12f, 1f);
                }
            }

            if (modelRoot == null)
            {
                var rootObj = new GameObject("ModelRoot");
                rootObj.transform.position = Vector3.zero;
                modelRoot = rootObj.transform;
            }

            ParseCommandLineAndEnv();
            RestoreWindowSize();
        }

        void Start()
        {
            UpdateCameraTransform();
            StartWebSocketLoop();

            // Load initial model if specified or discoverable
            string initialPath = ResolveInitialModelPath();
            if (!string.IsNullOrEmpty(initialPath) && File.Exists(initialPath))
            {
                LoadModel(initialPath);
            }
        }

        void Update()
        {
            // Process main thread actions dispatched from WS worker task
            lock (_queueLock)
            {
                while (_mainThreadQueue.Count > 0)
                {
                    _mainThreadQueue.Dequeue()?.Invoke();
                }
            }

            if (_yellowBlinkTimer > 0f)
            {
                _yellowBlinkTimer -= Time.deltaTime;
            }

            HandleInputHotkeys();
            HandleViewportInteraction();
        }

        void OnDestroy()
        {
            StopWebSocket();
        }

        #region CLI & Environment Parsing

        private void ParseCommandLineAndEnv()
        {
            string envPort = Environment.GetEnvironmentVariable("MATE_HARNESS_PORT");
            if (!string.IsNullOrEmpty(envPort) && int.TryParse(envPort, out int p))
            {
                port = p;
            }

            string envToken = Environment.GetEnvironmentVariable("AIRI_AUTH_TOKEN");
            if (string.IsNullOrEmpty(envToken))
                envToken = Environment.GetEnvironmentVariable("MATE_AUTH_TOKEN");
            if (!string.IsNullOrEmpty(envToken))
                authToken = envToken;

            string envModel = Environment.GetEnvironmentVariable("MATE_MODEL_PATH");
            if (!string.IsNullOrEmpty(envModel))
                defaultModelPath = envModel;

            string envIdles = Environment.GetEnvironmentVariable("MATE_IDLE_ANIMATIONS");
            if (!string.IsNullOrEmpty(envIdles))
            {
                _activeIdlePool.Clear();
                foreach (var item in envIdles.Split(','))
                {
                    var t = item.Trim();
                    if (!string.IsNullOrEmpty(t))
                        _activeIdlePool.Add(t);
                }
            }

            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--port" && i + 1 < args.Length && int.TryParse(args[i + 1], out int cliPort))
                    port = cliPort;
                else if (args[i] == "--token" && i + 1 < args.Length)
                    authToken = args[i + 1];
                else if (args[i] == "--model" && i + 1 < args.Length)
                    defaultModelPath = args[i + 1];
            }
        }

        private string ResolveInitialModelPath()
        {
            if (!string.IsNullOrEmpty(defaultModelPath) && File.Exists(defaultModelPath))
                return defaultModelPath;

            string parentDir = Path.GetFullPath(Path.Combine(Application.dataPath, "../../"));
            string candidate1 = Path.Combine(parentDir, "test-model.vrm");
            if (File.Exists(candidate1))
                return candidate1;

            string candidate2 = Path.Combine(parentDir, "test-model-2.vrm");
            if (File.Exists(candidate2))
                return candidate2;

            return "";
        }

        #endregion

        #region WebSocket Communication

        private void StartWebSocketLoop()
        {
            _cts = new CancellationTokenSource();
            Task.Run(() => WebSocketWorker(_cts.Token));
        }

        private void StopWebSocket()
        {
            _cts?.Cancel();
            try
            {
                _ws?.Abort();
                _ws?.Dispose();
            }
            catch { }
            _ws = null;
        }

        private async Task WebSocketWorker(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    EnqueueMainThread(() =>
                    {
                        isConnected = false;
                        isAuthenticated = false;
                        _statusMessage = $"Connecting to ws://localhost:{port}...";
                    });

                    _ws = new ClientWebSocket();
                    Uri serverUri = new Uri($"ws://localhost:{port}");
                    await _ws.ConnectAsync(serverUri, token);

                    EnqueueMainThread(() =>
                    {
                        isConnected = true;
                        _statusMessage = "Authenticating with Stage-Mate host...";
                    });

                    // Send module:authenticate
                    string authJson = $"{{\"type\":\"module:authenticate\",\"data\":{{\"token\":\"{authToken}\",\"caller\":\"mate-engine\"}}}}";
                    await SendWebSocketRaw(authJson, token);

                    byte[] buffer = new byte[65536];
                    while (_ws.State == WebSocketState.Open && !token.IsCancellationRequested)
                    {
                        WebSocketReceiveResult result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", token);
                            break;
                        }

                        string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        EnqueueMainThread(() => HandleIncomingMessage(message));
                    }
                }
                catch (Exception ex)
                {
                    if (token.IsCancellationRequested) break;
                    EnqueueMainThread(() =>
                    {
                        isConnected = false;
                        isAuthenticated = false;
                        _statusMessage = $"Connection lost: {ex.Message}. Retrying in 2s...";
                    });
                    await Task.Delay(2000, token);
                }
            }
        }

        private async Task SendWebSocketRaw(string json, CancellationToken token)
        {
            if (_ws != null && _ws.State == WebSocketState.Open)
            {
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, token);
            }
        }

        public void SendMessageOverWs(string json)
        {
            Task.Run(async () =>
            {
                try
                {
                    if (_ws != null && _ws.State == WebSocketState.Open && _cts != null)
                    {
                        byte[] bytes = Encoding.UTF8.GetBytes(json);
                        await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, _cts.Token);
                    }
                }
                catch { }
            });
        }

        private void HandleIncomingMessage(string json)
        {
            _yellowBlinkTimer = 0.25f;

            try
            {
                if (json.Contains("\"type\":\"module:authenticated\""))
                {
                    isAuthenticated = true;
                    _statusMessage = "Authenticated & ready";
                    SendMessageOverWs("{\"type\":\"module:announce\",\"data\":{\"name\":\"StageMate\"}}");

                    if (!string.IsNullOrEmpty(activeModelPath))
                    {
                        SendMessageOverWs($"{{\"type\":\"stage:vrm:ready\",\"data\":{{\"modelPath\":\"{activeModelPath.Replace("\\", "\\\\")}\"}}}}");
                    }
                    return;
                }

                if (json.Contains("\"type\":\"stage:vrm:load\""))
                {
                    string path = ExtractJsonString(json, "modelPath");
                    if (!string.IsNullOrEmpty(path))
                    {
                        LoadModel(path);
                    }
                    return;
                }

                if (json.Contains("\"type\":\"stage:vrm:idle\""))
                {
                    List<string> animations = ExtractJsonStringArray(json, "idleAnimations");
                    SetIdleAnimationPool(animations);
                    return;
                }

                if (json.Contains("\"type\":\"stage:vrm:expression\""))
                {
                    string exprName = ExtractJsonString(json, "name");
                    float weight = ExtractJsonFloat(json, "weight", 1.0f);
                    int durationMs = ExtractJsonInt(json, "durationMs", 2500);
                    TriggerExpression(exprName, weight, durationMs);
                    return;
                }

                if (json.Contains("\"type\":\"stage:vrm:lip-sync\""))
                {
                    float rms = ExtractJsonFloat(json, "rms", 0.0f);
                    ApplyLipSync(rms);
                    return;
                }

                if (json.Contains("\"type\":\"stage:size-preset\""))
                {
                    string preset = ExtractJsonString(json, "preset");
                    ApplySizePreset(preset);
                    return;
                }

                if (json.Contains("\"type\":\"control:always-on-top\""))
                {
                    // Optional window topmost handler
                    return;
                }

                if (json.Contains("\"type\":\"control:stage\""))
                {
                    bool enabled = json.Contains("\"enabled\":true");
                    if (loadedModel != null)
                        loadedModel.SetActive(enabled);
                    return;
                }

                if (json.Contains("\"type\":\"control:viewport-drag\""))
                {
                    currentViewMode = ViewMode.Drag;
                    return;
                }

                if (json.Contains("\"type\":\"control:viewport-orbit\""))
                {
                    currentViewMode = ViewMode.CameraOrbit;
                    return;
                }

                if (json.Contains("\"type\":\"control:viewport-tactile\""))
                {
                    currentViewMode = ViewMode.ModelSpin;
                    return;
                }

                if (json.Contains("\"type\":\"control:viewport-cycle-modes\""))
                {
                    CycleViewMode();
                    return;
                }

                if (json.Contains("\"type\":\"control:viewport-reset-coordinates\""))
                {
                    ResetCoordinates();
                    return;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MateSidecar] Error parsing message: {ex.Message}\nRaw: {json}");
            }
        }

        #endregion

        #region VRM Model Loading & Setup

        public async void LoadModel(string path)
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path))
            {
                Debug.LogWarning($"[MateSidecar] Model file not found: {path}");
                return;
            }

            _statusMessage = $"Loading model: {Path.GetFileName(path)}...";

            try
            {
                byte[] fileData = await Task.Run(() => File.ReadAllBytes(path));
                if (fileData == null || fileData.Length == 0) return;

                GameObject newModel = null;

                // 1. Try VRM 1.0 Import
                try
                {
                    var glbData = new GlbFileParser(path).Parse();
                    var vrm10Data = Vrm10Data.Parse(glbData);
                    if (vrm10Data != null)
                    {
                        using var importer10 = new Vrm10Importer(vrm10Data);
                        var instance10 = await importer10.LoadAsync(new ImmediateCaller());
                        if (instance10.Root != null)
                        {
                            newModel = instance10.Root;
                            _vrm10Instance = instance10;
                            _vrm0BlendShapes = null;
                        }
                    }
                }
                catch { }

                // 2. Fallback to VRM 0.x Import
                if (newModel == null)
                {
                    try
                    {
                        using var gltfData = new GlbBinaryParser(fileData, path).Parse();
                        using var importer = new VRMImporterContext(new VRMData(gltfData));
                        var instance = await importer.LoadAsync(new ImmediateCaller());
                        if (instance.Root != null)
                        {
                            newModel = instance.Root;
                            _vrm0BlendShapes = newModel.GetComponent<VRMBlendShapeProxy>();
                            _vrm10Instance = null;
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.LogError($"[MateSidecar] VRM 0.x load failed: {ex.Message}");
                        return;
                    }
                }

                if (newModel == null) return;

                // Clean up previous model
                if (loadedModel != null)
                {
                    Destroy(loadedModel);
                }

                loadedModel = newModel;
                activeModelPath = path;

                // Configure hierarchy & rotation
                loadedModel.transform.SetParent(modelRoot, false);
                loadedModel.transform.localPosition = Vector3.zero;
                // Invariant: local rotation = Quaternion.Euler(0, 180, 0) so avatar faces camera
                loadedModel.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
                loadedModel.transform.localScale = Vector3.one;

                // Enable all mesh renderers
                EnableAllRenderers(loadedModel);

                // Setup Animator & Idle Controller
                SetupAnimator(loadedModel);

                // Notify harness
                SendMessageOverWs($"{{\"type\":\"stage:vrm:ready\",\"data\":{{\"modelPath\":\"{path.Replace("\\", "\\\\")}\"}}}}");

                _statusMessage = $"Rendered: {Path.GetFileName(path)}";
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MateSidecar] Failed to finalize model: {ex.Message}");
                _statusMessage = $"Load error: {ex.Message}";
            }
        }

        private void EnableAllRenderers(GameObject target)
        {
            foreach (var smr in target.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                smr.enabled = true;
            }
            foreach (var mr in target.GetComponentsInChildren<MeshRenderer>(true))
            {
                mr.enabled = true;
            }
        }

        private void SetupAnimator(GameObject target)
        {
            _animator = target.GetComponent<Animator>();
            if (_animator == null)
            {
                _animator = target.AddComponent<Animator>();
            }

            if (baseIdleController != null)
            {
                _overrideController = new AnimatorOverrideController(baseIdleController);
                _animator.runtimeAnimatorController = _overrideController;
            }

            // Start idle animation cycle
            StartIdleCycle();
        }

        #endregion

        #region Idle Animation Cycle Engine

        public void SetIdleAnimationPool(List<string> animations)
        {
            _activeIdlePool = animations ?? new List<string>();
            StartIdleCycle();
        }

        private void StartIdleCycle()
        {
            if (_idleCycleCoroutine != null)
            {
                StopCoroutine(_idleCycleCoroutine);
                _idleCycleCoroutine = null;
            }

            if (_animator == null || _overrideController == null || idleCatalog.Count == 0)
                return;

            _idleCycleCoroutine = StartCoroutine(IdleCycleLoop());
        }

        private IEnumerator IdleCycleLoop()
        {
            string currentClipName = "";

            while (true)
            {
                IdleClipEntry chosenEntry;

                if (_activeIdlePool.Count == 0)
                {
                    // Fallback to first catalog entry
                    chosenEntry = idleCatalog[0];
                }
                else if (_activeIdlePool.Count == 1)
                {
                    // Single clip loop
                    chosenEntry = FindClipInCatalog(_activeIdlePool[0]);
                }
                else
                {
                    // Pick random from pool, excluding current if alternatives exist
                    List<string> candidates = new List<string>(_activeIdlePool);
                    if (candidates.Count > 1 && !string.IsNullOrEmpty(currentClipName))
                    {
                        candidates.Remove(currentClipName);
                    }
                    string pick = candidates[UnityEngine.Random.Range(0, candidates.Count)];
                    chosenEntry = FindClipInCatalog(pick);
                }

                if (chosenEntry.clip != null)
                {
                    currentClipName = chosenEntry.name;
                    activeIdleAnimationName = chosenEntry.name;

                    // Ping-pong between IdleA and IdleB for 0.8s crossfade
                    string targetState = _isStateA ? "IdleB" : "IdleA";
                    string placeholderSlot = _isStateA ? "PlaceholderIdleB" : "PlaceholderIdleA";

                    _overrideController[placeholderSlot] = chosenEntry.clip;
                    _animator.CrossFadeInFixedTime(targetState, 0.8f);
                    _isStateA = !_isStateA;

                    float duration = chosenEntry.clip.length;
                    if (_activeIdlePool.Count <= 1 && chosenEntry.loopTime)
                    {
                        // Loop forever on single clip
                        yield return new WaitForSeconds(60f);
                    }
                    else
                    {
                        yield return new WaitForSeconds(Mathf.Max(1f, duration - 0.8f));
                    }
                }
                else
                {
                    yield return new WaitForSeconds(2f);
                }
            }
        }

        private IdleClipEntry FindClipInCatalog(string name)
        {
            string clean = name.Trim().ToLowerInvariant();
            foreach (var entry in idleCatalog)
            {
                if (entry.name.ToLowerInvariant() == clean)
                    return entry;
            }
            // Fallback matching without spaces / underscores
            clean = clean.Replace(" ", "").Replace("_", "");
            foreach (var entry in idleCatalog)
            {
                string entryClean = entry.name.ToLowerInvariant().Replace(" ", "").Replace("_", "");
                if (entryClean == clean)
                    return entry;
            }

            Debug.LogWarning($"[MateSidecar] Idle clip '{name}' not found in catalog. Using default.");
            return idleCatalog.Count > 0 ? idleCatalog[0] : default;
        }

        #endregion

        #region Expressions & Lip-Sync

        public void TriggerExpression(string name, float weight, int durationMs)
        {
            if (_expressionDecayCoroutine != null)
            {
                StopCoroutine(_expressionDecayCoroutine);
                _expressionDecayCoroutine = null;
            }

            _expressionDecayCoroutine = StartCoroutine(ExpressionRoutine(name, weight, durationMs));
        }

        private IEnumerator ExpressionRoutine(string name, float weight, int durationMs)
        {
            ApplyExpressionWeight(name, weight);
            yield return new WaitForSeconds(durationMs / 1000f);
            ApplyExpressionWeight(name, 0f);
            _expressionDecayCoroutine = null;
        }

        private void ApplyExpressionWeight(string name, float weight)
        {
            if (_vrm0BlendShapes != null)
            {
                BlendShapePreset preset = BlendShapePreset.Unknown;
                if (Enum.TryParse<BlendShapePreset>(name, true, out var parsed))
                    preset = parsed;

                if (preset != BlendShapePreset.Unknown)
                {
                    _vrm0BlendShapes.ImmediatelySetValue(BlendShapeKey.CreateFromPreset(preset), weight);
                }
                else
                {
                    _vrm0BlendShapes.ImmediatelySetValue(BlendShapeKey.CreateUnknown(name), weight);
                }
            }
        }

        public void ApplyLipSync(float rms)
        {
            if (_vrm0BlendShapes != null)
            {
                _vrm0BlendShapes.ImmediatelySetValue(BlendShapeKey.CreateFromPreset(BlendShapePreset.A), Mathf.Clamp01(rms));
            }
        }

        #endregion

        #region Viewport & Camera Interaction

        private void HandleInputHotkeys()
        {
            if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.S))
                currentViewMode = ViewMode.ModelSpin;
            else if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.D))
                currentViewMode = ViewMode.Drag;
            else if (Input.GetKeyDown(KeyCode.Alpha3) || Input.GetKeyDown(KeyCode.O))
                currentViewMode = ViewMode.CameraOrbit;
            else if (Input.GetKeyDown(KeyCode.V) || Input.GetKeyDown(KeyCode.C))
                CycleViewMode();
            else if (Input.GetKeyDown(KeyCode.R))
                ResetCoordinates();
        }

        private void HandleViewportInteraction()
        {
            // Zoom (Scroll Wheel) - active in all modes
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.001f)
            {
                _cameraDistance = Mathf.Clamp(_cameraDistance - scroll * 2.5f, 0.5f, 10f);
                UpdateCameraTransform();
            }

            if (Input.GetMouseButtonDown(0))
            {
                _isDragging = true;
                _dragLastMousePos = Input.mousePosition;
                if (loadedModel != null)
                {
                    _dragStartModelPos = loadedModel.transform.position;
                    _dragPlane = new Plane(-orbitCamera.transform.forward, _dragStartModelPos);
                }
            }
            else if (Input.GetMouseButtonUp(0))
            {
                _isDragging = false;
            }

            if (_isDragging)
            {
                Vector3 delta = Input.mousePosition - _dragLastMousePos;
                _dragLastMousePos = Input.mousePosition;

                switch (currentViewMode)
                {
                    case ViewMode.ModelSpin:
                        if (loadedModel != null)
                        {
                            loadedModel.transform.Rotate(0f, -delta.x * 0.5f, 0f, Space.World);
                        }
                        break;

                    case ViewMode.Drag:
                        if (loadedModel != null)
                        {
                            Ray ray = orbitCamera.ScreenPointToRay(Input.mousePosition);
                            if (_dragPlane.Raycast(ray, out float enter))
                            {
                                loadedModel.transform.position = ray.GetPoint(enter);
                            }
                        }
                        break;

                    case ViewMode.CameraOrbit:
                        _cameraYaw += delta.x * 0.35f;
                        _cameraPitch = Mathf.Clamp(_cameraPitch - delta.y * 0.35f, -80f, 80f);
                        UpdateCameraTransform();
                        break;
                }
            }
        }

        private void UpdateCameraTransform()
        {
            if (orbitCamera == null) return;

            Quaternion rot = Quaternion.Euler(_cameraPitch, _cameraYaw, 0f);
            Vector3 offset = rot * new Vector3(0f, 0f, -_cameraDistance);
            orbitCamera.transform.position = _cameraLookTarget + offset;
            orbitCamera.transform.LookAt(_cameraLookTarget);
        }

        private void CycleViewMode()
        {
            int next = ((int)currentViewMode + 1) % 3;
            currentViewMode = (ViewMode)next;
        }

        private void ResetCoordinates()
        {
            if (loadedModel != null)
            {
                loadedModel.transform.position = Vector3.zero;
                loadedModel.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            }
            _cameraPitch = 10f;
            _cameraYaw = 0f;
            _cameraDistance = 2.4f;
            UpdateCameraTransform();
        }

        #endregion

        #region Window Size & Presets

        public void ApplySizePreset(string preset)
        {
            int width = 450;
            int height = 600;

            switch (preset.ToLowerInvariant())
            {
                case "mini":
                    width = 220; height = 315;
                    break;
                case "med.":
                case "med":
                case "medium":
                    width = 450; height = 600;
                    break;
                case "large":
                    width = 800; height = 1000;
                    break;
                case "full":
                    width = Screen.currentResolution.width;
                    height = Screen.currentResolution.height;
                    break;
            }

            Screen.SetResolution(width, height, FullScreenMode.Windowed);
            PlayerPrefs.SetString("stage-mate-window-size", preset);
            PlayerPrefs.Save();
        }

        private void RestoreWindowSize()
        {
            string saved = PlayerPrefs.GetString("stage-mate-window-size", "med.");
            ApplySizePreset(saved);
        }

        #endregion

        #region OnGUI Overlay

        void OnGUI()
        {
            // Status Dot
            Color dotColor = Color.red;
            if (_yellowBlinkTimer > 0f)
                dotColor = Color.yellow;
            else if (isAuthenticated)
                dotColor = Color.green;

            GUI.color = dotColor;
            GUI.Label(new Rect(12, 10, 20, 20), "●");

            // Text Info
            GUI.color = Color.white;
            string modelName = string.IsNullOrEmpty(activeModelPath) ? "(none)" : Path.GetFileName(activeModelPath);
            string info = $"Stage-Mate Sidecar\nStatus: {_statusMessage}\nModel: {modelName}\nMode: {currentViewMode} | Idle: {activeIdleAnimationName}\n[1:Spin 2:Drag 3:Orbit R:Reset]";
            GUI.Label(new Rect(32, 8, 380, 80), info);

            // Size preset button top-right
            if (GUI.Button(new Rect(Screen.width - 36, 8, 28, 24), "◉"))
            {
                CycleSizePreset();
            }
        }

        private void CycleSizePreset()
        {
            string current = PlayerPrefs.GetString("stage-mate-window-size", "med.");
            string next = "med.";
            if (current == "mini") next = "med.";
            else if (current == "med." || current == "med") next = "large";
            else if (current == "large") next = "mini";
            ApplySizePreset(next);
        }

        #endregion

        #region Helpers

        private void EnqueueMainThread(Action action)
        {
            lock (_queueLock)
            {
                _mainThreadQueue.Enqueue(action);
            }
        }

        private string ExtractJsonString(string json, string key)
        {
            string pattern = $"\"{key}\":\"";
            int idx = json.IndexOf(pattern);
            if (idx < 0) return "";
            int start = idx + pattern.Length;
            int end = json.IndexOf("\"", start);
            if (end < 0) return "";
            return json.Substring(start, end - start);
        }

        private float ExtractJsonFloat(string json, string key, float defaultVal)
        {
            string pattern = $"\"{key}\":";
            int idx = json.IndexOf(pattern);
            if (idx < 0) return defaultVal;
            int start = idx + pattern.Length;
            int end = json.IndexOfAny(new char[] { ',', '}', ']' }, start);
            if (end < 0) end = json.Length;
            string valStr = json.Substring(start, end - start).Trim();
            return float.TryParse(valStr, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float res) ? res : defaultVal;
        }

        private int ExtractJsonInt(string json, string key, int defaultVal)
        {
            string pattern = $"\"{key}\":";
            int idx = json.IndexOf(pattern);
            if (idx < 0) return defaultVal;
            int start = idx + pattern.Length;
            int end = json.IndexOfAny(new char[] { ',', '}', ']' }, start);
            if (end < 0) end = json.Length;
            string valStr = json.Substring(start, end - start).Trim();
            return int.TryParse(valStr, out int res) ? res : defaultVal;
        }

        private List<string> ExtractJsonStringArray(string json, string key)
        {
            var list = new List<string>();
            string pattern = $"\"{key}\":[";
            int idx = json.IndexOf(pattern);
            if (idx < 0) return list;
            int start = idx + pattern.Length;
            int end = json.IndexOf("]", start);
            if (end < 0) return list;
            string arrayContent = json.Substring(start, end - start);
            string[] items = arrayContent.Split(',');
            foreach (var item in items)
            {
                string clean = item.Trim().Trim('"');
                if (!string.IsNullOrEmpty(clean))
                    list.Add(clean);
            }
            return list;
        }

        #endregion
    }
}
