using UnityEngine;

namespace StageMate.Models
{
    public class VrmSwayDriver : MonoBehaviour
    {
        [Header("Sway Spring Dynamics")]
        public float frequency = 2.6f;
        public float damping = 0.35f;
        public float maxOffset = 0.15f;
        public float breathingSpeed = 1.2f;
        public float breathingAmount = 0.008f;
        public bool enableSway = true;

        private Transform hips;
        private Transform spine;
        private Transform leftArm;
        private Transform rightArm;

        private Vector3 lastRootPos;
        private Vector3 swayVelocity;
        private Vector3 currentSwayOffset;
        private float breathingPhase;

        public void BindBones(Animator animator)
        {
            if (animator == null) return;
            hips = animator.GetBoneTransform(HumanBodyBones.Hips);
            spine = animator.GetBoneTransform(HumanBodyBones.Spine);
            leftArm = animator.GetBoneTransform(HumanBodyBones.LeftUpperArm);
            rightArm = animator.GetBoneTransform(HumanBodyBones.RightUpperArm);
            lastRootPos = transform.position;
            currentSwayOffset = Vector3.zero;
            swayVelocity = Vector3.zero;
        }

        private void LateUpdate()
        {
            if (!enableSway || hips == null) return;

            float dt = Time.deltaTime;
            if (dt <= 0f || dt > 0.1f) dt = 0.016f;

            // 1. Drag velocity tracking
            Vector3 rootPos = transform.position;
            Vector3 delta = (rootPos - lastRootPos) / dt;
            lastRootPos = rootPos;

            // 2. Spring-damper physics
            Vector3 targetOffset = -delta * 0.05f;
            targetOffset = Vector3.ClampMagnitude(targetOffset, maxOffset);

            Vector3 springForce = (targetOffset - currentSwayOffset) * (frequency * frequency * 4f * Mathf.PI * Mathf.PI);
            Vector3 dampingForce = -swayVelocity * (2f * damping * frequency * 2f * Mathf.PI);
            Vector3 acceleration = springForce + dampingForce;

            swayVelocity += acceleration * dt;
            currentSwayOffset += swayVelocity * dt;

            // 3. Natural Breathing
            breathingPhase += dt * breathingSpeed;
            float breathY = Mathf.Sin(breathingPhase) * breathingAmount;

            // 4. Apply to Hips and Spine
            hips.localPosition += new Vector3(currentSwayOffset.x * 0.5f, currentSwayOffset.y * 0.5f + breathY, currentSwayOffset.z * 0.5f);
            if (spine != null)
            {
                spine.localRotation *= Quaternion.Euler(-currentSwayOffset.z * 30f, 0f, -currentSwayOffset.x * 30f);
            }
        }
    }
}
