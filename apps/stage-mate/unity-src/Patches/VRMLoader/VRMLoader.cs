using System.IO;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;
using VRM;
using UniGLTF;
using SFB;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UniVRM10;
using System;
using Newtonsoft.Json;

#if UNITY_EDITOR
using UnityEditor;
#endif

public class VRMLoader : MonoBehaviour
{
    public Button loadVRMButton;
    public GameObject mainModel;
    public GameObject customModelOutput;
    public RuntimeAnimatorController animatorController;
    public GameObject componentTemplatePrefab;

    private GameObject currentModel;
    private bool isLoading = false;
    private const string LegacyModelPathKey = "SavedPathModel";
    private RuntimeGltfInstance currentGltf;
    private AssetBundle currentBundle;

    void Start()
    {
        string savedPath = SaveLoadHandler.Instance != null
            ? SaveLoadHandler.Instance.data.selectedModelPath
            : null;

        if (string.IsNullOrEmpty(savedPath) && PlayerPrefs.HasKey(LegacyModelPathKey))
        {
            savedPath = PlayerPrefs.GetString(LegacyModelPathKey);
            if (SaveLoadHandler.Instance != null)
            {
                SaveLoadHandler.Instance.data.selectedModelPath = savedPath;
                SaveLoadHandler.Instance.SaveToDisk();
            }
            PlayerPrefs.DeleteKey(LegacyModelPathKey);
            PlayerPrefs.Save();
        }
        if (SaveLoadHandler.Instance != null && SaveLoadHandler.Instance.data.enableRandomAvatar)
        {
            TryLoadRandomAvatar();
            return;
        }
        if (!string.IsNullOrEmpty(savedPath))
            LoadVRM(savedPath);
    }
    private void TryLoadRandomAvatar()
    {
        var options = new System.Collections.Generic.List<string>();
        if (mainModel != null) options.Add("__DEFAULT__");

        var lib = FindFirstObjectByType<AvatarLibraryMenu>();
        if (lib != null && lib.dlcAvatars != null)
        {
            for (int i = 0; i < lib.dlcAvatars.Count; i++)
            {
                var p = lib.dlcAvatars[i]?.prefab;
                if (p != null) options.Add(p.name);
            }
        }

        try
        {
            string avatarsPath = System.IO.Path.Combine(Application.persistentDataPath, "avatars.json");
            if (System.IO.File.Exists(avatarsPath))
            {
                var entries = JsonConvert.DeserializeObject<System.Collections.Generic.List<AvatarLibraryMenu.AvatarEntry>>(System.IO.File.ReadAllText(avatarsPath));
                if (entries != null)
                {
                    for (int i = 0; i < entries.Count; i++)
                    {
                        var fp = entries[i].filePath;
                        if (!string.IsNullOrEmpty(fp)) options.Add(fp);
                    }
                }
            }
        }
        catch { }

        if (options.Count == 0)
        {
            ActivateDefaultModel();
            return;
        }

        int idx = UnityEngine.Random.Range(0, options.Count);
        string pick = options[idx];
        if (pick == "__DEFAULT__") ActivateDefaultModel();
        else LoadVRM(pick);
    }


    public void OpenFileDialogAndLoadVRM()
    {
        if (isLoading) return;

        isLoading = true;
        var extensions = new[] { new ExtensionFilter("Model Files", "vrm", "me", "prefab") };
        string[] paths = StandaloneFileBrowser.OpenFilePanel("Select Model File", "", extensions, false);
        if (paths.Length > 0 && !string.IsNullOrEmpty(paths[0]))
            LoadVRM(paths[0]);

        isLoading = false;
    }

    public async void LoadVRM(string path)
    {
        if (path.EndsWith(".me", StringComparison.OrdinalIgnoreCase))
        {
            LoadAssetBundleModel(path);
            if (SaveLoadHandler.Instance != null)
            {
                SaveLoadHandler.Instance.data.selectedModelPath = path;
                SaveLoadHandler.Instance.SaveToDisk();
            }
            return;
        }

        if (IsDLCReference(path))
        {
            GameObject prefab = FindDLCByName(path);
            if (prefab != null)
            {
                GameObject instance = Instantiate(prefab);
                FinalizeLoadedModel(instance, path);
                if (SaveLoadHandler.Instance != null)
                {
                    SaveLoadHandler.Instance.data.selectedModelPath = path;
                    SaveLoadHandler.Instance.SaveToDisk();
                }
            }
            else
            {
                Debug.LogError("[VRMLoader] DLC Prefab not found: " + path);
            }
            return;
        }

        if (!File.Exists(path)) return;

        try
        {
            byte[] fileData = await Task.Run(() => File.ReadAllBytes(path));
            if (fileData == null || fileData.Length == 0) return;

            GameObject loadedModel = null;

            try
            {
                var glbData = new GlbFileParser(path).Parse();
                var vrm10Data = Vrm10Data.Parse(glbData);
                if (vrm10Data != null)
                {
                    using var importer10 = new Vrm10Importer(vrm10Data);
                    var instance10 = await importer10.LoadAsync(new ImmediateCaller());
                    if (instance10.Root != null)
                    {
                        loadedModel = instance10.Root;
                        currentGltf = instance10;
                        loadedModel.AddComponent<GltfInstanceDisposer>().Bind(instance10);
                    }

                }
            }
            catch { }

            if (loadedModel == null)
            {
                try
                {
                    using var gltfData = new GlbBinaryParser(fileData, path).Parse();
                    VRMImporterContext importer = null;
                    try
                    {
                        importer = new VRMImporterContext(new VRMData(gltfData));
                        var instance = await importer.LoadAsync(new ImmediateCaller());
                        if (instance.Root != null)
                        {
                            loadedModel = instance.Root;
                            currentGltf = instance;
                            loadedModel.AddComponent<GltfInstanceDisposer>().Bind(instance);
                        }

                    }
                    finally
                    {
                        importer?.Dispose();
                    }
                }
                catch { return; }
            }

            if (loadedModel == null) return;

            FinalizeLoadedModel(loadedModel, path);
            if (SaveLoadHandler.Instance != null)
            {
                SaveLoadHandler.Instance.data.selectedModelPath = path;
                SaveLoadHandler.Instance.SaveToDisk();
            }
        }
        catch (Exception ex)
        {
            Debug.LogError("[VRMLoader] Failed to load model: " + ex.Message);
        }
    }

    private void LoadAssetBundleModel(string path)
    {
        var bundle = AssetBundle.LoadFromFile(path);
        if (bundle == null)
        {
            Debug.LogError("[VRMLoader] Failed to load AssetBundle at: " + path);
            return;
        }

        var prefab = bundle.LoadAllAssets<GameObject>().FirstOrDefault();
        if (prefab == null)
        {
            Debug.LogError("[VRMLoader] No prefab found in AssetBundle.");
            bundle.Unload(true);
            return;
        }

        var instance = Instantiate(prefab);
        FinalizeLoadedModel(instance, path, bundle);
    }

    private void FinalizeLoadedModel(GameObject loadedModel, string path, AssetBundle bundle = null)
    {
        DisableMainModel();
        ClearPreviousCustomModel();

        currentBundle = bundle;

        loadedModel.transform.SetParent(customModelOutput.transform, false);
        loadedModel.transform.localPosition = Vector3.zero;
        loadedModel.transform.localRotation = Quaternion.identity;
        loadedModel.transform.localScale = Vector3.one;
        currentModel = loadedModel;

        EnableSkinnedMeshRenderers(currentModel);
        AssignAnimatorController(currentModel);
        InjectComponentsFromPrefab(componentTemplatePrefab, currentModel);

        // NOTICE: Dynamically inject MEClothes if a sidecar .outfits.json exists for this VRM model
        TryInjectDynamicOutfitEntries(currentModel, path);

        var changer = FindFirstObjectByType<MEValueChanger>();
        if (changer != null)
            changer.SendMessage("TryAttachCustomVRM", SendMessageOptions.DontRequireReceiver);

        string displayName = Path.GetFileNameWithoutExtension(path);
        string author = "Unknown";
        string version = "Unknown";
        string fileType = "Unknown";
        Texture2D thumbnail = null;
        bool isME = path.EndsWith(".me", StringComparison.OrdinalIgnoreCase);

        var vrm10Instance = loadedModel.GetComponent<UniVRM10.Vrm10Instance>();
        if (vrm10Instance != null && vrm10Instance.Vrm != null && vrm10Instance.Vrm.Meta != null)
        {
            displayName = vrm10Instance.Vrm.Meta.Name ?? displayName;
            author = (vrm10Instance.Vrm.Meta.Authors != null && vrm10Instance.Vrm.Meta.Authors.Count > 0) ? vrm10Instance.Vrm.Meta.Authors[0] : "Unknown";
            version = vrm10Instance.Vrm.Meta.Version ?? "Unknown";
            fileType = isME ? ".ME (VRM1.X)" : "VRM1.X";
            thumbnail = vrm10Instance.Vrm.Meta.Thumbnail;
        }
        else
        {
            var vrmMeta = loadedModel.GetComponent<VRM.VRMMeta>();
            if (vrmMeta != null && vrmMeta.Meta != null)
            {
                var meta = vrmMeta.Meta;
                displayName = !string.IsNullOrEmpty(meta.Title) ? meta.Title : displayName;
                author = !string.IsNullOrEmpty(meta.Author) ? meta.Author : "Unknown";
                version = !string.IsNullOrEmpty(meta.Version) ? meta.Version : "Unknown";
                fileType = isME ? ".ME (VRM0.X)" : "VRM0.X";
                thumbnail = meta.Thumbnail;
            }
        }

        Texture2D safeThumbnail = MakeReadableCopy(thumbnail);
        int polyCount = GetTotalPolygons(loadedModel);

        if (!IsDLCReference(path))
            AvatarLibraryMenu.AddAvatarToLibrary(displayName, author, version, fileType, path, safeThumbnail, polyCount);

        if (safeThumbnail != null) Destroy(safeThumbnail);

        var libraryMenu = FindFirstObjectByType<AvatarLibraryMenu>();
        if (libraryMenu != null)
            libraryMenu.ReloadAvatars();

        StartCoroutine(DelayedRefreshStats());

        if (MEModLoader.Instance != null)
            MEModLoader.Instance.AssignHandlersForCurrentAvatar(loadedModel);

        StartCoroutine(ReleaseRamAndUnloadAssetsCo());
        SettingsHandlerUtility.ReloadAllSettingsHandlers();
    }

    [System.Serializable]
    private class DynamicOutfitConfig
    {
        public DynamicOutfitEntry[] entries;
    }

    [System.Serializable]
    private class DynamicOutfitEntry
    {
        public string name;
        public string tag;
        public string[] meshes;
    }

    public void ReloadDynamicOutfits(string modelPath = null)
    {
        string path = !string.IsNullOrEmpty(modelPath) ? modelPath : (SaveLoadHandler.Instance != null ? SaveLoadHandler.Instance.data.selectedModelPath : null);
        if (currentModel != null && !string.IsNullOrEmpty(path))
        {
            TryInjectDynamicOutfitEntries(currentModel, path);
            SettingsHandlerUtility.ReloadAllSettingsHandlers();
            Debug.Log($"[VRMLoader] ReloadDynamicOutfits complete for: {path}");
        }
    }

    private void TryInjectDynamicOutfitEntries(GameObject model, string modelPath)
    {
        if (model == null || string.IsNullOrEmpty(modelPath)) return;

        // Look for sidecar outfit json
        string dir = Path.GetDirectoryName(modelPath);
        if (string.IsNullOrEmpty(dir)) return;

        string filenameWithoutExt = Path.GetFileNameWithoutExtension(modelPath);
        
        string sidecar1 = Path.Combine(dir, $"{filenameWithoutExt}.outfits.json");
        string sidecar2 = Path.Combine(dir, $"{Path.GetFileName(modelPath)}.outfits.json");
        string sidecar3 = Path.Combine(dir, "outfits.json");

        string chosenJsonPath = null;
        if (File.Exists(sidecar1)) chosenJsonPath = sidecar1;
        else if (File.Exists(sidecar2)) chosenJsonPath = sidecar2;
        else if (File.Exists(sidecar3)) chosenJsonPath = sidecar3;

        if (string.IsNullOrEmpty(chosenJsonPath)) return;

        try
        {
            string jsonText = File.ReadAllText(chosenJsonPath);
            var config = JsonUtility.FromJson<DynamicOutfitConfig>(jsonText);
            Debug.Log($"[VRMLoader:OUTFITS] >>> RAW AIRI MANIFEST LOADED from {chosenJsonPath}:\n{jsonText}");

            var clothes = model.GetComponent<MEClothes>() ?? model.AddComponent<MEClothes>();
            int count = Mathf.Min(8, config.entries.Length);
            clothes.entries = new MEClothes.OutfitEntry[count];

            var allTransforms = model.GetComponentsInChildren<Transform>(true);

            var sb = new System.Text.StringBuilder();
            sb.AppendLine($"[VRMLoader:OUTFITS] >>> ALL UNITY RENDERERS ON AVATAR (Total transforms: {allTransforms.Length}):");
            foreach (var t in allTransforms)
            {
                var smr = t.GetComponent<SkinnedMeshRenderer>();
                var mf = t.GetComponent<MeshFilter>();
                if (smr != null || mf != null)
                {
                    string meshName = smr != null && smr.sharedMesh != null ? smr.sharedMesh.name : (mf != null && mf.sharedMesh != null ? mf.sharedMesh.name : "<none>");
                    sb.AppendLine($"  - [RENDERER] GO='{t.name}' (normGO='{NormalizeMeshName(t.name)}') | Mesh='{meshName}' (normMesh='{NormalizeMeshName(meshName)}') | active={t.gameObject.activeSelf}");
                }
            }
            Debug.Log(sb.ToString());

            for (int i = 0; i < count; i++)
            {
                var cfgEntry = config.entries[i];
                var entry = new MEClothes.OutfitEntry
                {
                    name = cfgEntry.name,
                    tag = cfgEntry.tag ?? ""
                };

                Debug.Log($"[VRMLoader:OUTFITS] Processing Outfit Entry [{i}]: '{entry.name}' (tag: '{entry.tag}', meshes defined: {cfgEntry.meshes?.Length ?? 0})");

                var matchedObjects = new System.Collections.Generic.List<GameObject>();
                if (cfgEntry.meshes != null)
                {
                    foreach (var meshName in cfgEntry.meshes)
                    {
                        if (string.IsNullOrEmpty(meshName)) continue;
                        string meshNorm = NormalizeMeshName(meshName);
                        int meshMatchCount = 0;
                        foreach (var t in allTransforms)
                        {
                            if (IsMeshMatch(meshName, t.gameObject))
                            {
                                if (!matchedObjects.Contains(t.gameObject))
                                    matchedObjects.Add(t.gameObject);
                                meshMatchCount++;
                                Debug.Log($"[VRMLoader:OUTFITS]   [MATCH] AIRI mesh '{meshName}' (norm: '{meshNorm}') -> Matched Unity GO '{t.name}' (active={t.gameObject.activeSelf})");
                            }
                        }
                        if (meshMatchCount == 0)
                        {
                            Debug.LogWarning($"[VRMLoader:OUTFITS]   [NO MATCH] AIRI mesh '{meshName}' (norm: '{meshNorm}') found NO matching GameObjects on avatar!");
                        }
                    }
                }

                entry.gameObjects = matchedObjects.ToArray();
                clothes.entries[i] = entry;
                Debug.Log($"[VRMLoader:OUTFITS] >>> Finished Entry [{entry.name}] -> Mapped {matchedObjects.Count} GameObjects: [{string.Join(", ", matchedObjects.ConvertAll(g => g.name))}]");
            }

            Debug.Log($"[VRMLoader] Dynamic MEClothes injection complete with {count} outfit entries from {Path.GetFileName(chosenJsonPath)}!");
        }
        catch (Exception ex)
        {
            Debug.LogError($"[VRMLoader] Failed to inject dynamic outfits: {ex.Message}");
        }
    }

    private static string NormalizeMeshName(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        string lower = s.Trim().ToLowerInvariant();
        // Strip .baked or baked suffix (and any trailing _0, _1, etc.)
        lower = System.Text.RegularExpressions.Regex.Replace(lower, @"\.?baked(_\d+)?$", "");
        // Strip delimiters
        lower = System.Text.RegularExpressions.Regex.Replace(lower, @"[._\-\s]", "");
        return lower;
    }

    private static bool IsMeshMatch(string searchName, GameObject go)
    {
        if (go == null || string.IsNullOrEmpty(searchName)) return false;

        // 1. Must be a visual renderer (never a bone transform like skirtRoot!)
        var smr = go.GetComponent<SkinnedMeshRenderer>();
        var mf = go.GetComponent<MeshFilter>();
        if (smr == null && mf == null) return false;

        string searchExact = searchName.Trim();
        string searchNorm = NormalizeMeshName(searchName);

        // 2. Exact or case-insensitive match on GameObject name
        if (go.name.Equals(searchExact, StringComparison.OrdinalIgnoreCase))
            return true;

        // 3. Exact match on SkinnedMeshRenderer / MeshFilter sharedMesh name
        if (smr != null && smr.sharedMesh != null && smr.sharedMesh.name.Equals(searchExact, StringComparison.OrdinalIgnoreCase))
            return true;

        if (mf != null && mf.sharedMesh != null && mf.sharedMesh.name.Equals(searchExact, StringComparison.OrdinalIgnoreCase))
            return true;

        // 4. Normalized exact equality on GameObject name
        string goNorm = NormalizeMeshName(go.name);
        if (!string.IsNullOrEmpty(searchNorm) && !string.IsNullOrEmpty(goNorm))
        {
            if (goNorm == searchNorm)
                return true;
        }

        // 5. Normalized exact equality on sharedMesh name
        if (smr != null && smr.sharedMesh != null)
        {
            string meshNorm = NormalizeMeshName(smr.sharedMesh.name);
            if (!string.IsNullOrEmpty(meshNorm) && meshNorm == searchNorm)
                return true;
        }

        if (mf != null && mf.sharedMesh != null)
        {
            string meshNorm = NormalizeMeshName(mf.sharedMesh.name);
            if (!string.IsNullOrEmpty(meshNorm) && meshNorm == searchNorm)
                return true;
        }

        // 6. Check if any parent/ancestor container transform matches searchName
        Transform curr = go.transform.parent;
        while (curr != null && curr != curr.root)
        {
            string parentNorm = NormalizeMeshName(curr.name);
            if (!string.IsNullOrEmpty(parentNorm) && parentNorm == searchNorm)
                return true;
            if (curr.name.Equals(searchExact, StringComparison.OrdinalIgnoreCase))
                return true;
            curr = curr.parent;
        }

        // 7. Prefix match for sub-parts (e.g. "skirt" matches "skirtbaked", "skirt_0", "skirt_1")
        if (!string.IsNullOrEmpty(goNorm) && goNorm.StartsWith(searchNorm))
            return true;
        if (smr != null && smr.sharedMesh != null)
        {
            string meshNorm = NormalizeMeshName(smr.sharedMesh.name);
            if (!string.IsNullOrEmpty(meshNorm) && meshNorm.StartsWith(searchNorm))
                return true;
        }

        return false;
    }

    public Texture2D MakeReadableCopy(Texture texture)
    {
        if (texture == null) return null;
        RenderTexture rt = RenderTexture.GetTemporary(texture.width, texture.height, 0);
        Graphics.Blit(texture, rt);
        RenderTexture previous = RenderTexture.active;
        RenderTexture.active = rt;
        Texture2D readable = new Texture2D(texture.width, texture.height, TextureFormat.RGBA32, false);
        readable.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
        readable.Apply();
        RenderTexture.active = previous;
        RenderTexture.ReleaseTemporary(rt);
        return readable;
    }

    public void ResetModel()
    {
        string vrmFolder = Path.Combine(Application.persistentDataPath, "VRM");
        if (Directory.Exists(vrmFolder))
            Directory.Delete(vrmFolder, true);

        ClearPreviousCustomModel(skipRawImageCleanup: true);
        EnableMainModel();

        if (SaveLoadHandler.Instance != null)
        {
            SaveLoadHandler.Instance.data.selectedModelPath = "";
            SaveLoadHandler.Instance.SaveToDisk();
        }

        if (MEModLoader.Instance != null && mainModel != null)
            MEModLoader.Instance.AssignHandlersForCurrentAvatar(mainModel);

        StartCoroutine(ReleaseRamAndUnloadAssetsCo());
    }

    private void DisableMainModel()
    {
        if (mainModel != null)
            mainModel.SetActive(false);
    }

    private void EnableMainModel()
    {
        if (mainModel != null)
            mainModel.SetActive(true);
    }

    private void ClearPreviousCustomModel(bool skipRawImageCleanup = false)
    {
        if (customModelOutput != null)
        {
            foreach (Transform child in customModelOutput.transform)
            {
                if (child.gameObject == mainModel) continue;
                CleanupRawImages(child.gameObject);
                Destroy(child.gameObject);
            }
        }

        if (currentBundle != null)
        {
            currentBundle.Unload(true);
            currentBundle = null;
        }

        currentGltf = null;

        if (!skipRawImageCleanup)
            CleanupAllRawImagesInScene();
    }

    private void EnableSkinnedMeshRenderers(GameObject model)
    {
        foreach (var skinnedMesh in model.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            skinnedMesh.enabled = true;
    }

    private void AssignAnimatorController(GameObject model)
    {
        var animator = model.GetComponentInChildren<Animator>();
        if (animator != null && animatorController != null)
            animator.runtimeAnimatorController = animatorController;
    }

    private void InjectComponentsFromPrefab(GameObject prefabTemplate, GameObject targetModel)
    {
        if (prefabTemplate == null || targetModel == null) return;

        var templateObj = Instantiate(prefabTemplate);
        var animator = targetModel.GetComponentInChildren<Animator>();

        foreach (var templateComp in templateObj.GetComponents<MonoBehaviour>())
        {
            var type = templateComp.GetType();
            if (targetModel.GetComponent(type) != null) continue;
            var newComp = targetModel.AddComponent(type);
            CopyComponentValues(templateComp, newComp);

            if (animator != null)
            {
                var setAnimMethod = type.GetMethod("SetAnimator", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                if (setAnimMethod != null) setAnimMethod.Invoke(newComp, new object[] { animator });

                var animatorField = type.GetField("animator", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                if (animatorField != null && animatorField.FieldType == typeof(Animator)) animatorField.SetValue(newComp, animator);
            }
        }
        Destroy(templateObj);
    }

    private void CopyComponentValues(Component source, Component destination)
    {
        var type = source.GetType();
        var fields = type.GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
        foreach (var field in fields)
        {
            if (field.IsDefined(typeof(SerializeField), true) || field.IsPublic)
                field.SetValue(destination, field.GetValue(source));
        }
        var props = type.GetProperties(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
                        .Where(p => p.CanWrite && p.GetSetMethod(true) != null);
        foreach (var prop in props)
        {
            try { prop.SetValue(destination, prop.GetValue(source)); }
            catch { }
        }
    }

    private System.Collections.IEnumerator DelayedRefreshStats()
    {
        yield return null;
        var stats = FindFirstObjectByType<RuntimeModelStats>();
        if (stats != null)
            stats.RefreshNow();
    }

    public int GetTotalPolygons(GameObject model)
    {
        int total = 0;
        foreach (var meshFilter in model.GetComponentsInChildren<MeshFilter>(true))
        {
            var mesh = meshFilter.sharedMesh;
            if (mesh != null)
                total += mesh.triangles.Length / 3;
        }
        foreach (var skinned in model.GetComponentsInChildren<SkinnedMeshRenderer>(true))
        {
            var mesh = skinned.sharedMesh;
            if (mesh != null)
                total += mesh.triangles.Length / 3;
        }
        return total;
    }

    public void ActivateDefaultModel()
    {
        ClearPreviousCustomModel(skipRawImageCleanup: true);
        EnableMainModel();

        if (SaveLoadHandler.Instance != null)
        {
            SaveLoadHandler.Instance.data.selectedModelPath = "";
            SaveLoadHandler.Instance.SaveToDisk();
        }

        if (MEModLoader.Instance != null && mainModel != null)
            MEModLoader.Instance.AssignHandlersForCurrentAvatar(mainModel);

        StartCoroutine(ReleaseRamAndUnloadAssetsCo());
        SettingsHandlerUtility.ReloadAllSettingsHandlers();
    }

    private System.Collections.IEnumerator ReleaseRamAndUnloadAssetsCo()
    {
        yield return Resources.UnloadUnusedAssets();
        yield return null;
        System.GC.Collect();
        System.GC.WaitForPendingFinalizers();
        System.GC.Collect();
    }

    private void CleanupRawImages(GameObject obj)
    {
        if (obj == null) return;
        var rawImages = obj.GetComponentsInChildren<RawImage>(true);
        foreach (var rawImage in rawImages)
            rawImage.texture = null;
    }

    private void CleanupAllRawImagesInScene()
    {
        var rawImages = GameObject.FindObjectsByType<RawImage>(FindObjectsInactive.Include, FindObjectsSortMode.None);
        foreach (var rawImage in rawImages)
            rawImage.texture = null;
    }

    private bool IsDLCReference(string path)
    {
#if UNITY_EDITOR
        if (path.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase))
            return true;
#endif
        if (!File.Exists(path) && !path.EndsWith(".vrm") && !path.EndsWith(".me"))
            return true;
        return false;
    }

    private GameObject FindDLCByName(string name)
    {
        var library = FindFirstObjectByType<AvatarLibraryMenu>();
        if (library == null) return null;
        foreach (var dlc in library.dlcAvatars)
        {
#if UNITY_EDITOR
            string assetPath = AssetDatabase.GetAssetPath(dlc.prefab);
            if (assetPath == name) return dlc.prefab;
#endif
            if (dlc.prefab != null && dlc.prefab.name == name) return dlc.prefab;
        }
        return null;
    }

    public GameObject GetCurrentModel()
    {
        return currentModel;
    }
}
public sealed class GltfInstanceDisposer : MonoBehaviour
{
    private UniGLTF.RuntimeGltfInstance inst;

    public void Bind(UniGLTF.RuntimeGltfInstance i)
    {
        inst = i;
    }

    private void OnDestroy()
    {
        try { inst?.Dispose(); } catch { }
    }
}
