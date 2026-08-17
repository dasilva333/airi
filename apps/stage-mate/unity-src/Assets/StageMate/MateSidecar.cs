using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Kirurobo;
using UnityEngine;
using UniGLTF;
using VRM;
using UniVRM10;

public class MateSidecar : MonoBehaviour
{
    public string wsUrl = "ws://localhost:6171";
    public string fallbackModelPath = "";
    public Transform cameraRig;
    public Camera orbitCamera;

    // Idle animation wiring (populated by MateSidecarBuild at build time).
    public IdleClipEntry[] idleCatalog = Array.Empty<IdleClipEntry>();
    public RuntimeAnimatorController idleBaseController;
    public AnimationClip idlePlaceholderA;
    public AnimationClip idlePlaceholderB;
    public UniWindowController windowController;

    private ClientWebSocket socket;
    private CancellationTokenSource cts;
    private volatile bool connected;
    private DateTime lastRx = DateTime.MinValue;
    private GameObject loadedModel;
    private RuntimeGltfInstance gltfInstance;
    private string currentPath;
    private float pitch = 10f;
    private float yaw = 0f;
    private float distance = 3f;

    private Animator animator;
    private AnimatorOverrideController overrideController;
    private readonly List<IdleClipEntry> idlePool = new List<IdleClipEntry>();
    private Coroutine idleCoroutine;
    private string[] pendingIdleKeys;
    private int activeIdleState;
    public enum ViewMode
    {
        ModelSpin = 0,
        Drag = 1,
        CameraOrbit = 2,
        None = 3,
    }
    private ViewMode viewMode = ViewMode.Drag;

    public enum ConfigMode
    {
        Size = 0,
        Position = 1,
    }
    private ConfigMode configMode = ConfigMode.Size;

    private bool configOverlayOpen;
    private bool showBackground = false;
    private bool showModel = true;

    private float toolbarAlpha = 0f;
    private float lastMouseMoveTime;
    private Vector2 lastMousePos;

    private bool isDraggingWindow;
    private Vector2 windowGrabOffset;
    private bool prevHitTestState = true;
    private string activeLoadedModelId = "";

    private Texture2D panelTex;
    private Texture2D btnNormalTex;
    private Texture2D btnHoverTex;
    private Texture2D btnActiveTex;
    private Texture2D btnDangerTex;
    private GUIStyle panelStyle;
    private GUIStyle headerStyle;
    private GUIStyle btnStyle;
    private GUIStyle btnActiveStyle;
    private GUIStyle btnDangerStyle;

    [Header("Gaze & Head Tracking")]
    public bool enableTracking = false;
    private Transform lookAtTargetTransform;
    private Transform headBone;
    private Transform spineBone;
    private Transform chestBone;
    private Transform headDriver;
    private Transform spineDriver;
    private Quaternion headInitRot;
    private Quaternion spineInitRot;
    private Vector3 smoothedLookAtPos;
    private float saccadeTimer;
    private Vector3 saccadeOffset;

    private Coroutine activeExpressionCoroutine;
    private string currentExpressionName;

    private string authToken = string.Empty;
    private bool authenticated = false;

    private static readonly (string label, Vector2 size)[] SizePresets =
    {
        ("mini", new Vector2(220f, 315f)),
        ("med.", new Vector2(450f, 600f)),
        ("large", new Vector2(800f, 1000f)),
    };
    private const string SizePrefKey = "stage-mate-window-size";
    private const string SizePrefDelimiter = "x";
    private Vector2 pendingInitialSize;
    private bool hasPendingInitialSize;
    private Vector3 dragStartMousePos;
    private Vector3 dragStartModelPos;
    private bool isDragging;

    [Serializable]
    public class IdleClipEntry
    {
        public string name;
        public AnimationClip clip;
        public bool loopTime;
    }

    private void Start()
    {
        pendingInitialSize = LoadSavedSize();
        hasPendingInitialSize = true;

        if (windowController != null)
        {
            windowController.isTransparent = !showBackground;
            windowController.isHitTestEnabled = true;
            windowController.hitTestType = UniWindowController.HitTestType.Opacity;
            windowController.opacityThreshold = 0.05f;
            windowController.autoSwitchCameraBackground = true;
        }

        if (orbitCamera != null)
        {
            orbitCamera.clearFlags = CameraClearFlags.SolidColor;
            orbitCamera.backgroundColor = showBackground ? new Color(0.12f, 0.12f, 0.16f, 1f) : new Color(0f, 0f, 0f, 0f);
        }

        ResolveAuthToken();

        if (!string.IsNullOrEmpty(fallbackModelPath))
        {
            Debug.Log($"[MateSidecar] loading fallback model on start: {fallbackModelPath}");
            _ = LoadVrmAsync(fallbackModelPath);
        }
    }

    private void ResolveAuthToken()
    {
        // 1. Check CLI arguments: --token <val> or -token <val>
        string[] args = Environment.GetCommandLineArgs();
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--token" || args[i] == "-token" || args[i] == "--auth-token")
            {
                authToken = args[i + 1].Trim();
                Debug.Log("[MateSidecar] resolved auth token from CLI arguments");
                return;
            }
        }

        // 2. Check Environment Variable
        string envToken = Environment.GetEnvironmentVariable("AIRI_AUTH_TOKEN");
        if (!string.IsNullOrEmpty(envToken))
        {
            authToken = envToken.Trim();
            Debug.Log("[MateSidecar] resolved auth token from AIRI_AUTH_TOKEN env var");
            return;
        }

        // 3. Check known AIRI user-data config on disk (e.g. server-channel-config.json)
        try
        {
            string home = Environment.GetFolderPath(Environment.SpecialFolder.Personal);
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

            string[] searchPaths = new string[]
            {
                Path.Combine(home, "Library/Application Support/@proj-airi/stage-tamagotchi/server-channel-config.json"),
                Path.Combine(appData, "@proj-airi/stage-tamagotchi/server-channel-config.json"),
                Path.Combine(home, ".config/@proj-airi/stage-tamagotchi/server-channel-config.json"),
                Path.Combine(home, ".airi/gateway.token")
            };

            foreach (var sp in searchPaths)
            {
                if (File.Exists(sp))
                {
                    string text = File.ReadAllText(sp).Trim();
                    if (sp.EndsWith(".json"))
                    {
                        var cfg = JsonUtility.FromJson<ServerChannelConfigFile>(text);
                        if (cfg != null && !string.IsNullOrEmpty(cfg.authToken))
                        {
                            authToken = cfg.authToken.Trim();
                            Debug.Log($"[MateSidecar] resolved auth token from {sp}");
                            return;
                        }
                    }
                    else if (!string.IsNullOrEmpty(text))
                    {
                        authToken = text;
                        Debug.Log($"[MateSidecar] resolved auth token from {sp}");
                        return;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Debug.LogWarning($"[MateSidecar] disk token lookup error: {ex.Message}");
        }

        authToken = "mate-stage-dev-token";
        Debug.Log("[MateSidecar] using default dev auth token");
    }

    private void OnEnable()
    {
        cts = new CancellationTokenSource();
        _ = ClientLoop();
    }

    private void OnDisable()
    {
        try { cts?.Cancel(); } catch { }
        try { socket?.Dispose(); } catch { }
        cts = null;
        socket = null;
    }

    private async Task ClientLoop()
    {
        while (cts != null && !cts.IsCancellationRequested)
        {
            try
            {
                using (var ws = new ClientWebSocket())
                {
                    socket = ws;
                    await ws.ConnectAsync(new Uri(wsUrl), CancellationToken.None);
                    connected = true;
                    authenticated = false;
                    Debug.Log("[MateSidecar] connected to WebSocket server, sending module:authenticate...");

                    // Step 1: Send module:authenticate handshake
                    var authMsg = new WireAuthMessage
                    {
                        type = "module:authenticate",
                        data = new WireAuthData
                        {
                            token = authToken,
                            caller = "stage-mate",
                            purpose = "Native VRM Stage Renderer"
                        }
                    };
                    await SendJsonAsync(ws, JsonUtility.ToJson(authMsg));

                    var buffer = new byte[16384];
                    var sb = new StringBuilder();
                    while (ws.State == WebSocketState.Open)
                    {
                        var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                        if (result.MessageType == WebSocketMessageType.Close)
                            break;
                        sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                        if (result.EndOfMessage)
                        {
                            lastRx = DateTime.UtcNow;
                            HandleMessage(sb.ToString());
                            sb.Clear();
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[MateSidecar] ws error: {ex.Message}");
            }

            connected = false;
            authenticated = false;
            socket = null;
            Debug.Log("[MateSidecar] disconnected; retrying in 2s");
            await Task.Delay(2000);
        }
    }

    private void HandleMessage(string json)
    {
        Debug.Log($"[MateSidecar] rx: {json}");
        try
        {
            var msg = JsonUtility.FromJson<WireGenericMessage>(json);
            if (msg == null || string.IsNullOrEmpty(msg.type))
                return;

            switch (msg.type)
            {
                case "module:authenticated":
                    if (msg.data != null && msg.data.authenticated)
                    {
                        authenticated = true;
                        Debug.Log("[MateSidecar] successfully authenticated with server!");

                        // Step 2: Send module:announce
                        var announceMsg = new WireAnnounceMessage
                        {
                            type = "module:announce",
                            data = new WireAnnounceData
                            {
                                name = "proj-airi:stage-mate",
                                caller = "stage-mate",
                                possibleEvents = new string[]
                                {
                                    "stage:vrm:ready",
                                    "stage:vrm:load",
                                    "stage:vrm:lip-sync",
                                    "stage:vrm:expression"
                                }
                            }
                        };
                        _ = SendJsonAsync(socket, JsonUtility.ToJson(announceMsg));
                    }
                    else
                    {
                        authenticated = false;
                        Debug.LogWarning($"[MateSidecar] authentication rejected: {msg.data?.error ?? "Invalid token"}");
                        try { socket?.CloseAsync(WebSocketCloseStatus.NormalClosure, "Authentication failed", CancellationToken.None); } catch { }
                    }
                    break;

                case "module:announced":
                    Debug.Log("[MateSidecar] module announcement acknowledged. Handshake complete!");
                    break;

                case "stage:state:sync":
                    if (msg.data != null)
                    {
                        // 1. Sync OS window bounds
                        if (msg.data.window != null && windowController != null)
                        {
                            int w = Mathf.RoundToInt(msg.data.window.width > 50 ? msg.data.window.width : 300);
                            int h = Mathf.RoundToInt(msg.data.window.height > 50 ? msg.data.window.height : 450);
                            int x = Mathf.RoundToInt(msg.data.window.x);
                            int y = Mathf.RoundToInt(msg.data.window.y);

                            windowController.windowSize = new Vector2(w, h);
                            int screenH = Screen.currentResolution.height > 0 ? Screen.currentResolution.height : 1080;
                            windowController.windowPosition = new Vector2(x, screenH - y - h);
                            windowController.isTopmost = msg.data.window.alwaysOnTop;
                            Debug.Log($"[MateSidecar] Applied synced window bounds: ({x}, {y}, {w}x{h})");
                        }

                        // 2. Sync viewport mode
                        if (msg.data.viewport != null && !string.IsNullOrEmpty(msg.data.viewport.mode))
                        {
                            ApplyViewportModeString(msg.data.viewport.mode);
                        }

                        // 3. Sync stage visibility
                        if (msg.data.stage != null && windowController != null)
                        {
                            windowController.alphaValue = msg.data.stage.enabled ? 1f : 0f;
                        }

                        // 4. Sync model and positioning
                        if (msg.data.model != null && !string.IsNullOrEmpty(msg.data.model.modelPath))
                        {
                            _ = LoadVrmAsync(msg.data.model.modelPath, msg.data.positioning, msg.data.model.modelId);
                        }
                    }
                    break;

                case "control:viewport:mode":
                    if (msg.data != null && !string.IsNullOrEmpty(msg.data.mode))
                    {
                        ApplyViewportModeString(msg.data.mode);
                    }
                    break;

                case "stage:model:position":
                    if (msg.data != null && loadedModel != null)
                    {
                        var bounds = ComputeBounds(loadedModel);
                        loadedModel.transform.localPosition = new Vector3(-bounds.center.x + msg.data.x, msg.data.y, -bounds.center.z);
                        if (msg.data.scale > 0.01f)
                            loadedModel.transform.localScale = Vector3.one * msg.data.scale;
                        Debug.Log($"[MateSidecar] Applied model position: x={msg.data.x}, y={msg.data.y}, scale={msg.data.scale}");
                    }
                    break;

                case "stage:vrm:load":
                    if (msg.data != null && !string.IsNullOrEmpty(msg.data.modelPath))
                    {
                        WireSyncPositionData posData = null;
                        if (msg.data.position != null)
                            posData = msg.data.position;
                        else if (msg.data.positioning != null)
                            posData = msg.data.positioning;
                        _ = LoadVrmAsync(msg.data.modelPath, posData, msg.data.modelId);
                    }
                    break;

                case "stage:vrm:idle":
                    if (msg.data?.idleAnimations != null)
                        ApplyIdleKeys(msg.data.idleAnimations);
                    break;

                case "stage:vrm:lip-sync":
                    if (msg.data != null)
                        ApplyLipSync(msg.data.rms);
                    break;

                case "stage:vrm:expression":
                    if (msg.data != null)
                    {
                        string expr = !string.IsNullOrEmpty(msg.data.name) ? msg.data.name : msg.data.expression;
                        float w = msg.data.weight > 0f ? msg.data.weight : 1f;
                        float dur = msg.data.durationMs > 0f ? msg.data.durationMs / 1000f : 2.5f;
                        ApplyExpression(expr ?? "Angry", w, dur);
                    }
                    break;

                case "stage:size-preset":
                    if (msg.data != null && !string.IsNullOrEmpty(msg.data.preset))
                        ApplySizePresetString(msg.data.preset);
                    break;

                case "control:always-on-top":
                    if (msg.data != null && windowController != null)
                    {
                        windowController.isTopmost = msg.data.enabled;
                        Debug.Log($"[MateSidecar] always-on-top: {msg.data.enabled}");
                    }
                    break;

                case "control:stage":
                    if (msg.data != null && windowController != null)
                    {
                        windowController.alphaValue = msg.data.enabled ? 1f : 0f;
                        Debug.Log($"[MateSidecar] stage visibility: {msg.data.enabled}");
                    }
                    break;

                case "control:viewport-drag":
                    viewMode = ViewMode.Drag;
                    Debug.Log($"[MateSidecar] viewMode set to Drag");
                    break;

                case "control:viewport-orbit":
                    viewMode = ViewMode.CameraOrbit;
                    Debug.Log($"[MateSidecar] viewMode set to CameraOrbit");
                    break;

                case "control:viewport-tactile":
                case "control:viewport-spin":
                    viewMode = ViewMode.ModelSpin;
                    Debug.Log($"[MateSidecar] viewMode set to ModelSpin");
                    break;

                case "control:viewport-cycle-modes":
                    viewMode = (ViewMode)(((int)viewMode + 1) % 3);
                    Debug.Log($"[MateSidecar] viewMode cycled to: {viewMode}");
                    break;

                case "control:viewport-reset-coordinates":
                    if (loadedModel != null)
                        loadedModel.transform.localPosition = Vector3.zero;
                    distance = 3f;
                    if (orbitCamera != null)
                        orbitCamera.transform.localPosition = new Vector3(0f, 0f, -distance);
                    Debug.Log("[MateSidecar] coordinates reset to default");
                    break;
            }
        }
        catch (Exception ex)
        {
            Debug.LogWarning($"[MateSidecar] failed to parse message: {ex.Message}");
        }
    }

    private void ApplySizePresetString(string preset)
    {
        string p = preset.ToLowerInvariant();
        if (p == "mini")
            ResizeWindow(SizePresets[0].size);
        else if (p == "med." || p == "medium")
            ResizeWindow(SizePresets[1].size);
        else if (p == "large")
            ResizeWindow(SizePresets[2].size);
        else if (p == "full")
            ApplyFullWorkarea();
    }

    private void ApplyLipSync(float rms)
    {
        if (loadedModel == null)
            return;

        // VRM 1.0 Runtime Expression
        var vrm10 = loadedModel.GetComponent<Vrm10Instance>();
        if (vrm10 != null && vrm10.Runtime != null && vrm10.Runtime.Expression != null)
        {
            vrm10.Runtime.Expression.SetWeight(ExpressionKey.Aa, Mathf.Clamp01(rms));
            return;
        }

        // VRM 0.x BlendShapeProxy
        var vrm0 = loadedModel.GetComponent<VRMBlendShapeProxy>();
        if (vrm0 != null)
        {
            vrm0.SetValue(BlendShapeKey.CreateFromPreset(BlendShapePreset.A), Mathf.Clamp01(rms));
        }
    }

    private void ApplyExpression(string exprName, float weight, float duration)
    {
        if (activeExpressionCoroutine != null)
            StopCoroutine(activeExpressionCoroutine);
        activeExpressionCoroutine = StartCoroutine(ExpressionRoutine(exprName, weight, duration));
    }

    private IEnumerator ExpressionRoutine(string exprName, float peakWeight, float duration)
    {
        currentExpressionName = exprName;
        float holdTime = Mathf.Max(0.3f, duration - 0.6f);
        float fadeOutTime = 0.6f;

        SetVrmExpressionWeight(exprName, peakWeight);
        Debug.Log($"[MateSidecar] expression active → {exprName} ({peakWeight:0.00}) for {duration:0.0}s");

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
        currentExpressionName = null;
        activeExpressionCoroutine = null;
        Debug.Log($"[MateSidecar] expression reset → {exprName}");
    }

    private void SetVrmExpressionWeight(string exprName, float weight)
    {
        if (loadedModel == null || string.IsNullOrEmpty(exprName))
            return;

        string nameLower = exprName.Trim().ToLowerInvariant();

        // 1. VRM 1.0 Runtime Expression
        var vrm10 = loadedModel.GetComponent<Vrm10Instance>();
        if (vrm10 != null && vrm10.Runtime != null && vrm10.Runtime.Expression != null)
        {
            ExpressionKey key = ExpressionKey.CreateCustom(exprName);
            if (nameLower == "angry") key = ExpressionKey.Angry;
            else if (nameLower == "happy" || nameLower == "joy") key = ExpressionKey.Happy;
            else if (nameLower == "sad" || nameLower == "sorrow") key = ExpressionKey.Sad;
            else if (nameLower == "relaxed" || nameLower == "neutral") key = ExpressionKey.Relaxed;
            else if (nameLower == "surprised") key = ExpressionKey.Surprised;
            else if (nameLower == "blink") key = ExpressionKey.Blink;

            vrm10.Runtime.Expression.SetWeight(key, Mathf.Clamp01(weight));
            return;
        }

        // 2. VRM 0.x BlendShapeProxy
        var vrm0 = loadedModel.GetComponent<VRMBlendShapeProxy>();
        if (vrm0 != null)
        {
            BlendShapeKey key = BlendShapeKey.CreateUnknown(exprName);
            if (nameLower == "angry") key = BlendShapeKey.CreateFromPreset(BlendShapePreset.Angry);
            else if (nameLower == "happy" || nameLower == "joy") key = BlendShapeKey.CreateFromPreset(BlendShapePreset.Joy);
            else if (nameLower == "sad" || nameLower == "sorrow") key = BlendShapeKey.CreateFromPreset(BlendShapePreset.Sorrow);
            else if (nameLower == "neutral") key = BlendShapeKey.CreateFromPreset(BlendShapePreset.Neutral);
            else if (nameLower == "blink") key = BlendShapeKey.CreateFromPreset(BlendShapePreset.Blink);

            vrm0.ImmediatelySetValue(key, Mathf.Clamp01(weight));
        }
    }

    // Resolve idle animation keys (AIRI `acting.idleAnimations` shape) against the
    // baked catalog and (re)start the cycle. Keys match clip names case-insensitively.
    private void ApplyIdleKeys(string[] keys)
    {
        pendingIdleKeys = keys ?? Array.Empty<string>();

        if (animator == null || idleBaseController == null)
            return; // model not loaded yet; applied on load

        idlePool.Clear();
        foreach (var key in pendingIdleKeys)
        {
            var entry = ResolveIdleClip(key);
            if (entry != null)
                idlePool.Add(entry);
        }

        Debug.Log($"[MateSidecar] idle pool: [{string.Join(", ", idlePool.ConvertAll(e => e.name))}] (from {pendingIdleKeys.Length} keys)");
        RestartIdleCycle();
    }

    private IdleClipEntry ResolveIdleClip(string key)
    {
        if (string.IsNullOrEmpty(key))
            return null;
        foreach (var entry in idleCatalog)
        {
            if (string.Equals(entry.name, key, StringComparison.OrdinalIgnoreCase))
                return entry;
        }
        Debug.LogWarning($"[MateSidecar] idle clip not found in catalog: {key}");
        return null;
    }

    private void SetupAnimator(GameObject model)
    {
        animator = model.GetComponentInChildren<Animator>();
        if (animator == null || idleBaseController == null)
        {
            animator = null;
            return;
        }

        overrideController = new AnimatorOverrideController(idleBaseController);
        animator.runtimeAnimatorController = overrideController;
        animator.applyRootMotion = false;
    }

    private void RestartIdleCycle()
    {
        if (idleCoroutine != null)
            StopCoroutine(idleCoroutine);
        idleCoroutine = idlePool.Count > 0 ? StartCoroutine(IdleCycle()) : null;
    }

    private IEnumerator IdleCycle()
    {
        while (idlePool.Count > 0)
        {
            var entry = PickNextIdle();
            bool single = idlePool.Count == 1;
            currentIdleEntry = entry;

            activeIdleState = 1 - activeIdleState;
            string stateName = activeIdleState == 0 ? "IdleA" : "IdleB";
            var placeholder = activeIdleState == 0 ? idlePlaceholderA : idlePlaceholderB;

            if (overrideController != null && placeholder != null)
                overrideController[placeholder] = entry.clip;

            if (animator != null)
                animator.CrossFade(stateName, 0.8f);

            Debug.Log($"[MateSidecar] idle → {entry.name} ({(single ? "loop" : "cycle")})");

            // Single clip that loops natively: let the Animator loop forever.
            if (single && entry.loopTime)
                yield break;

            // Otherwise advance on the clip's own duration (covers non-looping singles and multi-clip cycles).
            yield return new WaitForSeconds(entry.clip.length);
        }
    }

    private IdleClipEntry PickNextIdle()
    {
        if (idlePool.Count == 1)
            return idlePool[0];

        // AIRI semantics: exclude the currently-playing clip when alternatives exist,
        // else fall back to the full pool (self-repeat allowed).
        var others = new List<IdleClipEntry>();
        foreach (var e in idlePool)
        {
            if (e != currentIdleEntry)
                others.Add(e);
        }
        var choices = others.Count > 0 ? others : idlePool;
        return choices[UnityEngine.Random.Range(0, choices.Count)];
    }

    private IdleClipEntry currentIdleEntry;
    private int loadEpoch;
    private string inFlightLoadingPath;

    private async Task LoadVrmAsync(string path, WireSyncPositionData position = null, string modelId = null)
    {
        if (string.IsNullOrEmpty(path) || !File.Exists(path))
        {
            Debug.LogWarning($"[MateSidecar] model not found: {path}");
            return;
        }

        if (!string.IsNullOrEmpty(modelId))
            activeLoadedModelId = modelId;
        else if (path.Contains("display-model-"))
        {
            int idx = path.IndexOf("display-model-");
            int endIdx = path.IndexOf(".vrm", idx);
            if (endIdx > idx)
                activeLoadedModelId = path.Substring(idx, endIdx - idx);
        }

        // If the requested model is already loaded and active, acknowledge ready & apply position
        if (currentPath == path && loadedModel != null)
        {
            if (position != null)
            {
                var curBounds = ComputeBounds(loadedModel);
                loadedModel.transform.localPosition = new Vector3(-curBounds.center.x + position.x, position.y, -curBounds.center.z);
                if (position.scale > 0.01f)
                    loadedModel.transform.localScale = Vector3.one * position.scale;
            }
            SendReady(path);
            return;
        }

        // If already in the middle of loading this exact model, let the in-flight load finish
        if (inFlightLoadingPath == path)
        {
            return;
        }

        inFlightLoadingPath = path;
        int epoch = ++loadEpoch;

        try
        {
            // Read file with retry in case of transient write locks
            byte[] bytes = null;
            for (int attempt = 0; attempt < 5; attempt++)
            {
                try
                {
                    bytes = await Task.Run(() => File.ReadAllBytes(path));
                    if (bytes != null && bytes.Length > 0)
                        break;
                }
                catch (IOException) when (attempt < 4)
                {
                    await Task.Delay(100);
                }
            }

            if (bytes == null || bytes.Length == 0)
            {
                Debug.LogError($"[MateSidecar] failed to read bytes from: {path}");
                return;
            }

            GameObject model = null;
            RuntimeGltfInstance newGltfInstance = null;

            try
            {
                var glb = new GlbFileParser(path).Parse();
                var vrm10Data = Vrm10Data.Parse(glb);
                if (vrm10Data != null)
                {
                    using var importer = new Vrm10Importer(vrm10Data);
                    var inst = await importer.LoadAsync(new ImmediateCaller());
                    if (inst.Root != null)
                    {
                        model = inst.Root;
                        newGltfInstance = inst;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[MateSidecar] VRM 1.x parse failed ({ex.Message}), falling back to VRM 0.x");
            }

            if (model == null)
            {
                var gltf = new GlbBinaryParser(bytes, path).Parse();
                using var importer = new VRMImporterContext(new VRMData(gltf));
                var inst = await importer.LoadAsync(new ImmediateCaller());
                if (inst.Root != null)
                {
                    model = inst.Root;
                    newGltfInstance = inst;
                }
            }

            if (model == null)
            {
                Debug.LogError($"[MateSidecar] failed to load model: {path}");
                return;
            }

            // A newer load superseded this one while we awaited; discard this result.
            if (epoch != loadEpoch)
            {
                Destroy(model);
                try { newGltfInstance?.Dispose(); } catch { }
                Debug.Log($"[MateSidecar] discarded stale load: {path}");
                return;
            }

            // Successfully loaded new model! Now cleanly dispose the previous model.
            if (loadedModel != null)
            {
                Destroy(loadedModel);
                loadedModel = null;
            }
            try { gltfInstance?.Dispose(); } catch { }
            gltfInstance = newGltfInstance;
            animator = null;
            overrideController = null;
            idlePool.Clear();
            if (idleCoroutine != null)
            {
                StopCoroutine(idleCoroutine);
                idleCoroutine = null;
            }

            currentPath = path;
            model.transform.SetParent(transform, false);
            model.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            loadedModel = model;

            EnableAllRenderers(model);
            var bounds = ComputeBounds(model);

            // Centering & Positioning: align model root and apply position offset
            if (position != null)
            {
                model.transform.localPosition = new Vector3(-bounds.center.x + position.x, position.y, -bounds.center.z);
                if (position.scale > 0.01f)
                    model.transform.localScale = Vector3.one * position.scale;
            }
            else
            {
                model.transform.localPosition = new Vector3(-bounds.center.x, 0f, -bounds.center.z);
            }

            // Framing: focus camera on upper-body / face area
            float focusY = bounds.size.y > 0.5f ? Mathf.Clamp(bounds.center.y + bounds.extents.y * 0.25f, 0.9f, 1.6f) : 1.3f;
            if (cameraRig != null)
            {
                cameraRig.localPosition = new Vector3(0f, focusY, 0f);
                cameraRig.localRotation = Quaternion.identity;
            }
            if (orbitCamera != null)
            {
                distance = Mathf.Clamp(bounds.size.y * 1.5f, 1.8f, 3.0f);
                orbitCamera.transform.localPosition = new Vector3(0f, 0f, -distance);
                orbitCamera.transform.localRotation = Quaternion.identity;
            }
            yaw = 0f;
            pitch = 0f;
            isDragging = false;

            Debug.Log($"[MateSidecar] loaded model: {path} (bounds: {bounds}, focusY: {focusY}, dist: {distance})");

            SetupAnimator(model);
            InitTracking(model);
            if (pendingIdleKeys != null)
                ApplyIdleKeys(pendingIdleKeys);

            SendReady(path);
        }
        catch (Exception ex)
        {
            Debug.LogError($"[MateSidecar] load failed: {ex.Message}");
        }
        finally
        {
            if (inFlightLoadingPath == path)
                inFlightLoadingPath = null;
        }
    }

    private static void EnableAllRenderers(GameObject root)
    {
        foreach (var r in root.GetComponentsInChildren<Renderer>(true))
            r.enabled = true;
    }

    private static Bounds ComputeBounds(GameObject root)
    {
        var renderers = root.GetComponentsInChildren<Renderer>(true);
        if (renderers.Length == 0)
            return new Bounds(Vector3.zero, Vector3.one);
        var b = renderers[0].bounds;
        foreach (var r in renderers)
            b.Encapsulate(r.bounds);
        return b;
    }

    private async Task SendJsonAsync(ClientWebSocket ws, string json)
    {
        if (ws == null || ws.State != WebSocketState.Open)
            return;
        try
        {
            var bytes = Encoding.UTF8.GetBytes(json);
            await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        catch { }
    }

    private async void SendReady(string path)
    {
        if (socket != null && socket.State == WebSocketState.Open)
        {
            var msg = JsonUtility.ToJson(new WireGenericMessage { type = "stage:vrm:ready", data = new WireGenericData { modelPath = path } });
            await SendJsonAsync(socket, msg);
        }
    }

private void ApplyPendingInitialSize()
    {
        if (!hasPendingInitialSize || windowController == null)
            return;

        // Wait until the native window has been attached (UniWinCore.IsActive).
        // UniWindowController lazily attaches on its first Update; windowSize is
        // a no-op before then.
        var current = windowController.windowSize;
        if (current.x <= 0f || current.y <= 0f)
            return;

        hasPendingInitialSize = false;
        windowController.windowSize = pendingInitialSize;
        Debug.Log($"[MateSidecar] applied saved/initial size → {pendingInitialSize.x:0}×{pendingInitialSize.y:0}");
    }

    private void Update()
    {
        ApplyPendingInitialSize();
        HandleWindowDrag();
        HandleZoom();
        HandleModeSwitchKeys();
        UpdateToolbarVisibility();

        if (viewMode == ViewMode.Drag)
            HandleDragInput();
        else if (viewMode == ViewMode.ModelSpin)
            HandleModelSpinInput();
        else if (viewMode == ViewMode.CameraOrbit)
            HandleCameraOrbitInput();
    }

    private void LateUpdate()
    {
        if (!enableTracking || loadedModel == null || orbitCamera == null)
            return;

        UpdateLookAtTarget();
        ApplyHeadAndSpineTracking();
    }

    private void InitTracking(GameObject model)
    {
        var vrm10 = model.GetComponent<Vrm10Instance>();
        var vrm0LookAt = model.GetComponent<VRMLookAtHead>();

        if (!enableTracking)
        {
            if (vrm10 != null)
            {
                vrm10.LookAtTarget = null;
            }
            if (vrm0LookAt != null)
            {
                vrm0LookAt.Target = null;
                vrm0LookAt.enabled = false;
            }
            return;
        }

        if (lookAtTargetTransform == null)
        {
            var targetGO = new GameObject("SidecarLookAtTarget");
            targetGO.transform.SetParent(transform, false);
            lookAtTargetTransform = targetGO.transform;
            smoothedLookAtPos = orbitCamera != null ? orbitCamera.transform.position : new Vector3(0f, 1.3f, -3f);
            lookAtTargetTransform.position = smoothedLookAtPos;
        }

        // VRM 1.0 LookAt target assignment
        if (vrm10 != null)
        {
            vrm10.LookAtTarget = lookAtTargetTransform;
            vrm10.LookAtTargetType = VRM10ObjectLookAt.LookAtTargetTypes.YawPitchValue;
        }

        // VRM 0.x LookAt target assignment
        if (vrm0LookAt != null)
        {
            vrm0LookAt.Target = lookAtTargetTransform;
            vrm0LookAt.enabled = true;
        }

        // Humanoid bone tracking setup (head and spine)
        var anim = model.GetComponentInChildren<Animator>();
        if (anim != null && anim.isHuman)
        {
            headBone = anim.GetBoneTransform(HumanBodyBones.Head);
            if (headBone != null)
            {
                if (headDriver == null)
                {
                    headDriver = new GameObject("HeadDriver").transform;
                }
                headDriver.SetParent(headBone.parent, false);
                headDriver.localPosition = headBone.localPosition;
                headDriver.localRotation = headBone.localRotation;
                headInitRot = headBone.localRotation;
            }

            spineBone = anim.GetBoneTransform(HumanBodyBones.Spine);
            chestBone = anim.GetBoneTransform(HumanBodyBones.Chest);
            if (spineBone != null)
            {
                if (spineDriver == null)
                {
                    spineDriver = new GameObject("SpineDriver").transform;
                }
                spineDriver.SetParent(spineBone.parent, false);
                spineDriver.localPosition = spineBone.localPosition;
                spineDriver.localRotation = spineBone.localRotation;
                spineInitRot = spineBone.localRotation;
            }
        }
    }

    private void UpdateLookAtTarget()
    {
        bool mouseInWindow = Input.mousePosition.x >= 0 && Input.mousePosition.x <= Screen.width &&
                             Input.mousePosition.y >= 0 && Input.mousePosition.y <= Screen.height;

        Vector3 targetWorld;
        if (mouseInWindow && (Time.unscaledTime - lastMouseMoveTime < 3f))
        {
            // Project mouse position to world in front of camera
            Ray ray = orbitCamera.ScreenPointToRay(Input.mousePosition);
            targetWorld = ray.GetPoint(Mathf.Clamp(distance, 1.2f, 4f));
        }
        else
        {
            // Look at camera with natural micro-saccades
            saccadeTimer -= Time.deltaTime;
            if (saccadeTimer <= 0f)
            {
                saccadeTimer = UnityEngine.Random.Range(2.5f, 5.5f);
                saccadeOffset = new Vector3(
                    UnityEngine.Random.Range(-0.06f, 0.06f),
                    UnityEngine.Random.Range(-0.04f, 0.04f),
                    0f
                );
            }
            targetWorld = orbitCamera.transform.position + saccadeOffset;
        }

        smoothedLookAtPos = Vector3.Lerp(smoothedLookAtPos, targetWorld, Time.deltaTime * 6f);
        if (lookAtTargetTransform != null)
        {
            lookAtTargetTransform.position = smoothedLookAtPos;
        }
    }

    private void ApplyHeadAndSpineTracking()
    {
        if (headBone == null || headDriver == null)
            return;

        // Head rotation towards smoothedLookAtPos
        Vector3 dirToTarget = (smoothedLookAtPos - headDriver.position).normalized;
        Vector3 localDir = headDriver.parent.InverseTransformDirection(dirToTarget);

        float headYaw = Mathf.Clamp(Mathf.Atan2(localDir.x, localDir.z) * Mathf.Rad2Deg, -35f, 35f);
        float headPitch = Mathf.Clamp(Mathf.Asin(Mathf.Clamp(localDir.y, -1f, 1f)) * Mathf.Rad2Deg, -20f, 20f);

        headDriver.localRotation = Quaternion.Slerp(
            headDriver.localRotation,
            Quaternion.Euler(-headPitch, headYaw, 0f),
            Time.deltaTime * 8f
        );

        Quaternion baseHeadRot = headBone.localRotation;
        Quaternion deltaHead = headDriver.localRotation * Quaternion.Inverse(headInitRot);
        headBone.localRotation = Quaternion.Slerp(baseHeadRot, deltaHead * baseHeadRot, 0.85f);

        // Spine subtle posture shift
        if (spineBone != null && spineDriver != null)
        {
            float spineYaw = headYaw * 0.25f;
            spineDriver.localRotation = Quaternion.Slerp(
                spineDriver.localRotation,
                Quaternion.Euler(0f, spineYaw, 0f),
                Time.deltaTime * 5f
            );

            Quaternion baseSpineRot = spineBone.localRotation;
            Quaternion deltaSpine = spineDriver.localRotation * Quaternion.Inverse(spineInitRot);
            spineBone.localRotation = Quaternion.Slerp(baseSpineRot, deltaSpine * baseSpineRot, 0.35f);

            if (chestBone != null)
            {
                chestBone.localRotation = Quaternion.Slerp(chestBone.localRotation, deltaSpine * chestBone.localRotation, 0.2f);
            }
        }
    }

    private void OnDestroy()
    {
        if (lookAtTargetTransform != null)
            Destroy(lookAtTargetTransform.gameObject);
        if (headDriver != null)
            Destroy(headDriver.gameObject);
        if (spineDriver != null)
            Destroy(spineDriver.gameObject);
    }

    private void UpdateToolbarVisibility()
    {
        Vector2 currentMouse = Input.mousePosition;
        if ((currentMouse - lastMousePos).sqrMagnitude > 1f)
        {
            lastMousePos = currentMouse;
            lastMouseMoveTime = Time.unscaledTime;
        }

        // Toolbar stays visible if config overlay is open, window is being dragged, or mouse moved recently (<2.5s)
        bool shouldShow = configOverlayOpen || isDraggingWindow || (Time.unscaledTime - lastMouseMoveTime < 2.5f);
        toolbarAlpha = Mathf.MoveTowards(toolbarAlpha, shouldShow ? 1f : 0f, Time.unscaledDeltaTime * 4f);
    }

    private void HandleWindowDrag()
    {
        if (!isDraggingWindow || windowController == null)
            return;

        if (Input.GetMouseButton(0))
        {
            windowController.windowPosition = windowController.cursorPosition + windowGrabOffset;
        }
        else
        {
            isDraggingWindow = false;
            if (windowController != null)
                windowController.isHitTestEnabled = prevHitTestState;
            EmitWindowBounds();
        }
    }

    private void EmitWindowBounds()
    {
        if (socket == null || socket.State != WebSocketState.Open || windowController == null)
            return;

        Vector2 pos = windowController.windowPosition;
        Vector2 sz = windowController.windowSize;
        int screenH = Screen.currentResolution.height > 0 ? Screen.currentResolution.height : 1080;
        int topY = screenH - Mathf.RoundToInt(pos.y) - Mathf.RoundToInt(sz.y);

        string payload = $"{{\"type\":\"stage:window:bounds\",\"data\":{{\"x\":{Mathf.RoundToInt(pos.x)},\"y\":{topY},\"width\":{Mathf.RoundToInt(sz.x)},\"height\":{Mathf.RoundToInt(sz.y)}}}}}";
        _ = SendJsonAsync(socket, payload);
        Debug.Log($"[MateSidecar] Emitted window bounds: ({Mathf.RoundToInt(pos.x)}, {topY}, {Mathf.RoundToInt(sz.x)}x{Mathf.RoundToInt(sz.y)})");
    }

    private void HandleModeSwitchKeys()
    {
        // V key: Cycle through modes
        if (Input.GetKeyDown(KeyCode.V))
        {
            viewMode = (ViewMode)(((int)viewMode + 1) % 3);
            Debug.Log($"[MateSidecar] View mode cycled to: {viewMode}");
        }
        // Direct shortcuts: 1/S = Spin, 2/D = Drag, 3/O = Orbit
        else if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Keypad1) || Input.GetKeyDown(KeyCode.S))
        {
            viewMode = ViewMode.ModelSpin;
            Debug.Log($"[MateSidecar] View mode set to: {viewMode}");
        }
        else if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.Keypad2) || Input.GetKeyDown(KeyCode.D))
        {
            viewMode = ViewMode.Drag;
            Debug.Log($"[MateSidecar] View mode set to: {viewMode}");
        }
        else if (Input.GetKeyDown(KeyCode.Alpha3) || Input.GetKeyDown(KeyCode.Keypad3) || Input.GetKeyDown(KeyCode.O))
        {
            viewMode = ViewMode.CameraOrbit;
            Debug.Log($"[MateSidecar] View mode set to: {viewMode}");
        }
    }

    private void ApplyViewportModeString(string mode)
    {
        if (string.IsNullOrEmpty(mode))
            return;

        switch (mode)
        {
            case "dragMode":
            case "drag":
                viewMode = ViewMode.Drag;
                break;
            case "orbitMode":
            case "orbit":
                viewMode = ViewMode.CameraOrbit;
                break;
            case "tactileMode":
            case "tactile":
                viewMode = ViewMode.None;
                break;
            case "positionMode":
            case "positioning":
                viewMode = ViewMode.None;
                break;
        }
        Debug.Log($"[MateSidecar] ViewMode mapped from '{mode}' → {viewMode}");
    }

    private void HandleZoom()
    {
        float scroll = Input.GetAxis("Mouse ScrollWheel");
        if (Mathf.Abs(scroll) > 0.0001f)
        {
            distance = Mathf.Clamp(distance - scroll * 2f, 0.5f, 12f);
            if (orbitCamera != null)
                orbitCamera.transform.localPosition = new Vector3(0f, 0f, -distance);
        }
    }

    private void HandleDragInput()
    {
        if (loadedModel == null || orbitCamera == null)
            return;

        if (Input.GetMouseButtonDown(0))
        {
            dragStartMousePos = Input.mousePosition;
            dragStartModelPos = loadedModel.transform.position;
            isDragging = true;
        }
        else if (Input.GetMouseButton(0) && isDragging)
        {
            // View-plane parallel to camera passing through drag start position.
            // This guarantees distance along camera forward (scale/zoom) remains 100% constant.
            Plane viewPlane = new Plane(-orbitCamera.transform.forward, dragStartModelPos);
            Ray currentRay = orbitCamera.ScreenPointToRay(Input.mousePosition);
            Ray startRay = orbitCamera.ScreenPointToRay(dragStartMousePos);

            if (viewPlane.Raycast(currentRay, out float currentEnter) && viewPlane.Raycast(startRay, out float startEnter))
            {
                Vector3 currentPoint = currentRay.GetPoint(currentEnter);
                Vector3 startPoint = startRay.GetPoint(startEnter);
                Vector3 delta = currentPoint - startPoint;
                Vector3 newPos = dragStartModelPos + delta;

                // Clamp to reasonable viewport bounds
                newPos.x = Mathf.Clamp(newPos.x, -5f, 5f);
                newPos.y = Mathf.Clamp(newPos.y, -3f, 5f);
                newPos.z = Mathf.Clamp(newPos.z, -5f, 5f);
                loadedModel.transform.position = newPos;
            }
        }
        else if (Input.GetMouseButtonUp(0))
        {
            if (isDragging && loadedModel != null && !string.IsNullOrEmpty(activeLoadedModelId))
            {
                EmitModelPosition();
            }
            isDragging = false;
        }
    }

    private void EmitModelPosition()
    {
        if (socket == null || socket.State != WebSocketState.Open || loadedModel == null || string.IsNullOrEmpty(activeLoadedModelId))
            return;

        Vector3 pos = loadedModel.transform.localPosition;
        float scale = loadedModel.transform.localScale.x;
        string payload = $"{{\"type\":\"stage:model:position\",\"data\":{{\"modelId\":\"{activeLoadedModelId}\",\"x\":{pos.x:F3},\"y\":{pos.y:F3},\"scale\":{scale:F3}}}}}";
        _ = SendJsonAsync(socket, payload);
        Debug.Log($"[MateSidecar] Emitted model position: modelId={activeLoadedModelId}, x={pos.x:F3}, y={pos.y:F3}, scale={scale:F3}");
    }

    private void HandleModelSpinInput()
    {
        if (loadedModel == null)
            return;

        if (Input.GetMouseButton(0))
        {
            float deltaX = Input.GetAxis("Mouse X");
            if (Mathf.Abs(deltaX) > 0.0001f)
            {
                loadedModel.transform.Rotate(0f, -deltaX * 5f, 0f, Space.World);
            }
        }
    }

    private void HandleCameraOrbitInput()
    {
        if (cameraRig == null || orbitCamera == null)
            return;

        if (Input.GetMouseButton(0))
        {
            yaw += Input.GetAxis("Mouse X") * 4f;
            pitch -= Input.GetAxis("Mouse Y") * 4f;
            pitch = Mathf.Clamp(pitch, -80f, 80f);

            cameraRig.localRotation = Quaternion.Euler(pitch, yaw, 0f);
            orbitCamera.transform.localPosition = new Vector3(0f, 0f, -distance);
            orbitCamera.transform.localRotation = Quaternion.identity;
        }
    }

    private void EnsureStyles()
    {
        if (panelStyle != null && panelTex != null)
            return;

        panelTex = MakeColorTex(new Color(0.08f, 0.09f, 0.14f, 0.94f));
        btnNormalTex = MakeColorTex(new Color(0.18f, 0.20f, 0.28f, 0.92f));
        btnHoverTex = MakeColorTex(new Color(0.28f, 0.32f, 0.45f, 0.98f));
        btnActiveTex = MakeColorTex(new Color(0.15f, 0.48f, 0.88f, 0.98f));
        btnDangerTex = MakeColorTex(new Color(0.65f, 0.20f, 0.24f, 0.95f));

        panelStyle = new GUIStyle(GUI.skin.box)
        {
            normal = { background = panelTex, textColor = Color.white },
            padding = new RectOffset(10, 10, 10, 10),
            fontSize = 13,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.UpperCenter
        };

        headerStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = 13,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.MiddleCenter,
            normal = { textColor = new Color(0.85f, 0.90f, 1.0f) }
        };

        btnStyle = new GUIStyle(GUI.skin.button)
        {
            normal = { background = btnNormalTex, textColor = Color.white },
            hover = { background = btnHoverTex, textColor = Color.white },
            active = { background = btnActiveTex, textColor = Color.white },
            fontSize = 13,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.MiddleCenter,
            wordWrap = true,
            margin = new RectOffset(2, 2, 2, 2)
        };

        btnActiveStyle = new GUIStyle(btnStyle)
        {
            normal = { background = btnActiveTex, textColor = Color.white },
            hover = { background = btnActiveTex, textColor = Color.white }
        };

        btnDangerStyle = new GUIStyle(btnStyle)
        {
            normal = { background = btnDangerTex, textColor = Color.white }
        };
    }

    private static Texture2D MakeColorTex(Color col)
    {
        var tex = new Texture2D(1, 1);
        tex.SetPixel(0, 0, col);
        tex.Apply();
        return tex;
    }

    private void OnGUI()
    {
        EnsureStyles();

        // 1. Top-Left Status Dot (Green = Authenticated, Orange = Connecting/Auth, Red = Disconnected)
        Color dotColor = (connected && authenticated)
            ? new Color(0.2f, 0.85f, 0.3f, 1f)
            : (connected ? new Color(1f, 0.55f, 0f, 1f) : new Color(0.9f, 0.2f, 0.2f, 1f));
        GUI.color = dotColor;
        GUI.DrawTexture(new Rect(12, 12, 10, 10), Texture2D.whiteTexture);

        // Flash inner indicator pip on active telemetry reception
        if ((DateTime.UtcNow - lastRx).TotalSeconds < 0.25)
        {
            GUI.color = Color.white;
            GUI.DrawTexture(new Rect(15, 15, 4, 4), Texture2D.whiteTexture);
        }
        GUI.color = Color.white;

        // 2. Top-Right Floating Toolbar (actor.vue:600-626 parity)
        DrawTopRightToolbar();

        // 3. Stage Config Overlay (StageConfigOverlay.vue parity)
        if (configOverlayOpen)
        {
            DrawStageConfigOverlay();
        }
    }

    private void DrawTopRightToolbar()
    {
        if (toolbarAlpha < 0.01f)
            return;

        Color prevColor = GUI.color;
        GUI.color = new Color(1f, 1f, 1f, toolbarAlpha);

        float barW = 140f;
        float barH = 38f;
        float barX = Screen.width - barW - 12f;
        float barY = 10f;

        // Pill container box
        GUI.Box(new Rect(barX, barY, barW, barH), string.Empty, panelStyle);

        // Button 1: Window Drag Handle [ MOVE ]
        var dragRect = new Rect(barX + 4f, barY + 3f, 64f, 32f);
        if (Event.current.type == EventType.MouseDown && dragRect.Contains(Event.current.mousePosition))
        {
            if (windowController != null)
            {
                isDraggingWindow = true;
                prevHitTestState = windowController.isHitTestEnabled;
                windowController.isHitTestEnabled = false;
                windowController.isClickThrough = false;
                windowGrabOffset = windowController.windowPosition - windowController.cursorPosition;
            }
            Event.current.Use();
        }
        GUI.Button(dragRect, "MOVE", isDraggingWindow ? btnActiveStyle : btnStyle);

        // Button 2: Stage Config Gear [ CFG ]
        var gearRect = new Rect(barX + 72f, barY + 3f, 64f, 32f);
        if (GUI.Button(gearRect, "CFG", configOverlayOpen ? btnActiveStyle : btnStyle))
        {
            configOverlayOpen = !configOverlayOpen;
        }

        GUI.color = prevColor;
    }

    private void DrawStageConfigOverlay()
    {
        float panelW = 230f;
        float panelH = 290f;
        float panelX = Screen.width - panelW - 12f;
        float panelY = 54f;
        var panelRect = new Rect(panelX, panelY, panelW, panelH);

        GUI.Box(panelRect, string.Empty, panelStyle);

        float pad = 10f;
        float contentW = panelW - pad * 2f;
        float curY = panelY + 10f;

        // Header Title
        GUI.Label(new Rect(panelX, curY, panelW, 22f), "STAGE CONFIG", headerStyle);
        curY += 26f;

        // Row 1: Mode Switch [ MODE: SIZE / POS ] (Left) + Hide Stage [ HIDE ] (Right)
        float row1LeftW = 140f;
        float hideBtnW = contentW - row1LeftW - 6f;
        float row1BtnH = 34f;
        string modeLabel = configMode == ConfigMode.Size ? "MODE: SIZE" : "MODE: POS";
        if (GUI.Button(new Rect(panelX + pad, curY, row1LeftW, row1BtnH), modeLabel, btnActiveStyle))
        {
            configMode = configMode == ConfigMode.Size ? ConfigMode.Position : ConfigMode.Size;
        }
        if (GUI.Button(new Rect(panelX + pad + row1LeftW + 6f, curY, hideBtnW, row1BtnH), "HIDE", btnDangerStyle))
        {
            configOverlayOpen = false;
            if (windowController != null)
                windowController.alphaValue = windowController.alphaValue > 0f ? 0f : 1f;
        }

        curY += row1BtnH + 8f;

        // Rows 2 & 3: 2x2 Grid (Size Mode vs Position Mode)
        float gridBtnW = (contentW - 6f) / 2f;
        float gridBtnH = 42f;

        if (configMode == ConfigMode.Size)
        {
            // Row 2: Mini & Med.
            if (GUI.Button(new Rect(panelX + pad, curY, gridBtnW, gridBtnH), "MINI\n220×315", btnStyle))
            {
                ResizeWindow(SizePresets[0].size);
                configOverlayOpen = false;
            }
            if (GUI.Button(new Rect(panelX + pad + gridBtnW + 6f, curY, gridBtnW, gridBtnH), "MED.\n450×600", btnStyle))
            {
                ResizeWindow(SizePresets[1].size);
                configOverlayOpen = false;
            }
            curY += gridBtnH + 6f;

            // Row 3: Large & Full
            if (GUI.Button(new Rect(panelX + pad, curY, gridBtnW, gridBtnH), "LARGE\n800×1000", btnStyle))
            {
                ResizeWindow(SizePresets[2].size);
                configOverlayOpen = false;
            }
            if (GUI.Button(new Rect(panelX + pad + gridBtnW + 6f, curY, gridBtnW, gridBtnH), "FULL\nWorkarea", btnStyle))
            {
                ApplyFullWorkarea();
                configOverlayOpen = false;
            }
        }
        else
        {
            // Position Mode: Corner Snap
            // Row 2: Top-Left (↖) & Top-Right (↗)
            if (GUI.Button(new Rect(panelX + pad, curY, gridBtnW, gridBtnH), "↖ TOP-L", btnStyle))
            {
                SnapToCorner(0);
                configOverlayOpen = false;
            }
            if (GUI.Button(new Rect(panelX + pad + gridBtnW + 6f, curY, gridBtnW, gridBtnH), "↗ TOP-R", btnStyle))
            {
                SnapToCorner(1);
                configOverlayOpen = false;
            }
            curY += gridBtnH + 6f;

            // Row 3: Bottom-Left (↙) & Bottom-Right (↘)
            if (GUI.Button(new Rect(panelX + pad, curY, gridBtnW, gridBtnH), "↙ BTM-L", btnStyle))
            {
                SnapToCorner(2);
                configOverlayOpen = false;
            }
            if (GUI.Button(new Rect(panelX + pad + gridBtnW + 6f, curY, gridBtnW, gridBtnH), "↘ BTM-R", btnStyle))
            {
                SnapToCorner(3);
                configOverlayOpen = false;
            }
        }

        curY += gridBtnH + 10f;

        // Row 4: Layer Visibility Toggles
        float row4BtnH = 34f;
        // Left: showBackground (BG: ON / OFF)
        string bgLabel = showBackground ? "BG: ON" : "BG: OFF";
        if (GUI.Button(new Rect(panelX + pad, curY, gridBtnW, row4BtnH), bgLabel, showBackground ? btnActiveStyle : btnStyle))
        {
            showBackground = !showBackground;
            if (windowController != null)
                windowController.isTransparent = !showBackground;
            if (orbitCamera != null)
                orbitCamera.backgroundColor = showBackground ? new Color(0.12f, 0.12f, 0.16f, 1f) : new Color(0f, 0f, 0f, 0f);
        }

        // Right: showModel (AVATAR: ON / OFF)
        string modelLabel = showModel ? "AVATAR: ON" : "AVATAR: OFF";
        if (GUI.Button(new Rect(panelX + pad + gridBtnW + 6f, curY, gridBtnW, row4BtnH), modelLabel, showModel ? btnActiveStyle : btnStyle))
        {
            showModel = !showModel;
            if (loadedModel != null)
                loadedModel.SetActive(showModel);
        }
    }

    private void SnapToCorner(int corner)
    {
        if (windowController == null)
            return;

        float sw = Screen.currentResolution.width > 0 ? Screen.currentResolution.width : Display.main.systemWidth;
        float sh = Screen.currentResolution.height > 0 ? Screen.currentResolution.height : Display.main.systemHeight;
        if (sw <= 0f) sw = 1920f;
        if (sh <= 0f) sh = 1080f;

        Vector2 ws = windowController.windowSize;
        float margin = 20f;
        Vector2 target = corner switch
        {
            0 => new Vector2(margin, margin), // Top-Left
            1 => new Vector2(sw - ws.x - margin, margin), // Top-Right
            2 => new Vector2(margin, sh - ws.y - margin), // Bottom-Left
            3 => new Vector2(sw - ws.x - margin, sh - ws.y - margin), // Bottom-Right
            _ => windowController.windowPosition,
        };
        windowController.windowPosition = target;
        Debug.Log($"[MateSidecar] snap to corner {corner} → ({target.x:0}, {target.y:0})");
    }

    private void ApplyFullWorkarea()
    {
        if (windowController == null)
            return;

        windowController.shouldFitMonitor = true;
        Debug.Log("[MateSidecar] applied fit to monitor full workarea");
    }

    private void ResizeWindow(Vector2 size)
    {
        if (windowController != null)
        {
            windowController.windowSize = size;
            Debug.Log($"[MateSidecar] resize window → {size.x:0}×{size.y:0}");
        }
        else
        {
            // Fallback: Screen.SetResolution when UniWindowController is unavailable.
            Screen.SetResolution(Mathf.RoundToInt(size.x), Mathf.RoundToInt(size.y), false);
            Debug.LogWarning($"[MateSidecar] UniWindowController missing; used Screen.SetResolution fallback ({size.x:0}×{size.y:0})");
        }
        SaveSize(size);
    }

    private static void SaveSize(Vector2 size)
    {
        PlayerPrefs.SetString(SizePrefKey, $"{Mathf.RoundToInt(size.x)}{SizePrefDelimiter}{Mathf.RoundToInt(size.y)}");
        PlayerPrefs.Save();
    }

    private static Vector2 LoadSavedSize()
    {
        var raw = PlayerPrefs.GetString(SizePrefKey, string.Empty);
        if (string.IsNullOrEmpty(raw))
            return new Vector2(450f, 600f); // default: medium

        var parts = raw.Split(SizePrefDelimiter);
        if (parts.Length == 2
            && int.TryParse(parts[0], out var w) && w > 0
            && int.TryParse(parts[1], out var h) && h > 0)
        {
            return new Vector2(w, h);
        }
        return new Vector2(450f, 600f);
    }

    [Serializable]
    private class WireAuthMessage
    {
        public string type;
        public WireAuthData data;
    }

    [Serializable]
    private class WireAuthData
    {
        public string token;
        public string caller;
        public string purpose;
    }

    [Serializable]
    private class WireAnnounceMessage
    {
        public string type;
        public WireAnnounceData data;
    }

    [Serializable]
    private class WireAnnounceData
    {
        public string name;
        public string caller;
        public string[] possibleEvents;
    }

    [Serializable]
    private class WireGenericMessage
    {
        public string type;
        public WireGenericData data;
    }

    [Serializable]
    private class ServerChannelConfigFile
    {
        public string hostname;
        public string authToken;
    }

    [Serializable]
    private class WireSyncWindowData
    {
        public float x;
        public float y;
        public float width;
        public float height;
        public bool alwaysOnTop;
    }

    [Serializable]
    private class WireSyncModelData
    {
        public string modelId;
        public string modelPath;
    }

    [Serializable]
    private class WireSyncPositionData
    {
        public float x;
        public float y;
        public float scale = 1f;
    }

    [Serializable]
    private class WireSyncViewportData
    {
        public string mode;
    }

    [Serializable]
    private class WireSyncStageData
    {
        public bool enabled;
    }

    [Serializable]
    private class WireGenericData
    {
        public string modelId;
        public string modelPath;
        public string[] idleAnimations;
        public string preset;
        public bool enabled;
        public float rms;
        public string name;
        public string expression;
        public float weight;
        public float durationMs;
        public bool authenticated;
        public string error;
        public float x;
        public float y;
        public float width;
        public float height;
        public float scale = 1f;
        public string mode;
        public WireSyncWindowData window;
        public WireSyncModelData model;
        public WireSyncPositionData positioning;
        public WireSyncPositionData position;
        public WireSyncViewportData viewport;
        public WireSyncStageData stage;
    }
}
