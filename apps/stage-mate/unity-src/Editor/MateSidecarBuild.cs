using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace StageMate.Editor
{
    public static class MateSidecarBuild
    {
        private const string ScenePath = "Assets/StageMate/MateSidecarScene.unity";
        private const string ControllerPath = "Assets/StageMate/StageMateIdleController.controller";
        private const string IdleClipsFolder = "Assets/MATE ENGINE - Animations/PET_IDLE";

        [MenuItem("AIRI/StageMate/1. Setup Scene & Catalog", false, 1)]
        public static void SetupSceneAndCatalog()
        {
            EnsureStageMateFolders();
            var controller = EnsureIdleController();
            var catalog = ScanIdleCatalog();
            CreateOrUpdateScene(controller, catalog);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"[MateSidecarBuild] Scene and Idle Catalog setup complete! Found {catalog.Count} idle clips.");
        }

        [MenuItem("AIRI/StageMate/2. Build Current Active Platform", false, 20)]
        public static void Build()
        {
            SetupSceneAndCatalog();

#if UNITY_STANDALONE_WIN
            BuildWindows();
#elif UNITY_STANDALONE_LINUX
            BuildLinux();
#elif UNITY_STANDALONE_OSX
            BuildMac();
#else
            BuildWindows();
#endif
        }

        [MenuItem("AIRI/StageMate/Build/Windows (x64 .exe)", false, 50)]
        public static void BuildWindows()
        {
            SetupSceneAndCatalog();
            string outDir = Path.GetFullPath(Path.Combine(Application.dataPath, "../Build/Windows"));
            if (!Directory.Exists(outDir))
                Directory.CreateDirectory(outDir);

            string exePath = Path.Combine(outDir, "StageMate.exe");

            BuildPlayerOptions opt = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = exePath,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None
            };

            Debug.Log($"[MateSidecarBuild] Starting Windows 64-bit build -> {exePath}");
            var report = BuildPipeline.BuildPlayer(opt);
            Debug.Log($"[MateSidecarBuild] Windows Build Result: {report.summary.result} ({report.summary.totalSize} bytes, {report.summary.totalTime.TotalSeconds:F1}s)");

            // Also copy to root Build/StageMate.exe for standard dev discovery
            try
            {
                string rootBuildDir = Path.GetFullPath(Path.Combine(Application.dataPath, "../Build"));
                string rootExe = Path.Combine(rootBuildDir, "StageMate.exe");
                if (File.Exists(exePath))
                {
                    File.Copy(exePath, rootExe, true);
                }
            }
            catch { }
        }

        [MenuItem("AIRI/StageMate/Build/Linux (x86_64)", false, 51)]
        public static void BuildLinux()
        {
            SetupSceneAndCatalog();
            string outDir = Path.GetFullPath(Path.Combine(Application.dataPath, "../Build/Linux"));
            if (!Directory.Exists(outDir))
                Directory.CreateDirectory(outDir);

            string binPath = Path.Combine(outDir, "StageMate.x86_64");

            BuildPlayerOptions opt = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = binPath,
                target = BuildTarget.StandaloneLinux64,
                options = BuildOptions.None
            };

            Debug.Log($"[MateSidecarBuild] Starting Linux 64-bit build -> {binPath}");
            var report = BuildPipeline.BuildPlayer(opt);
            Debug.Log($"[MateSidecarBuild] Linux Build Result: {report.summary.result} ({report.summary.totalSize} bytes, {report.summary.totalTime.TotalSeconds:F1}s)");
        }

        [MenuItem("AIRI/StageMate/Build/macOS (.app)", false, 52)]
        public static void BuildMac()
        {
            SetupSceneAndCatalog();
            string outDir = Path.GetFullPath(Path.Combine(Application.dataPath, "../Build"));
            if (!Directory.Exists(outDir))
                Directory.CreateDirectory(outDir);

            string appPath = Path.Combine(outDir, "StageMate.app");

            BuildPlayerOptions opt = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = appPath,
                target = BuildTarget.StandaloneOSX,
                options = BuildOptions.None
            };

            Debug.Log($"[MateSidecarBuild] Starting macOS Standalone build -> {appPath}");
            var report = BuildPipeline.BuildPlayer(opt);
            Debug.Log($"[MateSidecarBuild] macOS Build Result: {report.summary.result} ({report.summary.totalSize} bytes, {report.summary.totalTime.TotalSeconds:F1}s)");
        }

        [MenuItem("AIRI/StageMate/Build/All Platforms (Win + Linux + Mac)", false, 60)]
        public static void BuildAll()
        {
            Debug.Log("[MateSidecarBuild] Executing multi-platform batch build...");
            try { BuildWindows(); } catch (Exception e) { Debug.LogError($"Windows build failed: {e.Message}"); }
            try { BuildLinux(); } catch (Exception e) { Debug.LogError($"Linux build failed: {e.Message}"); }
            try { BuildMac(); } catch (Exception e) { Debug.LogError($"macOS build failed: {e.Message}"); }
        }

        private static void EnsureStageMateFolders()
        {
            if (!AssetDatabase.IsValidFolder("Assets/StageMate"))
                AssetDatabase.CreateFolder("Assets", "StageMate");
            if (!AssetDatabase.IsValidFolder("Assets/StageMate/Editor"))
                AssetDatabase.CreateFolder("Assets/StageMate", "Editor");
        }

        private static AnimatorController EnsureIdleController()
        {
            var controller = AssetDatabase.LoadAssetAtPath<AnimatorController>(ControllerPath);
            if (controller != null)
                return controller;

            controller = AnimatorController.CreateAnimatorControllerAtPath(ControllerPath);
            var rootStateMachine = controller.layers[0].stateMachine;

            // Create placeholder clips for IdleA and IdleB
            var clipA = new AnimationClip { name = "PlaceholderIdleA" };
            var clipB = new AnimationClip { name = "PlaceholderIdleB" };
            AssetDatabase.AddObjectToAsset(clipA, controller);
            AssetDatabase.AddObjectToAsset(clipB, controller);

            var stateA = rootStateMachine.AddState("IdleA");
            stateA.motion = clipA;

            var stateB = rootStateMachine.AddState("IdleB");
            stateB.motion = clipB;

            rootStateMachine.defaultState = stateA;
            AssetDatabase.SaveAssets();
            return controller;
        }

        private static List<IdleClipEntry> ScanIdleCatalog()
        {
            var catalog = new List<IdleClipEntry>();
            string[] guids = AssetDatabase.FindAssets("t:AnimationClip", new[] { IdleClipsFolder });

            foreach (string guid in guids)
            {
                string assetPath = AssetDatabase.GUIDToAssetPath(guid);
                var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(assetPath);
                if (clip != null)
                {
                    bool isLoop = clip.isLooping || clip.wrapMode == WrapMode.Loop;
                    catalog.Add(new IdleClipEntry
                    {
                        name = clip.name,
                        clip = clip,
                        loopTime = isLoop
                    });
                }
            }

            return catalog;
        }

        private static void CreateOrUpdateScene(AnimatorController controller, List<IdleClipEntry> catalog)
        {
            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 1. Camera Rig
            var camObj = new GameObject("StageMateCamera");
            var cam = camObj.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.Color;
            cam.backgroundColor = new Color(0.08f, 0.08f, 0.12f, 1f);
            cam.fieldOfView = 30f;
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 100f;
            camObj.transform.position = new Vector3(0f, 1.3f, -2.4f);
            camObj.transform.LookAt(new Vector3(0f, 1.1f, 0f));
            camObj.tag = "MainCamera";

            // 2. Directional Light
            var lightObj = new GameObject("Directional Light");
            var light = lightObj.AddComponent<Light>();
            light.type = LightType.Directional;
            light.color = Color.white;
            light.intensity = 1.2f;
            lightObj.transform.rotation = Quaternion.Euler(35f, -30f, 0f);

            // 3. Model Root
            var modelRootObj = new GameObject("ModelRoot");
            modelRootObj.transform.position = Vector3.zero;

            // 4. MateSidecar Manager
            var managerObj = new GameObject("StageMateManager");
            var sidecar = managerObj.AddComponent<MateSidecar>();
            sidecar.orbitCamera = cam;
            sidecar.modelRoot = modelRootObj.transform;
            sidecar.mainLight = light;
            sidecar.baseIdleController = controller;
            sidecar.idleCatalog = catalog;

            EditorSceneManager.SaveScene(scene, ScenePath);
        }
    }
}
