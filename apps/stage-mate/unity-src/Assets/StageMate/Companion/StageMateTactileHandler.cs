using System;
using UnityEngine;
using StageMate.Models;

namespace StageMate.Companion
{
    public class StageMateTactileHandler : MonoBehaviour
    {
        [Header("Tactile Interaction Settings")]
        public float interactionRadius = 0.35f;
        public float followSpeed = 10f;
        public float maxIKWeight = 1.0f;
        public bool enableTactile = true;

        [Header("Heart Particles & Petting")]
        public ParticleSystem heartParticles;
        public AudioSource audioSource;
        public AudioClip[] petSounds;

        private IStageModelDriver modelDriver;
        private Camera mainCam;
        private float leftIKWeight;
        private float rightIKWeight;
        private float petStrokeTimer;

        public void BindModelDriver(IStageModelDriver driver)
        {
            modelDriver = driver;
            mainCam = Camera.main;
        }

        private void Update()
        {
            if (!enableTactile || modelDriver == null || !modelDriver.IsLoaded)
            {
                leftIKWeight = Mathf.MoveTowards(leftIKWeight, 0f, Time.deltaTime * 3f);
                rightIKWeight = Mathf.MoveTowards(rightIKWeight, 0f, Time.deltaTime * 3f);
                return;
            }

            if (mainCam == null) mainCam = Camera.main;
            if (mainCam == null) return;

            // Screen-space cursor raycast
            Ray ray = mainCam.ScreenPointToRay(Input.mousePosition);

            // 1. Hand-Holding IK Tracking
            UpdateHandHolding(ray);

            // 2. Head Petting & Heart Particles
            UpdateHeadPetting(ray);
        }

        private void UpdateHandHolding(Ray ray)
        {
            Transform leftHand = modelDriver.LeftHandTransform;
            Transform rightHand = modelDriver.RightHandTransform;

            if (leftHand == null && rightHand == null) return;

            // Calculate closest point on ray to hands
            Vector3 mouseWorld = ray.origin + ray.direction * 2.5f;

            if (leftHand != null)
            {
                float distLeft = Vector3.Distance(leftHand.position, mouseWorld);
                bool nearLeft = distLeft < interactionRadius;
                leftIKWeight = Mathf.MoveTowards(leftIKWeight, nearLeft ? maxIKWeight : 0f, Time.deltaTime * 2f);

                if (leftIKWeight > 0.01f)
                {
                    Vector3 targetPos = Vector3.Lerp(leftHand.position, mouseWorld, leftIKWeight);
                    leftHand.position = Vector3.Lerp(leftHand.position, targetPos, Time.deltaTime * followSpeed);
                }
            }

            if (rightHand != null)
            {
                float distRight = Vector3.Distance(rightHand.position, mouseWorld);
                bool nearRight = distRight < interactionRadius;
                rightIKWeight = Mathf.MoveTowards(rightIKWeight, nearRight ? maxIKWeight : 0f, Time.deltaTime * 2f);

                if (rightIKWeight > 0.01f)
                {
                    Vector3 targetPos = Vector3.Lerp(rightHand.position, mouseWorld, rightIKWeight);
                    rightHand.position = Vector3.Lerp(rightHand.position, targetPos, Time.deltaTime * followSpeed);
                }
            }
        }

        private void UpdateHeadPetting(Ray ray)
        {
            Transform head = modelDriver.HeadTransform;
            if (head == null) return;

            float distToHead = Vector3.Distance(head.position, ray.origin + ray.direction * Vector3.Distance(ray.origin, head.position));
            bool isOverHead = distToHead < 0.25f;

            if (isOverHead)
            {
                petStrokeTimer += Time.deltaTime;
                if (petStrokeTimer > 0.4f)
                {
                    // Trigger happy blush & hearts!
                    modelDriver.SetExpression("Joy", 0.8f);
                    if (heartParticles != null && !heartParticles.isPlaying)
                    {
                        heartParticles.transform.position = head.position + Vector3.up * 0.2f;
                        heartParticles.Play();
                    }
                    PlayPetSound();
                }
            }
            else
            {
                petStrokeTimer = Mathf.MoveTowards(petStrokeTimer, 0f, Time.deltaTime);
            }
        }

        private void PlayPetSound()
        {
            if (audioSource == null || petSounds == null || petSounds.Length == 0) return;
            if (audioSource.isPlaying) return;

            int idx = UnityEngine.Random.Range(0, petSounds.Length);
            audioSource.PlayOneShot(petSounds[idx]);
        }
    }
}
