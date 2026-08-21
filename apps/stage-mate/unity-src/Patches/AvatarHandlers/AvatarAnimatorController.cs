using System;
using UnityEngine;
#if UNITY_STANDALONE_WIN
using NAudio.CoreAudioApi;
#endif
using System.Collections.Generic;
using System.Diagnostics;
using System.Collections;

public class AvatarAnimatorController : MonoBehaviour
{
    [Header("State Values")]
    public Animator animator;
    public float SOUND_THRESHOLD = 0.02f;
    public List<string> allowedApps = new();
    public int totalIdleAnimations = 10;
    public float IDLE_SWITCH_TIME = 12f, IDLE_TRANSITION_TIME = 3f;
    public int DANCE_CLIP_COUNT = 5;

    [Header("Dancing")]
    public bool enableDancing = true;           
    public bool enableDanceSwitch = true;
    public float DANCE_SWITCH_TIME = 15f;
    public float DANCE_TRANSITION_TIME = 2f;       

    public bool BlockDraggingOverride = false;

    private static readonly int danceIndexParam = Animator.StringToHash("DanceIndex");
    private static readonly int isIdleParam = Animator.StringToHash("isIdle");
    private static readonly int isDraggingParam = Animator.StringToHash("isDragging");
    private static readonly int isDancingParam = Animator.StringToHash("isDancing");
    private static readonly int idleIndexParam = Animator.StringToHash("IdleIndex");

#if UNITY_STANDALONE_WIN
    private MMDevice defaultDevice;
    private MMDeviceEnumerator enumerator;
#else
    private AudioClip micClip;
    private float[] micSamples = new float[256];
    private bool micInitialized = false;
#endif
    private Coroutine soundCheckCoroutine, idleTransitionCoroutine, danceTransitionCoroutine;
    private float lastSoundCheckTime, idleTimer, danceTimer;
    private int idleState, danceState;
    private float dragLockTimer;
    private bool mouseHeld;
    public bool isDragging, isDancing, isIdle;

    [Header("Character Mode")]
    public bool enableHusbandoMode = false;
    private static readonly int isMaleParam = Animator.StringToHash("isMale");
    private static readonly int isFemaleParam = Animator.StringToHash("isFemale");


    void OnEnable()
    {
        animator ??= GetComponent<Animator>();
        Application.runInBackground = true;
#if UNITY_STANDALONE_WIN
        try
        {
            enumerator = new MMDeviceEnumerator();
            defaultDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
        }
        catch { }
#else
        InitMacAudio();
#endif

        animator.SetFloat(isFemaleParam, enableHusbandoMode ? 0f : 1f);
        animator.SetFloat(isMaleParam, enableHusbandoMode ? 1f : 0f);

        soundCheckCoroutine = StartCoroutine(CheckSoundContinuously());
    }

    void OnDisable() => CleanupAudioResources();
    void OnDestroy() => CleanupAudioResources();
    void OnApplicationQuit() => CleanupAudioResources();

    IEnumerator CheckSoundContinuously()
    {
        var wait = new WaitForSeconds(1f);
        while (true) { CheckForSound(); yield return wait; }
    }

    void CheckForSound()
    {
        if (MenuActions.IsMovementBlocked() || !enableDancing)
        {
            if (isDancing) SetDancing(false);
            return;
        }

#if UNITY_STANDALONE_WIN
        if (defaultDevice == null) return;
#endif

        if (!isDragging)
        {
            bool valid = IsValidAppPlaying();
            if (valid && !isDancing) StartDancing();
            else if (!valid && isDancing) SetDancing(false);
        }
    }

    void StartDancing()
    {
        isDancing = true;
        danceTimer = 0f;
        danceState = UnityEngine.Random.Range(0, DANCE_CLIP_COUNT);
        animator.SetBool(isDancingParam, true);
        animator.SetFloat(danceIndexParam, danceState);
    }
    void SetDancing(bool value)
    {
        isDancing = value;
        animator.SetBool(isDancingParam, value);
        if (!value && danceTransitionCoroutine != null)
        {
            StopCoroutine(danceTransitionCoroutine);
            danceTransitionCoroutine = null;
        }
    }

#if !UNITY_STANDALONE_WIN
    void InitMacAudio()
    {
        if (micInitialized) return;
        try
        {
            if (Microphone.devices.Length > 0)
            {
                micClip = Microphone.Start(null, true, 10, 44100);
                micInitialized = true;
            }
        }
        catch { }
    }

    float GetMacAudioPeak()
    {
        if (!micInitialized || micClip == null) return 0f;
        try
        {
            int pos = Microphone.GetPosition(null) - 256;
            if (pos < 0) return 0f;
            if (micClip.GetData(micSamples, pos))
            {
                float max = 0f;
                for (int i = 0; i < 256; i++)
                {
                    float v = Mathf.Abs(micSamples[i]);
                    if (v > max) max = v;
                }
                return max;
            }
        }
        catch { }
        return 0f;
    }

    string RunAppleScript(string script)
    {
        try
        {
            using (var p = new Process())
            {
                p.StartInfo.FileName = "/usr/bin/osascript";
                p.StartInfo.Arguments = $"-e '{script}'";
                p.StartInfo.UseShellExecute = false;
                p.StartInfo.RedirectStandardOutput = true;
                p.StartInfo.CreateNoWindow = true;
                p.Start();
                string output = p.StandardOutput.ReadToEnd();
                p.WaitForExit(300);
                return output;
            }
        }
        catch { return null; }
    }

    bool IsMacMediaAppPlaying()
    {
        if (allowedApps == null || allowedApps.Count == 0) return false;
        try
        {
            for (int i = 0; i < allowedApps.Count; i++)
            {
                string app = allowedApps[i].ToLowerInvariant();
                if (app.Contains("spotify"))
                {
                    string res = RunAppleScript("tell application \"Spotify\" to if it is running then return (get player state as string)");
                    if (res != null && res.Trim().Equals("playing", StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
                else if (app.Contains("music") || app.Contains("itunes"))
                {
                    string res = RunAppleScript("tell application \"Music\" to if it is running then return (get player state as string)");
                    if (res != null && res.Trim().Equals("playing", StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }
        }
        catch { }
        return false;
    }

    bool IsAllowedAppRunning()
    {
        if (allowedApps == null || allowedApps.Count == 0) return true;
        try
        {
            var running = Process.GetProcesses();
            foreach (var p in running)
            {
                try
                {
                    string pname = p.ProcessName;
                    if (string.IsNullOrEmpty(pname)) continue;
                    for (int j = 0; j < allowedApps.Count; j++)
                    {
                        if (pname.StartsWith(allowedApps[j], System.StringComparison.OrdinalIgnoreCase))
                            return true;
                    }
                }
                catch { }
            }
        }
        catch { }
        return false;
    }
#endif

    bool IsValidAppPlaying()
    {
#if UNITY_STANDALONE_WIN
        if (Time.time - lastSoundCheckTime < 2f) return isDancing;
        lastSoundCheckTime = Time.time;
        try
        {
            defaultDevice?.Dispose();
            defaultDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
            var sessions = defaultDevice.AudioSessionManager.Sessions;
            for (int i = 0, count = sessions.Count; i < count; i++)
            {
                var s = sessions[i];
                if (s.AudioMeterInformation.MasterPeakValue > SOUND_THRESHOLD)
                {
                    int pid = (int)s.GetProcessID;
                    if (pid == 0) continue;
                    try
                    {
                        string pname = Process.GetProcessById(pid)?.ProcessName;
                        if (string.IsNullOrEmpty(pname)) continue;
                        for (int j = 0; j < allowedApps.Count; j++)
                            if (pname.StartsWith(allowedApps[j], System.StringComparison.OrdinalIgnoreCase)) return true;
                    }
                    catch { continue; }
                }
            }
        }
        catch { defaultDevice?.Dispose(); defaultDevice = null; }
        return false;
#else
        if (Time.time - lastSoundCheckTime < 1.5f) return isDancing;
        lastSoundCheckTime = Time.time;

        if (IsMacMediaAppPlaying())
        {
            return true;
        }

        InitMacAudio();

        if (IsAllowedAppRunning())
        {
            float peak = GetMacAudioPeak();
            return peak > SOUND_THRESHOLD;
        }
        return false;
#endif
    }

    private Vector2 dragGrabOffset;
    private bool isWindowDragging;

    void Update()
    {
        animator.SetFloat(isFemaleParam, enableHusbandoMode ? 0f : 1f);
        animator.SetFloat(isMaleParam, enableHusbandoMode ? 1f : 0f);

        if (BlockDraggingOverride || MenuActions.IsMovementBlocked() || TutorialMenu.IsActive)
        {
            if (isDragging) SetDragging(false);
            if (isDancing) SetDancing(false);
            isWindowDragging = false;
            return;
        }
        if (Input.GetMouseButtonDown(0))
        {
            if (IsMouseOverAvatar())
            {
                SetDragging(true);
                mouseHeld = true;
                dragLockTimer = 0.30f;
                SetDancing(false);

                if (Kirurobo.UniWindowController.current != null)
                {
                    isWindowDragging = true;
                    dragGrabOffset = Kirurobo.UniWindowController.current.windowPosition - Kirurobo.UniWindowController.current.cursorPosition;
                }
            }
        }
        if (Input.GetMouseButton(0) && isWindowDragging && Kirurobo.UniWindowController.current != null)
        {
            bool isSnapped = animator != null && (animator.GetBool("HideLeft") || animator.GetBool("HideRight") || animator.GetBool("isWindowSit") || animator.GetBool("isTaskbarSit"));
            if (!isSnapped)
            {
                Vector2 curCursor = Kirurobo.UniWindowController.current.cursorPosition;
                Kirurobo.UniWindowController.current.windowPosition = curCursor + dragGrabOffset;
            }
        }
        if (Input.GetMouseButtonUp(0))
        {
            mouseHeld = false;
            isWindowDragging = false;
        }
        if (dragLockTimer > 0f)
        {
            dragLockTimer -= Time.deltaTime;
            animator.SetBool(isDraggingParam, true);
        }
        else if (!mouseHeld && isDragging)
        {
            SetDragging(false);
            isWindowDragging = false;
        }

        idleTimer += Time.deltaTime;
        if (idleTimer > IDLE_SWITCH_TIME)
        {
            idleTimer = 0f;
            int next = (idleState + 1) % totalIdleAnimations;
            if (next == 0) animator.SetFloat(idleIndexParam, 0);
            else
            {
                if (idleTransitionCoroutine != null) StopCoroutine(idleTransitionCoroutine);
                idleTransitionCoroutine = StartCoroutine(SmoothIdleTransition(next));
            }
            idleState = next;
        }
        UpdateIdleStatus();

        if (isDancing && enableDanceSwitch)
        {
            danceTimer += Time.deltaTime;
            if (danceTimer > DANCE_SWITCH_TIME)
            {
                danceTimer = 0f;
                int nextDance = (danceState + 1) % DANCE_CLIP_COUNT;
                if (nextDance == 0) animator.SetFloat(danceIndexParam, 0);
                else
                {
                    if (danceTransitionCoroutine != null) StopCoroutine(danceTransitionCoroutine);
                    danceTransitionCoroutine = StartCoroutine(SmoothDanceTransition(nextDance));
                }
                danceState = nextDance;
            }
        }
    }
    void SetDragging(bool value)
    {
        isDragging = value;
        animator.SetBool(isDraggingParam, value);
    }

    void UpdateIdleStatus()
    {
        bool inIdle = animator.GetCurrentAnimatorStateInfo(0).IsName("Idle");
        if (isIdle != inIdle)
        {
            isIdle = inIdle;
            animator.SetBool(isIdleParam, isIdle);
        }
    }

    IEnumerator SmoothIdleTransition(int newIdle)
    {
        float elapsed = 0f, start = animator.GetFloat(idleIndexParam);
        while (elapsed < IDLE_TRANSITION_TIME)
        {
            elapsed += Time.deltaTime;
            animator.SetFloat(idleIndexParam, Mathf.Lerp(start, newIdle, elapsed / IDLE_TRANSITION_TIME));
            yield return null;
        }
        animator.SetFloat(idleIndexParam, newIdle);
    }

    IEnumerator SmoothDanceTransition(int newDance)
    {
        float elapsed = 0f, start = animator.GetFloat(danceIndexParam);
        while (elapsed < DANCE_TRANSITION_TIME)
        {
            elapsed += Time.deltaTime;
            animator.SetFloat(danceIndexParam, Mathf.Lerp(start, newDance, elapsed / DANCE_TRANSITION_TIME));
            yield return null;
        }
        animator.SetFloat(danceIndexParam, newDance);
    }

    public bool IsInIdleState() => isIdle;

    private bool IsMouseOverAvatar()
    {
        // If UniWindowController indicates we are on a transparent pixel, reject dragging
        if (Kirurobo.UniWindowController.current != null && Kirurobo.UniWindowController.current.isTransparent)
        {
            if (!Kirurobo.UniWindowController.current.isPointerOnObject)
                return false;
        }

        // Raycast to check if mouse actually clicked on an avatar model collider/mesh
        var cam = Camera.main;
        if (cam != null)
        {
            Ray ray = cam.ScreenPointToRay(Input.mousePosition);
            if (Physics.Raycast(ray, out RaycastHit hit, 100f))
            {
                if (hit.collider != null)
                {
                    // Ignore non-avatar ground shadow
                    if (hit.collider.gameObject.name.Equals("Shadow", System.StringComparison.OrdinalIgnoreCase))
                        return false;
                    return true;
                }
            }
        }

        if (Kirurobo.UniWindowController.current != null)
        {
            return Kirurobo.UniWindowController.current.isPointerOnObject;
        }

        return true;
    }

    void CleanupAudioResources()
    {
        if (soundCheckCoroutine != null) { StopCoroutine(soundCheckCoroutine); soundCheckCoroutine = null; }
        if (idleTransitionCoroutine != null) { StopCoroutine(idleTransitionCoroutine); idleTransitionCoroutine = null; }
        if (danceTransitionCoroutine != null) { StopCoroutine(danceTransitionCoroutine); danceTransitionCoroutine = null; }
#if UNITY_STANDALONE_WIN
        defaultDevice?.Dispose(); defaultDevice = null;
        enumerator?.Dispose(); enumerator = null;
#else
        if (micInitialized && micClip != null)
        {
            try { Microphone.End(null); } catch { }
            micClip = null;
            micInitialized = false;
        }
#endif
    }
}
