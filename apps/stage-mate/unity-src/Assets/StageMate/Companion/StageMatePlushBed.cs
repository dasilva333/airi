using UnityEngine;
using StageMate.Models;

namespace StageMate.Companion
{
    public class StageMatePlushBed : MonoBehaviour
    {
        [Header("Macaron Bed Props")]
        public GameObject macaronBedObject;
        public Vector3 bedOffset = new Vector3(0f, -0.4f, 0f);
        public bool isBedActive;

        private IStageModelDriver modelDriver;

        public void BindModelDriver(IStageModelDriver driver)
        {
            modelDriver = driver;
            if (macaronBedObject != null)
                macaronBedObject.SetActive(isBedActive);
        }

        public void ToggleMacaronBed()
        {
            isBedActive = !isBedActive;
            if (macaronBedObject != null)
            {
                macaronBedObject.SetActive(isBedActive);
                if (isBedActive && modelDriver != null && modelDriver.HipsTransform != null)
                {
                    macaronBedObject.transform.position = modelDriver.HipsTransform.position + bedOffset;
                }
            }
        }

        public void SetBedActive(bool active)
        {
            isBedActive = active;
            if (macaronBedObject != null)
                macaronBedObject.SetActive(active);
        }
    }
}
