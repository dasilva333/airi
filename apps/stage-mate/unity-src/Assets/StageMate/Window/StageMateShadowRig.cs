using UnityEngine;

namespace StageMate.Window
{
    public class StageMateShadowRig : MonoBehaviour
    {
        [Header("Shadow Projector Plane")]
        public Vector3 planePosition = new Vector3(0f, 0.9f, 0.5f);
        public Vector2 planeSize = new Vector2(3.0f, 3.0f);
        public Shader shadowShader;
        public bool enableDesktopShadow = true;

        private GameObject shadowPlane;
        private MeshRenderer meshRenderer;

        private void Start()
        {
            SetupShadowPlane();
        }

        public void SetupShadowPlane()
        {
            if (shadowPlane != null) return;

            shadowPlane = GameObject.CreatePrimitive(PrimitiveType.Quad);
            shadowPlane.name = "StageMate_DesktopShadowPlane";
            shadowPlane.transform.SetParent(transform, false);
            shadowPlane.transform.localPosition = planePosition;
            shadowPlane.transform.localRotation = Quaternion.identity;
            shadowPlane.transform.localScale = new Vector3(planeSize.x, planeSize.y, 1.0f);

            // Remove Collider
            var col = shadowPlane.GetComponent<Collider>();
            if (col != null) Destroy(col);

            meshRenderer = shadowPlane.GetComponent<MeshRenderer>();
            meshRenderer.receiveShadows = true;
            meshRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            // Find shadow shader
            if (shadowShader == null)
            {
                shadowShader = Shader.Find("Transparent/Shadow") ??
                               Shader.Find("Hidden/ShadowOnly") ??
                               Shader.Find("Standard");
            }

            if (shadowShader != null)
            {
                var mat = new Material(shadowShader);
                meshRenderer.material = mat;
            }
        }

        public void SetShadowsEnabled(bool enabled)
        {
            enableDesktopShadow = enabled;
            if (shadowPlane != null)
                shadowPlane.SetActive(enabled);
        }
    }
}
