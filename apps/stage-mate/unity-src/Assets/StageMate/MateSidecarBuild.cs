#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using Kirurobo;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

public static class MateSidecarBuild
{
    private const string ScenePath = "Assets/StageMate/MateSidecarScene.unity";
    private const string BuildDir = "Build/StageMate";
    private const string IdleControllerPath = "Assets/StageMate/StageMateIdleController.controller";
    private const string PlaceholderAPath = "Assets/StageMate/StageMateIdleA.anim";
    private const string PlaceholderBPath = "Assets/StageMate/StageMateIdleB.anim";
    private const string IdleClipFolder = "Assets/MATE ENGINE - Animations/PET_IDLE";

    public static void Build()
    {
        BuildMac();
    }

    public static void BuildMac()
    {
        CreateScene();
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

        Directory.CreateDirectory(BuildDir);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = Path.Combine(BuildDir, "StageMate.app"),
            target = BuildTarget.StandaloneOSX,
            options = BuildOptions.None,
        });

        if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            Debug.Log($"[MateSidecarBuild] build succeeded: {BuildDir}");
        else
            Debug.LogError($"[MateSidecarBuild] build failed: {report.summary.result}");
    }

    public static void BuildWindows()
    {
        CreateScene();
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

        var winDir = "Build/Windows";
        Directory.CreateDirectory(winDir);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = Path.Combine(winDir, "StageMate.exe"),
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None,
        });

        if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            Debug.Log($"[MateSidecarBuild] windows build succeeded: {winDir}");
        else
            Debug.LogError($"[MateSidecarBuild] windows build failed: {report.summary.result}");
    }

    public static void BuildOriginalWindows()
    {
        var mainScene = "Assets/MATE ENGINE - Scenes/Mate Engine Main.unity";
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(mainScene, true) };

        var outDir = "Build/MateEngineMain";
        Directory.CreateDirectory(outDir);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { mainScene },
            locationPathName = Path.Combine(outDir, "MateEngineX.exe"),
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None,
        });

        if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            Debug.Log($"[MateSidecarBuild] original mate engine build succeeded: {outDir}");
        else
            Debug.LogError($"[MateSidecarBuild] original mate engine build failed: {report.summary.result}");
    }

    public static void BuildLinux()
    {
        CreateScene();
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

        var linuxDir = "Build/Linux";
        Directory.CreateDirectory(linuxDir);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = Path.Combine(linuxDir, "StageMate.x86_64"),
            target = BuildTarget.StandaloneLinux64,
            options = BuildOptions.None,
        });

        if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            Debug.Log($"[MateSidecarBuild] linux build succeeded: {linuxDir}");
        else
            Debug.LogError($"[MateSidecarBuild] linux build failed: {report.summary.result}");
    }

    public static void BuildAll()
    {
        BuildMac();
    }

    private static void CreateScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // 1. Camera Rig & Face Zoom
        var camRig = new GameObject("CameraRig");
        camRig.transform.position = new Vector3(0f, 1.3f, 0f);
        var cameraRigComponent = camRig.AddComponent<StageMate.Viewport.StageMateCameraRig>();

        var camGO = new GameObject("Main Camera");
        camGO.tag = "MainCamera";
        camGO.transform.SetParent(camRig.transform, false);
        camGO.transform.localPosition = new Vector3(0f, 0f, -3f);
        var cam = camGO.AddComponent<Camera>();
        cam.fieldOfView = 40f;
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0f, 0f, 0f, 0f);
        camGO.AddComponent<AudioListener>();
        cameraRigComponent.rigCamera = cam;

        // 2. Directional Light & Shadow Projector Rig
        var lightGO = new GameObject("Directional Light");
        var light = lightGO.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.2f;
        lightGO.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

        var shadowRigGO = new GameObject("ShadowRig");
        var shadowRig = shadowRigGO.AddComponent<StageMate.Window.StageMateShadowRig>();

        // 3. Model Root & VRM Drivers
        var modelRootGO = new GameObject("ModelRoot");
        var vrmDriver = modelRootGO.AddComponent<StageMate.Models.VrmModelDriver>();

        // 4. Companion Systems (Tactile, Locomotion, Macaron Bed)
        var companionGO = new GameObject("CompanionSystems");
        var tactileHandler = companionGO.AddComponent<StageMate.Companion.StageMateTactileHandler>();
        var locomotion = companionGO.AddComponent<StageMate.Companion.StageMateLocomotion>();
        var plushBed = companionGO.AddComponent<StageMate.Companion.StageMatePlushBed>();

        // 5. Window Manager & Native Transparency
        var windowCtrlGO = new GameObject("UniWindowController");
        var windowCtrl = windowCtrlGO.AddComponent<UniWindowController>();
        windowCtrl.isTransparent = true;
        windowCtrl.isHitTestEnabled = true;
        windowCtrl.hitTestType = UniWindowController.HitTestType.Opacity;
        windowCtrl.opacityThreshold = 0.05f;
        windowCtrl.autoSwitchCameraBackground = true;
        windowCtrl.currentCamera = cam;

        var windowManager = windowCtrlGO.AddComponent<StageMate.Window.StageMateWindowManager>();
        windowManager.windowController = windowCtrl;

        // 6. Viewport Controller
        var viewportGO = new GameObject("ViewportController");
        var viewportCtrl = viewportGO.AddComponent<StageMate.Viewport.StageMateViewportController>();
        viewportCtrl.cameraRig = cameraRigComponent;
        viewportCtrl.windowManager = windowManager;
        viewportCtrl.tactileHandler = tactileHandler;
        viewportCtrl.locomotion = locomotion;
        viewportCtrl.modelRoot = modelRootGO;

        // 7. Core Socket & State Sync Dispatcher
        var coreGO = new GameObject("StageMateCore");
        var socket = coreGO.AddComponent<StageMate.Core.StageMateSocket>();
        var stateSync = coreGO.AddComponent<StageMate.Core.StageMateStateSync>();
        stateSync.socket = socket;
        stateSync.windowManager = windowManager;
        stateSync.viewportController = viewportCtrl;
        stateSync.cameraRig = cameraRigComponent;
        stateSync.tactileHandler = tactileHandler;
        stateSync.locomotion = locomotion;
        stateSync.plushBed = plushBed;
        stateSync.vrmDriver = vrmDriver;

        // 8. Backward-compatible MateSidecar Coordinator
        var sidecarGO = new GameObject("MateSidecar");
        var sidecar = sidecarGO.AddComponent<MateSidecar>();
        sidecar.fallbackModelPath = ResolveFallbackModelPath();
        sidecar.cameraRig = camRig.transform;
        sidecar.orbitCamera = cam;
        sidecar.windowController = windowCtrl;

        var idle = EnsureIdleController();
        sidecar.idleCatalog = GatherIdleCatalog();
        sidecar.idleBaseController = idle.controller;
        sidecar.idlePlaceholderA = idle.placeholderA;
        sidecar.idlePlaceholderB = idle.placeholderB;

        EditorSceneManager.SaveScene(scene, ScenePath);
        Debug.Log($"[MateSidecarBuild] modular scene created: {ScenePath} (fallback model: '{sidecar.fallbackModelPath}')");
    }

    private static (AnimatorController controller, AnimationClip placeholderA, AnimationClip placeholderB) EnsureIdleController()
    {
        var controller = AssetDatabase.LoadAssetAtPath<AnimatorController>(IdleControllerPath);
        var placeholderA = AssetDatabase.LoadAssetAtPath<AnimationClip>(PlaceholderAPath);
        var placeholderB = AssetDatabase.LoadAssetAtPath<AnimationClip>(PlaceholderBPath);

        if (controller == null)
        {
            Directory.CreateDirectory("Assets/StageMate");
            controller = AnimatorController.CreateAnimatorControllerAtPath(IdleControllerPath);
        }
        if (placeholderA == null)
        {
            placeholderA = new AnimationClip { name = "StageMateIdleA" };
            AssetDatabase.CreateAsset(placeholderA, PlaceholderAPath);
        }
        if (placeholderB == null)
        {
            placeholderB = new AnimationClip { name = "StageMateIdleB" };
            AssetDatabase.CreateAsset(placeholderB, PlaceholderBPath);
        }

        controller.name = "StageMateIdleController";
        controller.layers[0].name = "Idle Layer";

        var sm = controller.layers[0].stateMachine;
        EnsureState(sm, "IdleA", placeholderA, new Vector3(220f, 80f, 0f));
        EnsureState(sm, "IdleB", placeholderB, new Vector3(460f, 80f, 0f));

        AssetDatabase.SaveAssets();
        return (controller, placeholderA, placeholderB);
    }

    private static void EnsureState(AnimatorStateMachine sm, string name, AnimationClip placeholder, Vector3 position)
    {
        foreach (var existing in sm.states)
        {
            if (existing.state.name == name)
            {
                existing.state.motion = placeholder;
                return;
            }
        }
        var state = sm.AddState(name, position);
        state.motion = placeholder;
    }

    private static MateSidecar.IdleClipEntry[] GatherIdleCatalog()
    {
        var guids = AssetDatabase.FindAssets("t:AnimationClip", new[] { IdleClipFolder });
        var entries = new List<MateSidecar.IdleClipEntry>();
        foreach (var guid in guids)
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(path);
            if (clip == null)
                continue;
            var settings = AnimationUtility.GetAnimationClipSettings(clip);
            entries.Add(new MateSidecar.IdleClipEntry { name = clip.name, clip = clip, loopTime = settings.loopTime });
        }
        entries.Sort((a, b) => string.CompareOrdinal(a.name, b.name));
        return entries.ToArray();
    }

    private static string ResolveFallbackModelPath()
    {
        var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        var candidate = Path.GetFullPath(Path.Combine(projectRoot, "..", "test-model.vrm"));
        return File.Exists(candidate) ? candidate : "";
    }
}
#endif
