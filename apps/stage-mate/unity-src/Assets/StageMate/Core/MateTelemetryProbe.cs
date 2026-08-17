using System;
using UnityEngine;

namespace StageMate.Core
{
    public class MateTelemetryProbe : MonoBehaviour
    {
        private Kirurobo.UniWindowController uniwinc;
        private Animator activeAnimator;
        private Transform activeAvatarTransform;

        private Vector2 lastWinPos = Vector2.zero;
        private Vector2 lastWinSize = Vector2.zero;
        private Vector3 lastAvatarWorldPos = Vector3.zero;
        private Vector3 lastAvatarLocalPos = Vector3.zero;
        private bool lastFocus = true;

        private bool lastIsSitting = false;
        private bool lastIsWindowSit = false;
        private bool lastIsTaskbarSit = false;
        private bool lastIsDragging = false;
        private bool lastIsIdle = false;

        private static readonly int IsSittingHash = Animator.StringToHash("isSitting");
        private static readonly int IsWindowSitHash = Animator.StringToHash("isWindowSit");
        private static readonly int IsTaskbarSitHash = Animator.StringToHash("isTaskbarSit");
        private static readonly int IsDraggingHash = Animator.StringToHash("isDragging");
        private static readonly int IsIdleHash = Animator.StringToHash("isIdle");

        void Start()
        {
            uniwinc = FindFirstObjectByType<Kirurobo.UniWindowController>();
            RefreshReferences();
            Debug.Log("[TELEMETRY][INIT] MateTelemetryProbe attached and active.");
            LogFullState("STARTUP");
        }

        void OnApplicationFocus(bool focus)
        {
            lastFocus = focus;
            Debug.Log($"[TELEMETRY][FOCUS_EVENT] >>> Application focus changed to: {focus.ToString().ToUpper()} <<<");
            RefreshReferences();
            LogFullState(focus ? "FOCUS_GAINED" : "FOCUS_LOST");
        }

        void Update()
        {
            if (activeAvatarTransform == null || activeAnimator == null)
            {
                RefreshReferences();
            }

            // 1. Window Position Tracking
            if (uniwinc != null)
            {
                Vector2 wp = uniwinc.windowPosition;
                if ((wp - lastWinPos).sqrMagnitude > 0.5f)
                {
                    Debug.Log($"[TELEMETRY][WIN_POS] windowPosition moved: {lastWinPos} -> {wp} (delta: {wp - lastWinPos})");
                    lastWinPos = wp;
                }

                Vector2 ws = uniwinc.windowSize;
                if ((ws - lastWinSize).sqrMagnitude > 0.5f)
                {
                    Debug.Log($"[TELEMETRY][WIN_SIZE] windowSize changed: {lastWinSize} -> {ws} (delta: {ws - lastWinSize})");
                    lastWinSize = ws;
                }
            }

            // 2. Avatar Transform Tracking
            if (activeAvatarTransform != null)
            {
                Vector3 ap = activeAvatarTransform.position;
                if ((ap - lastAvatarWorldPos).sqrMagnitude > 0.0001f)
                {
                    Debug.Log($"[TELEMETRY][AVATAR_WORLD_POS] World pos: {lastAvatarWorldPos} -> {ap} (delta: {ap - lastAvatarWorldPos})");
                    lastAvatarWorldPos = ap;
                }

                Vector3 lp = activeAvatarTransform.localPosition;
                if ((lp - lastAvatarLocalPos).sqrMagnitude > 0.0001f)
                {
                    Debug.Log($"[TELEMETRY][AVATAR_LOCAL_POS] Local pos: {lastAvatarLocalPos} -> {lp} (delta: {lp - lastAvatarLocalPos})");
                    lastAvatarLocalPos = lp;
                }
            }

            // 3. Animator Parameter Tracking
            if (activeAnimator != null)
            {
                bool sit = HasParam(activeAnimator, "isSitting") && activeAnimator.GetBool(IsSittingHash);
                bool winSit = HasParam(activeAnimator, "isWindowSit") && activeAnimator.GetBool(IsWindowSitHash);
                bool taskSit = HasParam(activeAnimator, "isTaskbarSit") && activeAnimator.GetBool(IsTaskbarSitHash);
                bool drag = HasParam(activeAnimator, "isDragging") && activeAnimator.GetBool(IsDraggingHash);
                bool idle = HasParam(activeAnimator, "isIdle") && activeAnimator.GetBool(IsIdleHash);

                if (sit != lastIsSitting || winSit != lastIsWindowSit || taskSit != lastIsTaskbarSit || drag != lastIsDragging || idle != lastIsIdle)
                {
                    Debug.Log($"[TELEMETRY][ANIM_PARAM_CHANGE] sit: {lastIsSitting}->{sit} | winSit: {lastIsWindowSit}->{winSit} | taskSit: {lastIsTaskbarSit}->{taskSit} | drag: {lastIsDragging}->{drag} | idle: {lastIsIdle}->{idle}");
                    lastIsSitting = sit;
                    lastIsWindowSit = winSit;
                    lastIsTaskbarSit = taskSit;
                    lastIsDragging = drag;
                    lastIsIdle = idle;
                }
            }

            // 4. Mouse Button Tracking
            if (Input.GetMouseButtonDown(0))
            {
                Vector2 cp = uniwinc != null ? uniwinc.cursorPosition : (Vector2)Input.mousePosition;
                Debug.Log($"[TELEMETRY][INPUT] Mouse DOWN (0) at Cursor: {cp} | WinPos: {(uniwinc ? uniwinc.windowPosition : Vector2.zero)}");
            }
            if (Input.GetMouseButtonUp(0))
            {
                Vector2 cp = uniwinc != null ? uniwinc.cursorPosition : (Vector2)Input.mousePosition;
                Debug.Log($"[TELEMETRY][INPUT] Mouse UP (0) at Cursor: {cp} | WinPos: {(uniwinc ? uniwinc.windowPosition : Vector2.zero)}");
                LogFullState("MOUSE_RELEASE");
            }
        }

        private void RefreshReferences()
        {
            if (uniwinc == null) uniwinc = FindFirstObjectByType<Kirurobo.UniWindowController>();
            var anims = FindObjectsByType<Animator>(FindObjectsSortMode.None);
            foreach (var a in anims)
            {
                if (a.isHuman || a.gameObject.name.Contains("Model") || a.gameObject.name.Contains("Avatar") || a.gameObject.name.Contains("CustomVRM") || a.gameObject.name.Contains("Root"))
                {
                    activeAnimator = a;
                    activeAvatarTransform = a.transform;
                    break;
                }
            }
        }

        public void LogFullState(string triggerReason)
        {
            Vector2 wp = uniwinc != null ? uniwinc.windowPosition : Vector2.zero;
            Vector2 ws = uniwinc != null ? uniwinc.windowSize : Vector2.zero;
            Vector2 cp = uniwinc != null ? uniwinc.cursorPosition : (Vector2)Input.mousePosition;
            Vector3 ap = activeAvatarTransform != null ? activeAvatarTransform.position : Vector3.zero;
            Vector3 lp = activeAvatarTransform != null ? activeAvatarTransform.localPosition : Vector3.zero;
            string objName = activeAvatarTransform != null ? activeAvatarTransform.name : "null";

            string animInfo = "none";
            if (activeAnimator != null)
            {
                bool sit = HasParam(activeAnimator, "isSitting") && activeAnimator.GetBool(IsSittingHash);
                bool winSit = HasParam(activeAnimator, "isWindowSit") && activeAnimator.GetBool(IsWindowSitHash);
                bool taskSit = HasParam(activeAnimator, "isTaskbarSit") && activeAnimator.GetBool(IsTaskbarSitHash);
                bool drag = HasParam(activeAnimator, "isDragging") && activeAnimator.GetBool(IsDraggingHash);
                bool idle = HasParam(activeAnimator, "isIdle") && activeAnimator.GetBool(IsIdleHash);
                animInfo = $"sit={sit}, winSit={winSit}, taskSit={taskSit}, drag={drag}, idle={idle}";
            }

            Debug.Log($"[TELEMETRY][STATE_DUMP][{triggerReason}] Focus={lastFocus} | WinPos={wp} | WinSize={ws} | Cursor={cp} | AvatarTarget='{objName}' WorldPos={ap} LocalPos={lp} | Animator({animInfo})");
        }

        private bool HasParam(Animator anim, string paramName)
        {
            if (anim == null) return false;
            foreach (var p in anim.parameters)
            {
                if (p.name == paramName) return true;
            }
            return false;
        }
    }
}
