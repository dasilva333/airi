using UnityEngine;
using System.Collections.Generic;

public class MEClothes : MonoBehaviour
{
    [Tooltip("Used only to keep the script in builds. This instance will be ignored at runtime.")]
    public bool isScriptLoader = false;

    [Tooltip("If true, entries specify hiddenMeshes to hide when active (AIRI standard).")]
    public bool isSubtractive = false;

    public int activeOutfitIndex = -1;
    public GameObject[] allRenderers;

    [System.Serializable]
    public class OutfitEntry
    {
        public string name;
        public string tag;
        public GameObject[] gameObjects;
    }

    [Header("Outfit Entries (Max 8)")]
    public OutfitEntry[] entries = new OutfitEntry[8];

    public void ActivateOutfit(int index)
    {
        if (index < 0 || index >= entries.Length) return;

        OutfitEntry selected = entries[index];
        if (selected == null || selected.gameObjects == null) return;

        if (isSubtractive)
        {
            // If already active, toggle off and restore default outfit
            if (activeOutfitIndex == index)
            {
                activeOutfitIndex = -1;
                RestoreAllRenderers();
                Debug.Log($"[MEClothes] Deactivated outfit '{selected.name}'. Restored all meshes to default.");
                return;
            }

            activeOutfitIndex = index;
            RestoreAllRenderers();

            // Hide only the meshes defined for this outfit
            foreach (var obj in selected.gameObjects)
            {
                if (obj != null)
                    obj.SetActive(false);
            }
            Debug.Log($"[MEClothes] Activated outfit '{selected.name}' (hidden {selected.gameObjects.Length} target meshes).");
            return;
        }

        // Original Upstream Additive Logic
        bool isCurrentlyOn = IsAnyActive(selected.gameObjects);
        bool hasTag = !string.IsNullOrEmpty(selected.tag);

        // Turn OFF all entries with the same tag if tag is present
        if (hasTag)
        {
            for (int i = 0; i < entries.Length; i++)
            {
                if (i == index) continue;

                OutfitEntry entry = entries[i];
                if (entry == null || entry.gameObjects == null) continue;
                if (entry.tag == selected.tag)
                {
                    foreach (var obj in entry.gameObjects)
                        if (obj != null) obj.SetActive(false);
                }
            }
        }

        // Toggle current entry
        foreach (var obj in selected.gameObjects)
            if (obj != null) obj.SetActive(!isCurrentlyOn);
    }

    public void RestoreAllRenderers()
    {
        if (allRenderers != null && allRenderers.Length > 0)
        {
            foreach (var r in allRenderers)
                if (r != null) r.SetActive(true);
        }
        else
        {
            foreach (var smr in GetComponentsInChildren<SkinnedMeshRenderer>(true))
                smr.gameObject.SetActive(true);
            foreach (var mf in GetComponentsInChildren<MeshFilter>(true))
                mf.gameObject.SetActive(true);
        }
    }

    private bool IsAnyActive(GameObject[] targets)
    {
        foreach (var obj in targets)
            if (obj != null && obj.activeSelf) return true;
        return false;
    }
}
