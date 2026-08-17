using System;
using UnityEngine;
using StageMate.Core;
using StageMate.Window;
using StageMate.Companion;
using StageMate.Models;

namespace StageMate.Viewport
{
    public class StageMateViewportController : MonoBehaviour
    {
        public enum ViewportMode
        {
            Tactile = 0,
            Drag = 1,
            Orbit = 2,
            Position = 3
        }

        public ViewportMode currentMode = ViewportMode.Tactile;

        public event Action<Vector3Dto, Vector3Dto, Vector3Dto> OnModelTransformChanged;

        [Header("Components")]
        public StageMateCameraRig cameraRig;
        public StageMateWindowManager windowManager;
        public StageMateTactileHandler tactileHandler;
        public StageMateLocomotion locomotion;
        public GameObject modelRoot;

        private Vector3 modelPosition = Vector3.zero;
        private Vector3 modelRotation = Vector3.zero;
        private Vector3 modelScale = Vector3.one;

        private bool isDragging;
        private Vector3 dragStartMouse;
        private Vector3 dragStartModelPos;

        public void SetMode(string modeStr)
        {
            switch (modeStr?.ToLowerInvariant())
            {
                case "drag":
                case "viewport-drag":
                    currentMode = ViewportMode.Drag;
                    break;
                case "orbit":
                case "viewport-orbit":
                    currentMode = ViewportMode.Orbit;
                    break;
                case "position":
                case "viewport-positioning":
                    currentMode = ViewportMode.Position;
                    break;
                default:
                    currentMode = ViewportMode.Tactile;
                    break;
            }

            if (tactileHandler != null)
                tactileHandler.enableTactile = (currentMode == ViewportMode.Tactile);
        }

        public void SetModelTransform(Vector3 pos, Vector3 rot, Vector3 scale)
        {
            modelPosition = pos;
            modelRotation = rot;
            if (scale != Vector3.zero) modelScale = scale;

            if (modelRoot != null)
            {
                modelRoot.transform.localPosition = modelPosition;
                modelRoot.transform.localRotation = Quaternion.Euler(modelRotation);
                modelRoot.transform.localScale = modelScale;
            }
        }

        private void Update()
        {
            HandleModeInputs();
        }

        private void HandleModeInputs()
        {
            switch (currentMode)
            {
                case ViewportMode.Tactile:
                    HandleTactileInputs();
                    break;
                case ViewportMode.Drag:
                    HandleDragInputs();
                    break;
                case ViewportMode.Orbit:
                    HandleOrbitInputs();
                    break;
                case ViewportMode.Position:
                    break;
            }
        }

        private void HandleTactileInputs()
        {
            if (Input.GetMouseButtonDown(0))
            {
                windowManager?.BeginWaistDrag();
            }
            else if (Input.GetMouseButton(0))
            {
                windowManager?.UpdateWaistDrag();
            }
            else if (Input.GetMouseButtonUp(0))
            {
                windowManager?.EndWaistDrag();
                locomotion?.TrySnapToWindow();
            }

            // Face zoom shortcut (Spacebar or Middle Click)
            if (Input.GetKeyDown(KeyCode.Space) || Input.GetMouseButtonDown(2))
            {
                cameraRig?.ToggleFaceZoom();
            }
        }

        private void HandleDragInputs()
        {
            if (Input.GetMouseButtonDown(0))
            {
                isDragging = true;
                dragStartMouse = Input.mousePosition;
                dragStartModelPos = modelPosition;
            }
            else if (Input.GetMouseButton(0) && isDragging)
            {
                Vector3 delta = Input.mousePosition - dragStartMouse;
                float worldFactor = 0.003f;
                modelPosition = dragStartModelPos + new Vector3(delta.x * worldFactor, delta.y * worldFactor, 0f);
                if (modelRoot != null)
                    modelRoot.transform.localPosition = modelPosition;
            }
            else if (Input.GetMouseButtonUp(0) && isDragging)
            {
                isDragging = false;
                OnModelTransformChanged?.Invoke(
                    Vector3Dto.FromVector3(modelPosition),
                    Vector3Dto.FromVector3(modelRotation),
                    Vector3Dto.FromVector3(modelScale)
                );
            }
        }

        private void HandleOrbitInputs()
        {
            if (Input.GetMouseButton(0))
            {
                float dx = Input.GetAxis("Mouse X") * 3f;
                float dy = Input.GetAxis("Mouse Y") * 3f;
                cameraRig?.SetOrbit(dy, dx, 0f);
            }

            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.01f)
            {
                cameraRig?.SetOrbit(0f, 0f, scroll * 2f);
            }
        }
    }
}
