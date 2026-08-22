using System.Collections;
using UnityEngine;

namespace StageMate.Effects
{
    /// <summary>
    /// Self-contained decay lifecycle for procedural cartoon bullet holes.
    /// Holds full opacity for a fixed duration, smoothly fades alpha to zero, and self-destructs.
    /// </summary>
    public sealed class BulletHoleDecay : MonoBehaviour
    {
        [SerializeField] private float holdDuration = 2.5f;
        [SerializeField] private float fadeDuration = 0.7f;

        private CanvasGroup canvasGroup;

        private void Awake()
        {
            canvasGroup = GetComponent<CanvasGroup>();
            if (canvasGroup == null)
            {
                canvasGroup = gameObject.AddComponent<CanvasGroup>();
            }
        }

        private void Start()
        {
            StartCoroutine(DecayRoutine());
        }

        private IEnumerator DecayRoutine()
        {
            if (canvasGroup != null)
            {
                canvasGroup.alpha = 1f;
            }

            // Hold full opacity
            yield return new WaitForSeconds(holdDuration);

            // Smoothly fade out
            float elapsed = 0f;
            while (elapsed < fadeDuration)
            {
                elapsed += Time.deltaTime;
                if (canvasGroup != null)
                {
                    canvasGroup.alpha = Mathf.Lerp(1f, 0f, elapsed / fadeDuration);
                }
                yield return null;
            }

            Destroy(gameObject);
        }
    }
}
