using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using StageMate.Models;

namespace StageMate.Companion
{
    public class StageMateLocomotion : MonoBehaviour
    {
        [Header("Window Sitting Settings")]
        public float minDragHoldSecondsToSit = 1.0f;
        public float snapProbeRadiusPx = 24f;
        public float seatOffsetPx = 0f;
        public bool enableWindowSitting = true;

        [Header("Screen Edge Peeking")]
        public float edgeSnapMarginPx = 16f;
        public bool enableEdgePeeking = true;

        [Header("Gravity")]
        public float gravitySpeed = 9.8f;
        public bool isFalling;

        public bool IsSitting => isSitting;
        public int SitPoseIndex => sitPoseIndex;

        private IStageModelDriver modelDriver;
        private bool isSitting;
        private int sitPoseIndex; // 0 = dangle legs, 1 = lie kicking heels
        private IntPtr snappedHwnd = IntPtr.Zero;
        private float dragHoldTimer;

#if UNITY_STANDALONE_WIN
        [StructLayout(LayoutKind.Sequential)]
        struct RECT { public int Left, Top, Right, Bottom; }

        [StructLayout(LayoutKind.Sequential)]
        struct POINT { public int X, Y; }

        [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT lpPoint);
        [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
        [DllImport("user32.dll")] static extern int GetSystemMetrics(int nIndex);
#endif

        public void BindModelDriver(IStageModelDriver driver)
        {
            modelDriver = driver;
        }

        public void TrySnapToWindow()
        {
#if UNITY_STANDALONE_WIN
            if (!enableWindowSitting) return;

            IntPtr fg = GetForegroundWindow();
            if (fg == IntPtr.Zero) return;

            if (GetWindowRect(fg, out var rect))
            {
                GetCursorPos(out var pt);
                // Check if cursor is near window top bar
                if (Mathf.Abs(pt.Y - rect.Top) < snapProbeRadiusPx && pt.X >= rect.Left && pt.X <= rect.Right)
                {
                    snappedHwnd = fg;
                    isSitting = true;
                    sitPoseIndex = UnityEngine.Random.Range(0, 2);
                    Debug.Log($"[StageMateLocomotion] Snapped to window {fg} in pose {sitPoseIndex}!");
                }
            }
#endif
        }

        public void Unsnap()
        {
            snappedHwnd = IntPtr.Zero;
            isSitting = false;
        }

        public void ToggleSitPose()
        {
            sitPoseIndex = (sitPoseIndex + 1) % 2;
        }

        private void Update()
        {
            if (isSitting && snappedHwnd != IntPtr.Zero)
            {
#if UNITY_STANDALONE_WIN
                if (IsIconic(snappedHwnd))
                {
                    // Window was minimized! Trigger gravity drop!
                    Unsnap();
                    isFalling = true;
                }
#endif
            }

            if (isFalling)
            {
                transform.position += Vector3.down * gravitySpeed * Time.deltaTime;
                if (transform.position.y <= -1.0f)
                {
                    isFalling = false;
                    transform.position = new Vector3(transform.position.x, -1.0f, transform.position.z);
                }
            }
        }
    }
}
