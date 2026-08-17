using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using UnityEngine;
using UniGLTF;
using VRM;
using UniVRM10;

namespace StageMate.Models
{
    public class VrmModelDriver : MonoBehaviour, IStageModelDriver
    {
        public bool IsLoaded => loadedModel != null;
        public GameObject ModelObject => loadedModel;
        public Transform HeadTransform => headBone;
        public Transform HipsTransform => hipsBone;
        public Transform LeftHandTransform => leftHandBone;
        public Transform RightHandTransform => rightHandBone;
        public bool IsChibiMode => isChibi;

        [Header("Chibi Scaling")]
        public Vector3 chibiArmatureScale = new Vector3(0.3f, 0.3f, 0.3f);
        public Vector3 chibiHeadScale = new Vector3(2.7f, 2.7f, 2.7f);
        public Vector3 chibiLegScale = new Vector3(0.6f, 0.6f, 0.6f);

        [Header("Idle Animation System")]
        public RuntimeAnimatorController idleBaseController;
        public AnimationClip idlePlaceholderA;
        public AnimationClip idlePlaceholderB;
        public MateSidecar.IdleClipEntry[] idleCatalog = Array.Empty<MateSidecar.IdleClipEntry>();

        private GameObject loadedModel;
        private RuntimeGltfInstance gltfInstance;
        private Animator animator;
        private AnimatorOverrideController overrideController;
        private VrmSwayDriver swayDriver;

        // Idle state machine
        private readonly List<MateSidecar.IdleClipEntry> idlePool = new List<MateSidecar.IdleClipEntry>();
        private string[] activeIdleKeys = Array.Empty<string>();
        private Coroutine idleCoroutine;
        private int activeIdleState = 0;
        private MateSidecar.IdleClipEntry currentIdleEntry;

        // VRM 0.x & 1.0 components
        private VRMBlendShapeProxy proxy0;
        private VRMLookAtHead lookAt0;
        private Vrm10Instance vrm10Instance;
        private Vrm10RuntimeExpression expr1;

        // Cached Bones
        private Transform headBone;
        private Transform hipsBone;
        private Transform leftHandBone;
        private Transform rightHandBone;
        private Transform leftUpperLegBone;
        private Transform rightUpperLegBone;
        private Transform armatureRoot;

        private bool isChibi;
        private Vector3 originalArmaturePosition;

        // Blendshape cache
        private readonly Dictionary<string, float> blendValues = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);

        private void Awake()
        {
            swayDriver = gameObject.AddComponent<VrmSwayDriver>();
        }

        public async Task<bool> LoadModelAsync(string filePath)
        {
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            {
                Debug.LogWarning($"[VrmModelDriver] Model file not found: {filePath}");
                return false;
            }

            try
            {
                UnloadModel();

                byte[] bytes = null;
                try
                {
                    bytes = File.ReadAllBytes(filePath);
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[VrmModelDriver] Failed to read file bytes: {ex.Message}");
                    return false;
                }

                GameObject model = null;
                RuntimeGltfInstance newGltfInstance = null;

                // 1. Try VRM 1.0
                try
                {
                    var glb = new GlbFileParser(filePath).Parse();
                    var vrm10Data = Vrm10Data.Parse(glb);
                    if (vrm10Data != null)
                    {
                        using var importer = new Vrm10Importer(vrm10Data);
                        var inst = await importer.LoadAsync(new ImmediateCaller());
                        if (inst != null && inst.Root != null)
                        {
                            model = inst.Root;
                            newGltfInstance = inst;
                            vrm10Instance = model.GetComponent<Vrm10Instance>();
                            expr1 = vrm10Instance?.Runtime?.Expression;
                            if (vrm10Instance != null && vrm10Instance.LookAtTarget != null)
                                vrm10Instance.LookAtTarget = null;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[VrmModelDriver] VRM 1.x parse failed ({ex.Message}), falling back to VRM 0.x");
                }

                // 2. Fallback to VRM 0.x
                if (model == null)
                {
                    try
                    {
                        var gltf = new GlbBinaryParser(bytes, filePath).Parse();
                        using var importer = new VRMImporterContext(new VRMData(gltf));
                        var inst = await importer.LoadAsync(new ImmediateCaller());
                        if (inst != null && inst.Root != null)
                        {
                            model = inst.Root;
                            newGltfInstance = inst;
                            proxy0 = model.GetComponent<VRMBlendShapeProxy>();
                            lookAt0 = model.GetComponent<VRMLookAtHead>();
                            if (lookAt0 != null)
                            {
                                lookAt0.Target = null;
                                lookAt0.enabled = false;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.LogError($"[VrmModelDriver] VRM 0.x load failed: {ex.Message}");
                    }
                }

                if (model == null)
                {
                    Debug.LogError($"[VrmModelDriver] Failed to load model: {filePath}");
                    return false;
                }

                loadedModel = model;
                gltfInstance = newGltfInstance;
                loadedModel.transform.SetParent(transform, false);
                loadedModel.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);

                EnableAllRenderers(loadedModel);
                var bounds = ComputeBounds(loadedModel);
                loadedModel.transform.localPosition = new Vector3(-bounds.center.x, 0f, -bounds.center.z);

                Debug.Log($"[VrmModelDriver] Successfully loaded VRM model: {filePath} (bounds: {bounds.size.x:F2}x{bounds.size.y:F2}x{bounds.size.z:F2})");

                SetupAnimator(loadedModel);
                CacheBones();
                swayDriver.BindBones(animator);

                ApplyIdleKeys(activeIdleKeys);

                return true;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[VrmModelDriver] Fatal error loading model: {ex}");
                return false;
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

        public void UnloadModel()
        {
            if (idleCoroutine != null)
            {
                StopCoroutine(idleCoroutine);
                idleCoroutine = null;
            }

            if (loadedModel != null)
            {
                Destroy(loadedModel);
                loadedModel = null;
            }
            try { gltfInstance?.Dispose(); } catch { }
            gltfInstance = null;
            vrm10Instance = null;
            proxy0 = null;
            lookAt0 = null;
            expr1 = null;
            headBone = null;
            hipsBone = null;
            leftHandBone = null;
            rightHandBone = null;
            isChibi = false;
        }

        public void SetPosition(Vector3 position, Quaternion rotation, Vector3 scale)
        {
            transform.localPosition = position;
            transform.localRotation = rotation;
            if (scale != Vector3.zero)
                transform.localScale = scale;
        }

        public void SetExpression(string expressionKey, float weight)
        {
            if (string.IsNullOrEmpty(expressionKey)) return;
            blendValues[expressionKey] = Mathf.Clamp01(weight);

            if (proxy0 != null)
            {
                if (Enum.TryParse<BlendShapePreset>(expressionKey, true, out var preset))
                {
                    proxy0.ImmediatelySetValue(BlendShapeKey.CreateFromPreset(preset), Mathf.Clamp01(weight));
                }
            }
            else if (expr1 != null)
            {
                string mapped = MapVrm10ExpressionName(expressionKey);
                foreach (var k in expr1.ExpressionKeys)
                {
                    if (string.Equals(k.Name, mapped, StringComparison.OrdinalIgnoreCase))
                    {
                        expr1.SetWeight(k, Mathf.Clamp01(weight));
                        break;
                    }
                }
            }
        }

        public void SetLipSync(float rms)
        {
            float mouthOpen = Mathf.Clamp01(rms * 4.0f);
            SetExpression("A", mouthOpen);
        }

        public void SetGazeTarget(Vector3 targetWorldPos, bool enableSaccades, float weight)
        {
            if (headBone == null) return;

            Vector3 dir = (targetWorldPos - headBone.position).normalized;
            if (dir != Vector3.zero)
            {
                Quaternion targetRot = Quaternion.LookRotation(dir, Vector3.up);
                headBone.rotation = Quaternion.Slerp(headBone.rotation, targetRot, Time.deltaTime * 5f * Mathf.Clamp01(weight));
            }
        }

        public void ToggleChibiMode()
        {
            if (armatureRoot == null || headBone == null) return;

            bool becomingChibi = !isChibi;
            armatureRoot.localScale = becomingChibi ? chibiArmatureScale : Vector3.one;
            headBone.localScale = becomingChibi ? chibiHeadScale : Vector3.one;
            if (leftUpperLegBone) leftUpperLegBone.localScale = becomingChibi ? chibiLegScale : Vector3.one;
            if (rightUpperLegBone) rightUpperLegBone.localScale = becomingChibi ? chibiLegScale : Vector3.one;

            isChibi = becomingChibi;
        }

        public void ResetPosture()
        {
            if (isChibi) ToggleChibiMode();
            transform.localPosition = Vector3.zero;
            transform.localRotation = Quaternion.identity;
        }

        public void ApplyIdleKeys(string[] keys)
        {
            activeIdleKeys = keys ?? Array.Empty<string>();

            idlePool.Clear();
            if (activeIdleKeys.Length > 0)
            {
                foreach (var key in activeIdleKeys)
                {
                    var entry = ResolveIdleClip(key);
                    if (entry != null)
                        idlePool.Add(entry);
                }
            }

            // If no specific keys matched, default to entire catalog
            if (idlePool.Count == 0 && idleCatalog != null && idleCatalog.Length > 0)
            {
                idlePool.AddRange(idleCatalog);
            }

            RestartIdleCycle();
        }

        private MateSidecar.IdleClipEntry ResolveIdleClip(string key)
        {
            if (string.IsNullOrEmpty(key) || idleCatalog == null)
                return null;

            foreach (var entry in idleCatalog)
            {
                if (string.Equals(entry.name, key, StringComparison.OrdinalIgnoreCase))
                    return entry;
            }
            return null;
        }

        private void SetupAnimator(GameObject model)
        {
            animator = model.GetComponentInChildren<Animator>();
            if (animator == null)
                animator = model.AddComponent<Animator>();

            if (idleBaseController != null)
            {
                overrideController = new AnimatorOverrideController(idleBaseController);
                animator.runtimeAnimatorController = overrideController;
                animator.applyRootMotion = false;
            }
        }

        private void RestartIdleCycle()
        {
            if (idleCoroutine != null)
                StopCoroutine(idleCoroutine);

            if (idlePool.Count > 0 && gameObject.activeInHierarchy)
                idleCoroutine = StartCoroutine(IdleCycle());
        }

        private IEnumerator IdleCycle()
        {
            while (idlePool.Count > 0)
            {
                var entry = PickNextIdle();
                if (entry == null || entry.clip == null)
                    yield break;

                bool single = (idlePool.Count == 1);
                currentIdleEntry = entry;

                activeIdleState = 1 - activeIdleState;
                string stateName = (activeIdleState == 0) ? "IdleA" : "IdleB";
                var placeholder = (activeIdleState == 0) ? idlePlaceholderA : idlePlaceholderB;

                if (overrideController != null && placeholder != null)
                    overrideController[placeholder] = entry.clip;

                if (animator != null)
                    animator.CrossFade(stateName, 0.8f);

                if (single && entry.loopTime)
                    yield break;

                yield return new WaitForSeconds(Mathf.Max(1.0f, entry.clip.length));
            }
        }

        private MateSidecar.IdleClipEntry PickNextIdle()
        {
            if (idlePool.Count == 0) return null;
            if (idlePool.Count == 1) return idlePool[0];

            var others = new List<MateSidecar.IdleClipEntry>();
            foreach (var e in idlePool)
            {
                if (currentIdleEntry == null || !string.Equals(e.name, currentIdleEntry.name, StringComparison.OrdinalIgnoreCase))
                    others.Add(e);
            }

            var pool = (others.Count > 0) ? others : idlePool;
            return pool[UnityEngine.Random.Range(0, pool.Count)];
        }

        private void CacheBones()
        {
            if (animator == null) return;
            headBone = animator.GetBoneTransform(HumanBodyBones.Head);
            hipsBone = animator.GetBoneTransform(HumanBodyBones.Hips);
            leftHandBone = animator.GetBoneTransform(HumanBodyBones.LeftHand);
            rightHandBone = animator.GetBoneTransform(HumanBodyBones.RightHand);
            leftUpperLegBone = animator.GetBoneTransform(HumanBodyBones.LeftUpperLeg);
            rightUpperLegBone = animator.GetBoneTransform(HumanBodyBones.RightUpperLeg);

            if (hipsBone != null)
            {
                armatureRoot = hipsBone;
                while (armatureRoot.parent != null && armatureRoot.parent != transform && armatureRoot.parent != loadedModel.transform)
                    armatureRoot = armatureRoot.parent;
                originalArmaturePosition = armatureRoot.localPosition;
            }
        }

        private string MapVrm10ExpressionName(string name)
        {
            switch (name.ToLowerInvariant())
            {
                case "a": return "aa";
                case "i": return "ih";
                case "u": return "ou";
                case "e": return "ee";
                case "o": return "oh";
                case "joy": return "happy";
                case "angry": return "angry";
                case "sorrow": return "sad";
                case "fun": return "relaxed";
                case "blink": return "blink";
                case "blink_l": return "blinkLeft";
                case "blink_r": return "blinkRight";
                default: return name;
            }
        }
    }
}
