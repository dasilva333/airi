using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using Kirurobo;

namespace StageMate.Core
{
    /// <summary>
    /// Live diagnostic telemetry probe for observing macOS Cocoa window state,
    /// mouse coordinates, physics/UI raycasts, static interaction lockouts,
    /// and Unity input events in real time.
    /// </summary>
    public sealed class MateTelemetryProbe : MonoBehaviour
    {
        private UniWindowController winCtrl;
        private Camera mainCam;
        private AvatarAnimatorController animCtrl;

        private float lastLogTime = 0f;
        private bool lastClickThrough = false;

        private readonly List<RaycastResult> uiRaycastResults = new List<RaycastResult>();
        private PointerEventData pointerData;

        private void Awake()
        {
            winCtrl = GetComponent<UniWindowController>() ?? FindFirstObjectByType<UniWindowController>();
            mainCam = Camera.main ?? FindFirstObjectByType<Camera>();
            animCtrl = FindFirstObjectByType<AvatarAnimatorController>();
            Debug.Log("[MateTelemetryProbe] Initialized diagnostic probe with static lockout gates.");
        }

        private void Update()
        {
            if (mainCam == null) mainCam = Camera.main ?? FindFirstObjectByType<Camera>();
            if (animCtrl == null) animCtrl = FindFirstObjectByType<AvatarAnimatorController>();
            if (winCtrl == null) winCtrl = FindFirstObjectByType<UniWindowController>();

            Vector2 unityMouse = Input.mousePosition;
            Vector2 osMouse = UniWindowController.GetCursorPosition();

            bool leftDown = Input.GetMouseButtonDown(0);
            bool rightDown = Input.GetMouseButtonDown(1);
            bool middleDown = Input.GetMouseButtonDown(2);
            bool f1Down = Input.GetKeyDown(KeyCode.F1);
            bool leftUp = Input.GetMouseButtonUp(0);
            bool rightUp = Input.GetMouseButtonUp(1);

            bool curClickThrough = winCtrl != null && winCtrl.isClickThrough;

            // Log immediately on clicks or hotkeys
            if (leftDown || rightDown || middleDown || f1Down || leftUp || rightUp)
            {
                LogClickEvent(leftDown, rightDown, middleDown, f1Down, leftUp, rightUp, unityMouse, osMouse, curClickThrough);
            }

            // Periodic probe every 1.0s or when clickThrough state changes
            if (Time.unscaledTime - lastLogTime > 1.0f || curClickThrough != lastClickThrough)
            {
                lastLogTime = Time.unscaledTime;
                lastClickThrough = curClickThrough;

                LogPeriodicState(unityMouse, osMouse, curClickThrough);
            }
        }

        private void LogClickEvent(bool lDown, bool rDown, bool mDown, bool f1, bool lUp, bool rUp, Vector2 unityMouse, Vector2 osMouse, bool clickThrough)
        {
            string clickType = "";
            if (lDown) clickType += "[MOUSE_0_DOWN (Left)] ";
            if (rDown) clickType += "[MOUSE_1_DOWN (Right)] ";
            if (mDown) clickType += "[MOUSE_2_DOWN (Middle)] ";
            if (f1) clickType += "[KEY_F1] ";
            if (lUp) clickType += "[MOUSE_0_UP] ";
            if (rUp) clickType += "[MOUSE_1_UP] ";

            string hit3d = Probe3DHit(unityMouse);
            string uiHits = ProbeUIHits(unityMouse);
            string gates = ProbeGates();

            Debug.Log($"[MateTelemetryProbe:CLICK] {clickType}UnityPos=({unityMouse.x:F1}, {unityMouse.y:F1}) | OSPos=({osMouse.x:F1}, {osMouse.y:F1}) | clickThrough={clickThrough} | 3DHit={hit3d} | UIHits=[{uiHits}] | Dragging={(animCtrl != null && animCtrl.isDragging)} | Gates=[{gates}]");
        }

        private void LogPeriodicState(Vector2 unityMouse, Vector2 osMouse, bool clickThrough)
        {
            string hit3d = Probe3DHit(unityMouse);
            string uiHits = ProbeUIHits(unityMouse);
            string gates = ProbeGates();
            Vector2 winPos = winCtrl != null ? winCtrl.windowPosition : Vector2.zero;
            Vector2 winSize = winCtrl != null ? winCtrl.windowSize : Vector2.zero;

            Debug.Log($"[MateTelemetryProbe:STATE] UnityMouse=({unityMouse.x:F1}, {unityMouse.y:F1}) | OSPos=({osMouse.x:F1}, {osMouse.y:F1}) | WinPos=({winPos.x:F1}, {winPos.y:F1}) | WinSize=({winSize.x:F1}, {winSize.y:F1}) | Screen=({Screen.width}x{Screen.height}) | clickThrough={clickThrough} | 3DHit={hit3d} | UIHits=[{uiHits}] | Dragging={(animCtrl != null && animCtrl.isDragging)} | Gates=[{gates}]");
        }

        private string ProbeGates()
        {
            bool tutDone = SaveLoadHandler.Instance != null && SaveLoadHandler.Instance.data != null && SaveLoadHandler.Instance.data.tutorialDone;
            bool tutActive = TutorialMenu.IsActive;
            bool moveBlocked = MenuActions.IsMovementBlocked();
            bool blockOverride = animCtrl != null && animCtrl.BlockDraggingOverride;
            bool hasEventSys = EventSystem.current != null && EventSystem.current.isActiveAndEnabled;

            var blockingNames = new List<string>();
            var allMenuActions = Resources.FindObjectsOfTypeAll<MenuActions>();
            foreach (var ma in allMenuActions)
            {
                if (ma.menuEntries == null) continue;
                foreach (var entry in ma.menuEntries)
                {
                    if (entry.menu != null && entry.menu.activeInHierarchy && entry.blockMovement)
                    {
                        blockingNames.Add($"{entry.menu.name}(GO_Active:{entry.menu.activeSelf})");
                    }
                }
            }

            string blockList = blockingNames.Count > 0 ? string.Join("+", blockingNames) : "None";
            return $"TutDone:{tutDone}, TutActive:{tutActive}, MoveBlocked:{moveBlocked}({blockList}), BlockOverride:{blockOverride}, EventSysActive:{hasEventSys}";
        }

        private string Probe3DHit(Vector2 mousePos)
        {
            if (mainCam == null || !mainCam.isActiveAndEnabled) return "NoCamera";

            Ray ray = mainCam.ScreenPointToRay(mousePos);
            if (Physics.Raycast(ray, out RaycastHit hit, 100f))
            {
                return $"{hit.collider.gameObject.name} (Layer:{LayerMask.LayerToName(hit.collider.gameObject.layer)})";
            }
            return "None";
        }

        private string ProbeUIHits(Vector2 mousePos)
        {
            if (EventSystem.current == null) return "NoEventSystem";

            if (pointerData == null) pointerData = new PointerEventData(EventSystem.current);
            pointerData.position = mousePos;

            uiRaycastResults.Clear();
            EventSystem.current.RaycastAll(pointerData, uiRaycastResults);

            if (uiRaycastResults.Count == 0) return "None";

            var names = new List<string>();
            for (int i = 0; i < Math.Min(uiRaycastResults.Count, 3); i++)
            {
                var r = uiRaycastResults[i];
                names.Add($"{r.gameObject.name}(Layer:{LayerMask.LayerToName(r.gameObject.layer)})");
            }
            return string.Join(", ", names);
        }
    }
}
