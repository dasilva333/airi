using System.Collections;
using UnityEngine;

namespace StageMate.Viewport
{
    public class StageMateCameraRig : MonoBehaviour
    {
        public Camera rigCamera;
        public float pitch = 10f;
        public float yaw = 0f;
        public float distance = 3.0f;
        public Vector3 targetCenter = new Vector3(0f, 0.9f, 0f);

        [Header("Face Zoom Settings")]
        public Vector3 faceTargetOffset = new Vector3(0f, 1.35f, 0f);
        public float faceZoomDistance = 1.0f;
        public float zoomTransitionSpeed = 5.0f;

        public bool IsFaceZoomed => isFaceZoomed;

        private bool isFaceZoomed;
        private Vector3 currentLookAt;
        private float currentDistance;

        private void Awake()
        {
            if (rigCamera == null) rigCamera = GetComponentInChildren<Camera>();
            currentLookAt = targetCenter;
            currentDistance = distance;
            ApplyFraming();
        }

        private void LateUpdate()
        {
            Vector3 targetLookAt = isFaceZoomed ? (targetCenter + faceTargetOffset) : targetCenter;
            float targetDist = isFaceZoomed ? faceZoomDistance : distance;

            currentLookAt = Vector3.Lerp(currentLookAt, targetLookAt, Time.deltaTime * zoomTransitionSpeed);
            currentDistance = Mathf.Lerp(currentDistance, targetDist, Time.deltaTime * zoomTransitionSpeed);

            ApplyFraming();
        }

        public void ToggleFaceZoom()
        {
            isFaceZoomed = !isFaceZoomed;
        }

        public void SetOrbit(float deltaPitch, float deltaYaw, float deltaZoom)
        {
            pitch = Mathf.Clamp(pitch - deltaPitch, -45f, 85f);
            yaw = (yaw + deltaYaw) % 360f;
            distance = Mathf.Clamp(distance - deltaZoom, 0.5f, 10f);
        }

        public void ResetCamera()
        {
            pitch = 10f;
            yaw = 0f;
            distance = 3.0f;
            isFaceZoomed = false;
        }

        public void SetTransparentClear(bool transparent)
        {
            if (rigCamera == null) return;
            rigCamera.clearFlags = CameraClearFlags.SolidColor;
            rigCamera.backgroundColor = transparent ? new Color(0, 0, 0, 0) : new Color(0.12f, 0.12f, 0.16f, 1.0f);
        }

        private void ApplyFraming()
        {
            if (rigCamera == null) return;
            Quaternion rot = Quaternion.Euler(pitch, yaw, 0f);
            Vector3 offset = rot * new Vector3(0f, 0f, -currentDistance);
            rigCamera.transform.position = currentLookAt + offset;
            rigCamera.transform.LookAt(currentLookAt);
        }
    }
}
