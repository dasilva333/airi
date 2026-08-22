using Microsoft.VisualBasic.Devices;
using System;
using System.Collections.Generic;
using Unity.VisualScripting.Antlr3.Runtime;
using UnityEngine;
using UniVRM10;

[Serializable]
public class TrackingPermission
{
    public string stateOrParameterName;
    public bool isParameter;
    public bool allowHead = true, allowSpine = true, allowEye = true;
}

[RequireComponent(typeof(Animator))]
public class AvatarMouseTracking : MonoBehaviour
{
    [Header("Mouse Tracking Settings")]
    public bool enableMouseTracking = true;
    public List<TrackingPermission> trackingPermissions = new();

    [Range(0f, 90f)] public float headYawLimit = 45f, headPitchLimit = 30f;
    [Range(1f, 20f)] public float headSmoothness = 10f;
    [Range(-90f, 90f)] public float spineMinRotation = -15f, spineMaxRotation = 15f;
    [Range(1f, 50f)] public float spineSmoothness = 25f;
    [Range(1f, 10f)] public float spineFadeSpeed = 5f;
    [Range(0f, 90f)] public float eyeYawLimit = 12f, eyePitchLimit = 12f;
    [Range(1f, 20f)] public float eyeSmoothness = 10f;
    [Range(0f, 1f)] public float headBlend = 1f, spineBlend = 1f, eyeBlend = 1f;

    Animator animator;
    Camera mainCam;

    Transform headBone, spineBone, chestBone, upperChestBone;
    Transform leftEyeBone, rightEyeBone, headDriver, spineDriver;
    Transform leftEyeDriver, rightEyeDriver, eyeCenter, vrmLookAtTarget;
    Transform body;

    Quaternion headInitRot, spineInitRot;
    float spineTrackingWeight;

    Vrm10Instance vrm10;
    int currStateHash, nextStateHash;
    [Header("Arms Tracking")]
    public float yAimTreshold = 500f;
    public float armBlend = 1f;
    public float armFadeSpeed = 5f;
    public float armSmoothness = 5f;
    //public float armMinPitch = -20f;
    public float armMinPitch = 0f;
    public float armMaxPitch = 40f;

    private float armTrackingWeight;
    private Quaternion upperArmRInitRot;
    private Quaternion upperArmLInitRot;
    private Transform upperArmR, upperArmL;
    private Transform rightHand;
    private Transform upperArmRDriver, upperArmLDriver;
    private Transform rightUpperArmBone, leftUpperArmBone;
    public float ikPositionWeight = 1f;     // how strongly IK moves the hand
    public float ikRotationWeight = 1f;     // how strongly IK rotates the hand
    public float ikSmoothing = 10f;         // smoothing for target moves
    public float maxAimDistance = 30f;
    public Transform muzzle;                // optional: if your gun prefab has a muzzle transform
    public bool debugRays = true;
    Quaternion calibrateOffsetR;

    //
    //[SerializeField] GameObject gunPrefab;
    //public GameObject gunPrefab;
    //public GameObject gunPrefab2;
    GameObject currentGunObj;
    int currentGunInd;
    public List<GameObject> gunPrefabs;
    public bool enableWeaponStance = false;
    bool wasArmed = false;
    GameObject gun;
    [Header("Gun Attachment Offset")]
    public Vector3 gunLocalPos = Vector3.zero;
    public Vector3 gunLocalRot = Vector3.zero;

    public void SetWeaponMode(bool enabled, string weaponName)
    {
        enableWeaponStance = enabled;
        Debug.Log($"[Gunslinger] SetWeaponMode: enabled={enabled}, weapon={weaponName}");
        if (!enabled)
        {
            if (animator != null)
                animator.SetBool("isArmed", false);
            if (gun != null)
                gun.SetActive(false);
            return;
        }

        string w = (weaponName ?? "cat").ToLowerInvariant().Trim();
        if (w == "cat") LoadGun(2);
        else if (w == "gray" || w == "silver") LoadGun(1);
        else if (w == "blk" || w == "black") LoadGun(0);
        else LoadGun(0);
    }
    float monitorHeight;
    float monitorWidth;
    float lastMonitorHeight;
    float lastMonitorWidth;
    bool bodyFire = false;
    bool faceBackward = false;
    bool FPSallow0 = true;
    bool FPSallow = false;
    bool FPSmode = false;
    //bool currentYaw = 0;
    bool turnViaRight = false;
    float currentYaw;
    float yawVelocity;

    float turnTargetYaw;     // ← LOCKED target
    bool isTurning;
    bool prevFPSMode = false;
    bool prevturnViaRight = false;
    float turnSmoothTime = 0.06f;
    WinMonitorUtil.RECT monitor;
    WinMonitorUtil.RECT winRect;
    Vector2 virtualMouseOriginal = Vector2.zero;
    Vector2 virtualMouseClamp = Vector2.zero;
    Vector2 virtualMouseModified = Vector2.zero;
    Vector2 virtualMouseModifiedClamp = Vector2.zero;
    string prevState = "";
    bool waitingTransitionState = false;
    float FPSaimSizeHalfen = 0.05f;
    float FPSpercentageMin = 0.45f;
    float FPSpercentageMax = 0.55f;
    float yawROffset = 0f;
    float yawLOffset = 0f;
    void Start()
    {
        animator = GetComponent<Animator>();
        mainCam = Camera.main;
        if (!animator || !animator.isHuman) { enableMouseTracking = false; Debug.LogError("Animator not found or not humanoid!"); return; }
        vrm10 = GetComponentInChildren<Vrm10Instance>();
        InitHead(); InitSpine(); InitEye();
        //

        //yAimTreshold = Screen.height * 0.5f;
        //yAimTreshold = Screen.height * 0.6f;
        //yAimTreshold = Screen.height * 0.65f;
        yAimTreshold = Display.main.systemHeight * 0.65f;
        InitArms();
        body = animator.transform;
        currentYaw = transform.eulerAngles.y;
        Debug.Log("[Gunslinger] Initializing weapon prefabs...");
        EnsureGunPrefabs();
        if (gunPrefabs != null && gunPrefabs.Count > 0)
        {
            currentGunInd = 0;
            LoadGun(currentGunInd);
            if (gun != null)
                gun.SetActive(false);
        }
        else
        {
            Debug.LogWarning("[Gunslinger] No gun prefabs available.");
        }
    }

    void EnsureGunPrefabs()
    {
        if (gunPrefabs == null)
            gunPrefabs = new List<GameObject>();

        gunPrefabs.RemoveAll(p => p == null);

        if (gunPrefabs.Count == 0)
        {
            var black = Resources.Load<GameObject>("Gunslinger/M1911 Handgun_Black (Shooting)");
            var silver = Resources.Load<GameObject>("Gunslinger/M1911 Handgun_Silver (Shooting)");
            var cat = Resources.Load<GameObject>("Gunslinger/Cat Gun Shooting");

            if (black != null) gunPrefabs.Add(black);
            if (silver != null) gunPrefabs.Add(silver);
            if (cat != null) gunPrefabs.Add(cat);
            Debug.Log($"[Gunslinger] Loaded {gunPrefabs.Count} gun prefabs from Resources.");
        }
    }

    void LoadGun(int gunIndex)
    {
        EnsureGunPrefabs();
        if (gunPrefabs == null || gunPrefabs.Count == 0) return;
        currentGunInd = Mathf.Clamp(gunIndex, 0, gunPrefabs.Count - 1);
        LoadGun(gunPrefabs[currentGunInd]);
    }

    void LoadGun(GameObject prefab)
    {
        if (!prefab || !rightHand) return;
        if (gun != null) Destroy(gun.gameObject);
        Debug.Log("[Gunslinger] Loaded weapon: " + prefab.name, this);
        gun = Instantiate(prefab, rightHand);

        gunLocalPos = new Vector3(0.05f, -0.01f, -0.02f);
        gunLocalRot = new Vector3(15, 90, 90);

        gun.transform.localScale = Vector3.one * 0.9f;
        gun.transform.localPosition = gunLocalPos;
        gun.transform.localRotation = Quaternion.Euler(gunLocalRot);
        currentGunObj = prefab;
    }

    void InitHead()
    {
        headBone = animator.GetBoneTransform(HumanBodyBones.Head);
        if (!headBone) return;
        headDriver = new GameObject("HeadDriver").transform;
        headDriver.SetParent(headBone.parent, false);
        headDriver.localPosition = headBone.localPosition;
        headDriver.localRotation = headBone.localRotation;
        headInitRot = headBone.localRotation;
    }

    void InitSpine()
    {
        spineBone = animator.GetBoneTransform(HumanBodyBones.Spine);
        chestBone = animator.GetBoneTransform(HumanBodyBones.Chest);
        upperChestBone = animator.GetBoneTransform(HumanBodyBones.UpperChest);
        if (!spineBone) return;
        spineDriver = new GameObject("SpineDriver").transform;
        spineDriver.SetParent(spineBone.parent, false);
        spineDriver.localPosition = spineBone.localPosition;
        spineDriver.localRotation = spineBone.localRotation;
        spineInitRot = spineBone.localRotation;
    }
    Quaternion FromBasis(Vector3 f, Vector3 u, Vector3 r)
    {
        // create a rotation from the basis matrix
        var m = new Matrix4x4();
        m.SetColumn(0, r);
        m.SetColumn(1, u);
        m.SetColumn(2, f);
        m.SetColumn(3, new Vector4(0, 0, 0, 1));
        return m.rotation;
    }
    void InitArms()
    {
        // Right arm
        upperArmR = animator.GetBoneTransform(HumanBodyBones.RightUpperArm);
        //
    //    Debug.Log("upperArmR forward: " + upperArmR.forward);
    //    Debug.Log("upperArmR up: " + upperArmR.up);
    //    Debug.Log("upperArmR right: " + upperArmR.right);
    //    Quaternion modelR = FromBasis(
    //upperArmR.forward,
    //upperArmR.up,
    //upperArmR.right);
    //    Quaternion desiredR = FromBasis(
    //new Vector3(0, 0, -1),    // good forward
    //new Vector3(0, 1, 0),     // good up
    //new Vector3(-1, 0, 0));   // good right
    //                          //    Quaternion desiredR = FromBasis(
    //                          //new Vector3(0, 0, 1),    // good forward
    //                          //new Vector3(0, 1, 0),     // good up
    //                          //new Vector3(1, 0, 0));   // good right
    //    calibrateOffsetR = desiredR * Quaternion.Inverse(modelR);
        //calibrateOffsetR = Quaternion.Inverse(desiredR) * Quaternion.Inverse(modelR);
        //calibrateOffsetR = Quaternion.Inverse(desiredR) * modelR;
        //calibrateOffsetR = modelR * Quaternion.Inverse(desiredR);
        //calibrateOffsetR = Quaternion.Inverse(modelR) * desiredR;
        //    /////////////////////////////
        Transform lowerArmR = animator.GetBoneTransform(HumanBodyBones.RightLowerArm);
        Transform handR = animator.GetBoneTransform(HumanBodyBones.RightHand);
        rightHand = animator.GetBoneTransform(HumanBodyBones.RightHand);
        /////////////////////////////
        if (upperArmR)
        {
            Transform rightArmDriver = new GameObject("RightArmDriver").transform;
            rightArmDriver.SetParent(upperArmR.parent, false);
            rightArmDriver.localPosition = upperArmR.localPosition;
            rightArmDriver.localRotation = upperArmR.localRotation;
            upperArmRDriver = rightArmDriver; // store if you want to drive it later
            //Debug.Log($"upperArmR.localRotation: {upperArmR.localRotation.x}; {upperArmR.localRotation.y}; {upperArmR.localRotation.z}; {upperArmR.localRotation.w}");
            //upperArmRInitRot = upperArmR.localRotation * calibrateOffsetR;
            //Debug.Log($"aftercali: {upperArmRInitRot.x}; {upperArmRInitRot.y}; {upperArmRInitRot.z}; {upperArmRInitRot.w}");
            //Debug.Log("upperArmR.ToString()");
            //Debug.Log($"{upperArmR.rotation.x} {upperArmR.rotation.y} {upperArmR.rotation.z} {upperArmR.rotation.w}");
            //Debug.Log(upperArmR.localRotation.ToString());
            upperArmRInitRot = new Quaternion(0, 0, 0, 1);
        }
        //calibrateOffsetR = ComputeCalibration(upperArmRInitRot);
        /////////////////////////////

        //Debug.Log($"calibrateOffsetR: {calibrateOffsetR.x}; {calibrateOffsetR.y}; {calibrateOffsetR.z}; {calibrateOffsetR.w}");

        // Left arm
        upperArmL = animator.GetBoneTransform(HumanBodyBones.LeftUpperArm);
        Transform lowerArmL = animator.GetBoneTransform(HumanBodyBones.LeftLowerArm);
        Transform handL = animator.GetBoneTransform(HumanBodyBones.LeftHand);

        if (upperArmL)
        {
            Transform leftArmDriver = new GameObject("LeftArmDriver").transform;
            leftArmDriver.SetParent(upperArmL.parent, false);
            leftArmDriver.localPosition = upperArmL.localPosition;
            leftArmDriver.localRotation = upperArmL.localRotation;
            upperArmLDriver = leftArmDriver;
            //upperArmLInitRot = upperArmL.localRotation;
            //Debug.Log($"upperArmL.localRotation: {upperArmL.localRotation.x}; {upperArmL.localRotation.y}; {upperArmL.localRotation.z}; {upperArmL.localRotation.w}");
            //Debug.Log("upperArmL.ToString()");
            //Debug.Log($"{upperArmL.rotation.x} {upperArmL.rotation.y} {upperArmL.rotation.z} {upperArmL.rotation.w}");
            //Debug.Log(upperArmL.localRotation.ToString());
            //upperArmL.rotation = new Quaternion(- upperArmR.rotation.x, upperArmR.rotation.y, upperArmR.rotation.z, upperArmR.rotation.w);
            //upperArmL.localRotation = new Quaternion(upperArmR.localRotation.x, upperArmR.localRotation.y, upperArmR.localRotation.z, upperArmR.localRotation.w);
            upperArmLInitRot = new Quaternion(0, 0, 0, 1);
        }
        float rightArmInitYaw = upperArmR.localRotation.eulerAngles.y;
        float leftArmInitYaw = upperArmL.localRotation.eulerAngles.y;

        // Convert to [-180, 180] range
        if (rightArmInitYaw > 180f) rightArmInitYaw -= 360f;
        if (leftArmInitYaw > 180f) leftArmInitYaw -= 360f;
        yawROffset = -rightArmInitYaw;  // +4.7f for your rig
        yawLOffset = -leftArmInitYaw;   // -2.2f for your rig
        Debug.Log("Right Arm Init Yaw: " + upperArmR.localRotation.eulerAngles.y);
        Debug.Log("Left Arm Init Yaw: " + upperArmL.localRotation.eulerAngles.y);
        //upperArmR = animator.GetBoneTransform(HumanBodyBones.RightUpperArm);
        //upperArmRDriver = new GameObject("UpperArmRDriver").transform;
        //upperArmRDriver.SetParent(upperArmR.parent, false);
        //upperArmRDriver.localPosition = upperArmR.localPosition;
        //upperArmRDriver.localRotation = upperArmR.localRotation;
        //upperArmRInitRot = upperArmR.localRotation;

        //// Cache the arm's rest forward direction (in world space)
        //armRestForward = upperArmR.TransformDirection(Vector3.back);
    }
    Quaternion ComputeCalibration(Quaternion initLocalRot)
    {
        // bone forward/up in local space (bind pose)
        Vector3 f = initLocalRot * Vector3.forward;
        Vector3 u = initLocalRot * Vector3.up;

        // rotate forward only and then adjust up to reduce major tilt
        Quaternion rot1 = Quaternion.FromToRotation(f, Vector3.forward);
        Vector3 newUp = rot1 * u;
        Quaternion rot2 = Quaternion.FromToRotation(newUp, Vector3.up);

        return rot2 * rot1;
    }



    void InitEye()
    {
        leftEyeBone = animator.GetBoneTransform(HumanBodyBones.LeftEye);
        rightEyeBone = animator.GetBoneTransform(HumanBodyBones.RightEye);
        if (vrm10)
        {
            vrmLookAtTarget = new GameObject("VRMLookAtTarget").transform;
            vrmLookAtTarget.SetParent(transform, false);
            vrm10.LookAtTarget = vrmLookAtTarget;
            vrm10.LookAtTargetType = VRM10ObjectLookAt.LookAtTargetTypes.YawPitchValue;
        }
        if (!leftEyeBone || !rightEyeBone)
        {
            foreach (var t in animator.GetComponentsInChildren<Transform>())
            {
                var n = t.name.ToLower();
                if (!leftEyeBone && (n.Contains("lefteye") || n.Contains("eye.l"))) leftEyeBone = t;
                else if (!rightEyeBone && (n.Contains("righteye") || n.Contains("eye.r"))) rightEyeBone = t;
            }
        }
        if (leftEyeBone && rightEyeBone)
        {
            eyeCenter = new GameObject("EyeCenter").transform;
            eyeCenter.SetParent(leftEyeBone.parent, false);
            eyeCenter.position = (leftEyeBone.position + rightEyeBone.position) * 0.5f;
            leftEyeDriver = new GameObject("LeftEyeDriver").transform;
            leftEyeDriver.SetParent(leftEyeBone.parent, false);
            leftEyeDriver.localPosition = leftEyeBone.localPosition;
            leftEyeDriver.localRotation = leftEyeBone.localRotation;
            rightEyeDriver = new GameObject("RightEyeDriver").transform;
            rightEyeDriver.SetParent(rightEyeBone.parent, false);
            rightEyeDriver.localPosition = rightEyeBone.localPosition;
            rightEyeDriver.localRotation = rightEyeBone.localRotation;
        }
    }

    void SetMonitor()
    {

    }

    void SetVirtualMouse()
    {
        //if (WinMonitorUtil.TryGetCurrentMonitor(out monitor))
        if (WinMonitorUtil.TryGetCurrentMonitor(out var monitor1))
        {
            lastMonitorHeight = monitorHeight;
            lastMonitorWidth = monitorWidth;
            monitor = monitor1;
            monitorHeight = Math.Abs(monitor.bottom - monitor.top);
            monitorWidth = Math.Abs(monitor.right - monitor.left);
        }
        else
        {
            monitorHeight = lastMonitorHeight;
            monitorWidth = lastMonitorWidth;
        }
        //Vector2 m = Input.mousePosition;
        Vector2 mouse0 = GlobalMouse.GetPosition();
        mouse0.y = monitorHeight - mouse0.y;
        virtualMouseOriginal = mouse0;
        virtualMouseModified = mouse0;

        // 4️⃣ Normalize mouse Y within this monitor
        float mouseY01 = (mouse0.y - monitor.top) / monitorHeight;
        float mouseX01 = (mouse0.x - monitor.right) / monitorWidth;
        //Debug.Log($"{mouse0.x} {mouse0.y}, {monitorHeight}");

        // Windows Y → Unity-style Y
        mouseY01 = 1f - mouseY01;
        mouseX01 = 1f - mouseX01;

        // (optional safety)
        mouseY01 = Mathf.Clamp01(mouseY01);
        mouseX01 = Mathf.Clamp01(mouseX01);
        virtualMouseClamp = new Vector2(mouseX01, mouseY01);
        //virtualMouseOriginalRatio = new Vector2(mouseX01, mouseY01);
        // future mods go here
        // e.g. arrow keys, recoil offset

        //return mouse;
        
    }

    void ModifyVirtualMouse()
    {
        virtualMouseModified = virtualMouseOriginal;
        WinMonitorUtil.GetWindowRect(WinMonitorUtil.GetActiveWindow(), out winRect);
        Vector2 winSize = new Vector2(Math.Abs(winRect.left - winRect.right), Math.Abs(winRect.bottom - winRect.top));
        Vector2 winMiddle = new Vector2((winRect.left + winRect.right) / 2, (winRect.bottom + winRect.top) / 2);
        if (FPSmode)
        {
            virtualMouseModified.x = monitorWidth - virtualMouseOriginal.x;
        }
        if (winRect.left < virtualMouseModified.x && virtualMouseModified.x < winRect.right && winRect.top < virtualMouseModified.y && virtualMouseModified.y < winRect.bottom)
        {
            virtualMouseModifiedClamp = new Vector2(virtualMouseModified.x - winRect.left, virtualMouseModified.y - winRect.top);
        }
        else
        {
            float winSizeCot = winSize.x / winSize.y;
            float globalDistanceCot = (virtualMouseModified.x - winMiddle.x) / (virtualMouseModified.y - winMiddle.y);
            if (Math.Abs(globalDistanceCot) > winSizeCot)
            {
                int clampX = virtualMouseModified.x > winMiddle.x ? winRect.right : winRect.left;
                int clampY = (int)(clampX / globalDistanceCot);
                virtualMouseModifiedClamp = new Vector2(clampX, clampY);
            }
            else
            {
                int clampY = virtualMouseModified.y > winMiddle.y ? winRect.bottom : winRect.top;
                int clampX = (int)(clampY * globalDistanceCot);
                virtualMouseModifiedClamp = new Vector2(clampX, clampY);
            }
        }
    }
    void LateUpdate()
    {
        if (!enableMouseTracking || !mainCam || !animator) return;
        //
        SetVirtualMouse();
        //turnViaRight = isTurning ? turnViaRight : mouseX01 >= 0.5f;
        //
        //bool mouseUpper = Input.mousePosition.y > yAimTreshold;
        //bool mouseUpper = Input.mousePosition.y > yAimTreshold;
        //bool mouseUpper = mouseY01 >= 0.49f;
        Vector2 virtualMouseOriginalRatio = new Vector2(virtualMouseOriginal.x / monitorWidth, virtualMouseOriginal.y / monitorHeight);
        if (waitingTransitionState && !animator.IsInTransition(0))
        {
            waitingTransitionState = false;
            //InitArms();
        }
        FPSallow0 = false;
        if (FPSallow0)
        {
            prevState = FPSallow ? "Idle" : "not";
            FPSallow = animator.GetCurrentAnimatorStateInfo(0).IsName("Idle");
        }
        if (prevState == "Idle" && !FPSallow)
        {
            waitingTransitionState = true;
        }
        //animator.SetLayerWeight(2, FPSallow ? 1 : 0);
        bool mouseUpper = false;
        if (enableWeaponStance)
        {
            var hideHandler = GetComponent<AvatarHideHandler>();
            if (hideHandler != null && hideHandler.snappedSide == AvatarHideHandler.Side.Left)
            {
                mouseUpper = virtualMouseOriginalRatio.x >= 0.49f;
            }
            else if (hideHandler != null && hideHandler.snappedSide == AvatarHideHandler.Side.Right)
            {
                mouseUpper = virtualMouseOriginalRatio.x <= 0.51f;
            }
            else if (FPSallow)
            {
                FPSmode = virtualMouseOriginalRatio.y > 0.49f;
                if (FPSmode)
                {
                    Debug.Log("FPSMODE");
                }
                ModifyVirtualMouse();
                if (FPSmode != prevFPSMode)
                {
                    turnViaRight = virtualMouseOriginalRatio.x >= 0.5f;
                }
                prevFPSMode = FPSmode;
                mouseUpper = FPSmode;
                if (!FPSmode)
                {
                    mouseUpper = virtualMouseOriginalRatio.y > 0.49f;
                }
            }
            else
            {
                mouseUpper = virtualMouseOriginalRatio.y > 0.49f;
            }
        }

        bool isArmed = animator.GetBool("isArmed");

        if (enableWeaponStance && mouseUpper && !isArmed)
        {
            animator.SetBool("isArmed", true);
            if (gun != null)
                gun.SetActive(true);
        }
        else if ((!enableWeaponStance || !mouseUpper) && isArmed)
        {
            animator.SetBool("isArmed", false);
            if (gun != null)
                gun.SetActive(false);
        }
        DoBodyYaw();

        if (enableWeaponStance && isArmed && gun != null)
        {
            var gunAnim = gun.GetComponentInChildren<Animator>();
            if (gunAnim != null)
            {
                if (GlobalMouse.LeftMouseUp())
                {
                    gunAnim.SetTrigger("Fire");
                    StageMate.Effects.BulletHoleManager.Instance.SpawnAt(Input.mousePosition);
                }
                else if (gunAnim.HasParameter("Firing", AnimatorControllerParameterType.Bool))
                {
                    gunAnim.SetBool("Firing", GlobalMouse.LeftMouseDown());
                }
            }
        }

        ////if (GlobalMouse.LeftMouseUp() && isArmed)
        //if (GlobalMouse.LeftMouseDown() && isArmed)
        //{
        //    if (gun.GetComponentInChildren<Animator>().HasParameter("Firing", AnimatorControllerParameterType.Bool))
        //    {
        //        gun.GetComponentInChildren<Animator>().SetBool("Firing", true);
        //    }
        //    else
        //    {
        //        gun.GetComponentInChildren<Animator>().SetTrigger("Fire");
        //    }
        //    animator.SetTrigger("Fire");
        //    //bodyFire = true;
        //}
        //else if (gun.GetComponentInChildren<Animator>().HasParameter("Firing", AnimatorControllerParameterType.Bool))
        //{
        //    gun.GetComponentInChildren<Animator>().SetBool("Firing", false);
        //}
            //
            var info = animator.GetCurrentAnimatorStateInfo(0);
        var next = animator.GetNextAnimatorStateInfo(0);
        bool trans = animator.IsInTransition(0);
        if (trans) nextStateHash = next.shortNameHash;
        else { currStateHash = info.shortNameHash; nextStateHash = 0; }

        if (IsAllowed("Head")) DoHead();
        DoSpine();
        if (IsAllowed("Eye")) DoEye();
        if (isArmed)
        {
            DoArms0();
            //DoArms05();
        }
    }

    bool IsAllowed(string f)
    {
        bool? a = null, b = null;
        foreach (var t in trackingPermissions)
        {
            if (t.isParameter && animator.GetBool(t.stateOrParameterName)) return Get(t, f);
            int hash = Animator.StringToHash(t.stateOrParameterName);
            if (currStateHash == hash) a = Get(t, f);
            if (animator.IsInTransition(0) && nextStateHash == hash) b = Get(t, f);
        }
        if (animator.IsInTransition(0) && b.HasValue) return b.Value;
        return a ?? false;
    }
    bool Get(TrackingPermission e, string f) => f == "Head" ? e.allowHead : f == "Spine" ? e.allowSpine : e.allowEye;

    void DoHead()
    {
        if (!headBone || !headDriver) return;
        //var mouse = Input.mousePosition;
        //var mouse = virtualMouseModified;
        var mouse = virtualMouseModifiedClamp;
        var world = mainCam.ScreenToWorldPoint(new Vector3(mouse.x, mouse.y, mainCam.nearClipPlane));
        var dir = (world - headDriver.position).normalized;
        var localDir = headDriver.parent.InverseTransformDirection(dir);
        float yaw = Mathf.Clamp(Mathf.Atan2(localDir.x, localDir.z) * Mathf.Rad2Deg, -headYawLimit, headYawLimit);
        float pitch = Mathf.Clamp(Mathf.Asin(localDir.y) * Mathf.Rad2Deg, -headPitchLimit, headPitchLimit);
        headDriver.localRotation = Quaternion.Slerp(headDriver.localRotation, Quaternion.Euler(-pitch, yaw, 0), Time.deltaTime * headSmoothness);
        var baseRot = headBone.localRotation;
        var delta = headDriver.localRotation * Quaternion.Inverse(headInitRot);
        headBone.localRotation = Quaternion.Slerp(baseRot, delta * baseRot, headBlend);
    }
    void DoBodyYaw0DirecetionedRotate()
    {
        /////////////////////////////////////////////////////////
        ///WORKS FOR MOST PART
        float targetYaw = FPSmode ? 0f : 180f;
        float delta = Mathf.DeltaAngle(currentYaw, targetYaw);

        // Force sign based on turnViaRight
        float forcedDelta = Mathf.Abs(delta) * (turnViaRight ? -1f : 1f) * (FPSmode ? 1f : -1f);

        // New target based on forced delta
        float biasedTarget = currentYaw + forcedDelta;
        /////////////////////////////////////////////////////////
        //float targetYaw = FPSmode ? 0f : 180f;
        //float delta = Mathf.DeltaAngle(currentYaw, targetYaw);

        //// Force direction based on turnViaRight
        //float forcedDelta = Mathf.Abs(delta) * (turnViaRight ? 1f : -1f);
        //float biasedTarget = currentYaw + forcedDelta;
        if (currentYaw != targetYaw)
        {
            isTurning = true;
            //Debug.Log(currentYaw.ToString() + " " + targetYaw.ToString() + " " + forcedDelta.ToString() + " " + biasedTarget.ToString());
            Debug.Log(turnViaRight.ToString() + " " + currentYaw.ToString() + " " + targetYaw.ToString() + " " + forcedDelta.ToString() + " " + biasedTarget.ToString());
        }
        currentYaw = Mathf.SmoothDampAngle(
            currentYaw,
            biasedTarget,
            ref yawVelocity,
            0.15f // turn duration
        );
        //if (Mathf.Abs(Mathf.DeltaAngle(currentYaw, turnTargetYaw)) < 0.1f)
        //if (Mathf.Abs(Mathf.DeltaAngle(currentYaw, biasedTarget)) < 0.1f)
        if (Mathf.Abs(Mathf.DeltaAngle(currentYaw % 180, 0)) < 0.1f || Mathf.Abs(Mathf.DeltaAngle(currentYaw % 180, 180)) < 0.1f)
        {
            //currentYaw = turnTargetYaw;
            currentYaw = biasedTarget;
            yawVelocity = 0f;
            isTurning = false;
        }
        //currentYaw = Mathf.Clamp(currentYaw, 0, 180);
        transform.rotation = Quaternion.Euler(0f, currentYaw, 0f);

    }
    void DoBodyYaw()
    {
        /////////////////////////////////////////////////////////
        ///WORKS FOR MOST PART
        float targetYaw = FPSmode ? 0f : 180f;
        float delta = Mathf.DeltaAngle(currentYaw, targetYaw);

        // Force sign based on turnViaRight
        float forcedDelta = Mathf.Abs(delta) * (turnViaRight ? -1f : 1f) * (FPSmode ? 1f : -1f);

        // New target based on forced delta
        float biasedTarget = currentYaw + forcedDelta;
        /////////////////////////////////////////////////////////
        //if (currentYaw != targetYaw)
        //{
        //    isTurning = true;
        //    Debug.Log(turnViaRight.ToString() + " " + currentYaw.ToString() + " " + targetYaw.ToString() + " " + forcedDelta.ToString() + " " + biasedTarget.ToString());
        //}
        currentYaw = Mathf.SmoothDampAngle(
            currentYaw,
            biasedTarget,
            ref yawVelocity,
            0.15f // turn duration
        );
        currentYaw = Mathf.Repeat(currentYaw + 180f, 360f) - 180f;

        //currentYaw = Mathf.Clamp(currentYaw, 0, 180);
        transform.rotation = Quaternion.Euler(0f, currentYaw, 0f);

    }

    void DoBodyYaw1()
    {
        if (!isTurning)
            return;

        currentYaw = Mathf.SmoothDampAngle(
            currentYaw,
            turnTargetYaw,
            ref yawVelocity,
            turnSmoothTime
        );

        transform.rotation = Quaternion.Euler(0f, currentYaw, 0f);

        if (Mathf.Abs(Mathf.DeltaAngle(currentYaw, turnTargetYaw)) < 0.1f)
        {
            currentYaw = turnTargetYaw;
            yawVelocity = 0f;
            isTurning = false;
        }
    }
    void BeginBodyTurn()
    {
        float baseTarget = FPSmode ? 0f : 180f;

        currentYaw = Mathf.Repeat(currentYaw, 360f);

        float delta = Mathf.DeltaAngle(currentYaw, baseTarget);
        float abs = Mathf.Abs(delta);

        float signedDelta = turnViaRight ? -abs : abs;

        // Ensure we're actually moving toward the target
        if (Mathf.DeltaAngle(currentYaw + signedDelta, baseTarget) != 0f &&
            Mathf.Sign(Mathf.DeltaAngle(currentYaw + signedDelta, baseTarget)) ==
            Mathf.Sign(delta))
        {
            signedDelta = -signedDelta;
        }

        turnTargetYaw = currentYaw + signedDelta;

        yawVelocity = 0f;
        isTurning = true;
    }



    void DoSpine()
    {
        if (!spineBone || !spineDriver) return;
        float targetW = IsAllowed("Spine") ? 1f : 0f;
        spineTrackingWeight = Mathf.MoveTowards(spineTrackingWeight, targetW, Time.deltaTime * spineFadeSpeed);
        float normY = Mathf.Clamp01(Input.mousePosition.x / Screen.width);
        normY = FPSmode ? 1 - normY : normY;
        //float normY = Mathf.Clamp01(virtualMouseModified.x / Screen.width);
        //normY = FPSmode ? 0.5f : normY;
        float targetY = Mathf.Lerp(spineMinRotation, spineMaxRotation, normY);
        spineDriver.localRotation = Quaternion.Slerp(spineDriver.localRotation, Quaternion.Euler(0f, -targetY, 0f), Time.deltaTime * spineSmoothness);
        var baseRot = spineBone.localRotation;
        var delta = spineDriver.localRotation * Quaternion.Inverse(spineInitRot);
        float applied = spineTrackingWeight * spineBlend;
        var offset = Quaternion.Slerp(Quaternion.identity, delta, applied);
        spineBone.localRotation = offset * baseRot;
        if (chestBone)
            chestBone.localRotation = Quaternion.Slerp(Quaternion.identity, delta, 0.8f * applied) * chestBone.localRotation;
        if (upperChestBone)
            upperChestBone.localRotation = Quaternion.Slerp(Quaternion.identity, delta, 0.6f * applied) * upperChestBone.localRotation;
    }
    void DoArms0()
    {
        float aimDistance = 10f;
        float armPitchLimit = 30f;

        if (!upperArmR || !upperArmRDriver) return;
        var mouse = virtualMouseModifiedClamp;
        Vector3 dirR = (mainCam.ScreenToWorldPoint(new Vector3(mouse.x, mouse.y, aimDistance)) - upperArmR.position).normalized;
        Vector3 localDirR = upperArmR.parent.InverseTransformDirection(dirR);
        float yawR = yawROffset;
        float pitchR = Mathf.Clamp(-Mathf.Asin(localDirR.y) * Mathf.Rad2Deg, -armPitchLimit, armPitchLimit);
        Quaternion targetRotR = Quaternion.Euler(pitchR, yawR, 0);
        upperArmRDriver.localRotation = Quaternion.Slerp(upperArmRDriver.localRotation, targetRotR, Time.deltaTime * armSmoothness);
        Quaternion deltaR = upperArmRDriver.localRotation * Quaternion.Inverse(upperArmRInitRot);
        upperArmR.localRotation = Quaternion.Slerp(upperArmR.localRotation, deltaR * upperArmR.localRotation, armBlend);


        Vector3 dirL = (mainCam.ScreenToWorldPoint(new Vector3(mouse.x, mouse.y, aimDistance)) - upperArmL.position).normalized;
        Vector3 localDirL = upperArmL.parent.InverseTransformDirection(dirL);
        float yawL = yawLOffset;
        float pitchL = pitchR;
        Quaternion targetRotL = Quaternion.Euler(pitchL, yawL, 0);
        upperArmLDriver.localRotation = Quaternion.Slerp(upperArmLDriver.localRotation, targetRotL, Time.deltaTime * armSmoothness);
        Quaternion deltaL = upperArmLDriver.localRotation * Quaternion.Inverse(upperArmLInitRot);
        upperArmL.localRotation = Quaternion.Slerp(upperArmL.localRotation, deltaL * upperArmL.localRotation, armBlend);
    }
    void DoArms05()
    {
        float aimDistance = 10f;
        float armYawLimit = 60f;   // ±60° horizontal movement
        float armPitchLimit = 45f; // ±45° vertical movement
        if (!upperArmR || !upperArmRDriver) return;
        //var mouse = Input.mousePosition;
        //var mouse = virtualMouseModified;
        var mouse = virtualMouseModifiedClamp;
        //
        // RIGHT ARM
        Vector3 dirR = (mainCam.ScreenToWorldPoint(new Vector3(mouse.x, mouse.y, aimDistance)) - upperArmR.position).normalized;
        Vector3 localDirR = upperArmR.parent.InverseTransformDirection(dirR);
        float yawR = Mathf.Atan2(localDirR.x, localDirR.z) * Mathf.Rad2Deg;

        // Handle angle wrapping for smooth transitions
        float currentYawR = upperArmRDriver.localRotation.eulerAngles.y;
        if (currentYawR > 180f) currentYawR -= 360f; // Convert to [-180, 180]
        yawR = Mathf.Clamp(Mathf.MoveTowardsAngle(currentYawR, yawR, 180f), -armYawLimit, armYawLimit);

        float pitchR = Mathf.Clamp(-Mathf.Asin(localDirR.y) * Mathf.Rad2Deg, -armPitchLimit, armPitchLimit);
        Quaternion targetRotR = Quaternion.Euler(pitchR, yawR, 0);
        upperArmRDriver.localRotation = Quaternion.Slerp(upperArmRDriver.localRotation, targetRotR, Time.deltaTime * armSmoothness);
        Quaternion deltaR = upperArmRDriver.localRotation * Quaternion.Inverse(upperArmRInitRot);
        upperArmR.localRotation = Quaternion.Slerp(upperArmR.localRotation, deltaR * upperArmR.localRotation, armBlend);

        // LEFT ARM
        Vector3 dirL = (mainCam.ScreenToWorldPoint(new Vector3(mouse.x, mouse.y, aimDistance)) - upperArmL.position).normalized;
        Vector3 localDirL = upperArmL.parent.InverseTransformDirection(dirL);

        // For left arm, use -x to mirror the movement
        float yawL = Mathf.Atan2(-localDirL.x, localDirL.z) * Mathf.Rad2Deg;

        // Handle angle wrapping for smooth transitions
        float currentYawL = upperArmLDriver.localRotation.eulerAngles.y;
        if (currentYawL > 180f) currentYawL -= 360f; // Convert to [-180, 180]
        yawL = Mathf.Clamp(Mathf.MoveTowardsAngle(currentYawL, yawL, 180f), -armYawLimit, armYawLimit);

        float pitchL = Mathf.Clamp(-Mathf.Asin(localDirL.y) * Mathf.Rad2Deg, -armPitchLimit, armPitchLimit);
        Quaternion targetRotL = Quaternion.Euler(pitchL, yawL, 0);
        upperArmLDriver.localRotation = Quaternion.Slerp(upperArmLDriver.localRotation, targetRotL, Time.deltaTime * armSmoothness);
        Quaternion deltaL = upperArmLDriver.localRotation * Quaternion.Inverse(upperArmLInitRot);
        upperArmL.localRotation = Quaternion.Slerp(upperArmL.localRotation, deltaL * upperArmL.localRotation, armBlend);
    }
    void DoArms1()
    {
        float aimDistance = 10f;
        float armYawLimit = 1f;
        float armPitchLimit = 10f;
        if (!upperArmR || !upperArmRDriver) return;
        var mouse = Input.mousePosition;
        Vector3 dirR = (mainCam.ScreenToWorldPoint(new Vector3(mouse.x, mouse.y, aimDistance)) - upperArmR.position).normalized;
        Vector3 dirL = (mainCam.ScreenToWorldPoint(new Vector3(mouse.x, mouse.y, aimDistance)) - upperArmL.position).normalized;
        Vector3 localDirR = upperArmR.parent.InverseTransformDirection(dirR);
        Vector3 localDirL = upperArmL.parent.InverseTransformDirection(dirL);
        float yawR = Mathf.Clamp(Mathf.Atan2(localDirR.x, localDirR.z) * Mathf.Rad2Deg, -armYawLimit, armPitchLimit);
        float pitchR = Mathf.Clamp(-Mathf.Asin(localDirR.y) * Mathf.Rad2Deg, -armPitchLimit, armPitchLimit);
        float yawL = Mathf.Clamp(Mathf.Atan2(localDirL.x, localDirL.z) * Mathf.Rad2Deg, -armYawLimit, armPitchLimit);
        float pitchL = Mathf.Clamp(-Mathf.Asin(localDirL.y) * Mathf.Rad2Deg, -armPitchLimit, armPitchLimit);
        Quaternion targetRotR = Quaternion.Euler(pitchR, yawR, 0);
        Quaternion targetRotL = Quaternion.Euler(pitchR, yawR, 0);
        upperArmRDriver.localRotation = Quaternion.Slerp(upperArmRDriver.localRotation, targetRotR, Time.deltaTime * armSmoothness);
        upperArmLDriver.localRotation = Quaternion.Slerp(upperArmLDriver.localRotation, targetRotL, Time.deltaTime * armSmoothness);
        Quaternion deltaR = upperArmRDriver.localRotation * Quaternion.Inverse(upperArmRInitRot);
        Quaternion deltaL = upperArmLDriver.localRotation * Quaternion.Inverse(upperArmLInitRot);
        Quaternion targetR = calibrateOffsetR * deltaR;
        //upperArmR.localRotation = Quaternion.Slerp(upperArmR.localRotation, deltaR * upperArmR.localRotation, armBlend);
        //upperArmR.localRotation = Quaternion.Slerp(upperArmR.localRotation, deltaR * upperArmR.localRotation, armBlend) * calibrateOffsetR;
        //upperArmR.localRotation = Quaternion.Slerp(upperArmR.localRotation, targetR, armBlend);
        upperArmR.localRotation = Quaternion.Slerp(upperArmR.localRotation, targetR * upperArmR.localRotation, armBlend);
        upperArmL.localRotation = Quaternion.Slerp(upperArmL.localRotation, deltaL * upperArmL.localRotation, armBlend);
        //upperArmL.localRotation = Quaternion.Slerp(upperArmL.localRotation, deltaL * upperArmL.localRotation, armBlend) * calibrateOffset;
    }
    void DoEye()
    {
        //var mouse = Input.mousePosition;
        var mouse = virtualMouseModified;
        var world = mainCam.ScreenToWorldPoint(new Vector3(mouse.x, mouse.y, mainCam.nearClipPlane));
        if (vrm10 && vrmLookAtTarget)
        {
            vrmLookAtTarget.position = world;
            var par = vrmLookAtTarget.parent ?? transform;
            Matrix4x4 mtx = Matrix4x4.TRS(par.position, par.rotation, Vector3.one);
            var (rawYaw, rawPitch) = mtx.CalcYawPitch(world);
            float yaw = Mathf.Clamp(-rawYaw, -eyeYawLimit, eyeYawLimit);
            float pitch = Mathf.Clamp(rawPitch, -eyePitchLimit, eyePitchLimit);
            var currFwd = vrmLookAtTarget.forward;
            var tgtFwd = Quaternion.Euler(-pitch, yaw, 0f) * Vector3.forward;
            var smooth = Vector3.Slerp(currFwd, tgtFwd, Time.deltaTime * eyeSmoothness);
            vrmLookAtTarget.rotation = Quaternion.LookRotation(smooth);
            return;
        }
        if (!leftEyeBone || !rightEyeBone || !eyeCenter) return;
        eyeCenter.position = (leftEyeBone.position + rightEyeBone.position) * 0.5f;
        var dir = (world - eyeCenter.position).normalized;
        var localDir = eyeCenter.parent.InverseTransformDirection(dir);
        float eyeYaw = Mathf.Clamp(Mathf.Atan2(localDir.x, localDir.z) * Mathf.Rad2Deg, -eyeYawLimit, eyeYawLimit);
        float eyePitch = Mathf.Clamp(Mathf.Asin(localDir.y) * Mathf.Rad2Deg, -eyePitchLimit, eyePitchLimit);
        var eyeRot = Quaternion.Euler(-eyePitch, eyeYaw, 0f);
        leftEyeDriver.localRotation = Quaternion.Slerp(leftEyeDriver.localRotation, eyeRot, Time.deltaTime * eyeSmoothness);
        rightEyeDriver.localRotation = Quaternion.Slerp(rightEyeDriver.localRotation, eyeRot, Time.deltaTime * eyeSmoothness);
        leftEyeBone.localRotation = Quaternion.Slerp(leftEyeBone.localRotation, leftEyeDriver.localRotation, eyeBlend);
        rightEyeBone.localRotation = Quaternion.Slerp(rightEyeBone.localRotation, rightEyeDriver.localRotation, eyeBlend);
    }

    void OnDestroy()
    {
        Destroy(headDriver?.gameObject);
        Destroy(spineDriver?.gameObject);
        Destroy(leftEyeDriver?.gameObject);
        Destroy(rightEyeDriver?.gameObject);
        Destroy(eyeCenter?.gameObject);
        Destroy(vrmLookAtTarget?.gameObject);
        //
        Destroy(upperArmRDriver?.gameObject);
        Destroy(upperArmLDriver?.gameObject);
        Destroy(rightUpperArmBone?.gameObject);
        Destroy(leftUpperArmBone?.gameObject);
    }
}
