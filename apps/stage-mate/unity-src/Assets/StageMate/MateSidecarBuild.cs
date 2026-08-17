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

        var camRig = new GameObject("CameraRig");
        camRig.transform.position = new Vector3(0f, 1.3f, 0f);

        var camGO = new GameObject("Main Camera");
        camGO.tag = "MainCamera";
        camGO.transform.SetParent(camRig.transform, false);
        camGO.transform.localPosition = new Vector3(0f, 0f, -3f);
        var cam = camGO.AddComponent<Camera>();
        cam.fieldOfView = 40f;
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0f, 0f, 0f, 0f);
        camGO.AddComponent<AudioListener>();

        var lightGO = new GameObject("Directional Light");
        var light = lightGO.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.2f;
        lightGO.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

        var sidecarGO = new GameObject("MateSidecar");
        var sidecar = sidecarGO.AddComponent<MateSidecar>();
        sidecar.fallbackModelPath = ResolveFallbackModelPath();
        sidecar.cameraRig = camRig.transform;
        sidecar.orbitCamera = cam;

        // Native window controller (Kirurobo/UniWindowController) for runtime resize and transparent pass-through hit-testing.
        var windowCtrlGO = new GameObject("UniWindowController");
        var windowCtrl = windowCtrlGO.AddComponent<UniWindowController>();
        windowCtrl.isTransparent = true;
        windowCtrl.isHitTestEnabled = true;
        windowCtrl.hitTestType = UniWindowController.HitTestType.Opacity;
        windowCtrl.opacityThreshold = 0.05f;
        windowCtrl.autoSwitchCameraBackground = true;
        windowCtrl.currentCamera = cam;
        sidecar.windowController = windowCtrl;

        var idle = EnsureIdleController();
        sidecar.idleCatalog = GatherIdleCatalog();
        sidecar.idleBaseController = idle.controller;
        sidecar.idlePlaceholderA = idle.placeholderA;
        sidecar.idlePlaceholderB = idle.placeholderB;

        EditorSceneManager.SaveScene(scene, ScenePath);
        Debug.Log($"[MateSidecarBuild] scene created: {ScenePath} (fallback model: '{sidecar.fallbackModelPath}', idle clips: {sidecar.idleCatalog.Length})");
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
