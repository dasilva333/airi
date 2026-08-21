using System;
using System.Collections.Generic;
using UnityEngine;

namespace StageMate.Core
{
    [Serializable]
    public class WireEnvelope
    {
        public string type;
        public string token;
        public string modelId;
        public string path;
        public string mode;
        public string sessionId;
        public string error;
        public WireData data;
    }

    [Serializable]
    public class WireData
    {
        public bool enabled;
        public bool authenticated;
        public string mode;
        public string modelPath;
        public string modelId;
        public string preset;
        public string weapon;
        public string text;
        public bool isActive;
        public string speaker;
        public bool clear;
        public string expression;
        public string name;
        public float weight;
        public float durationMs;
        public bool isFixed;
        public float rms;
        public float x;
        public float y;
        public bool isDown;
        public bool down;
        public float scale;
        public string[] idleAnimations;
        public WireMacaronMaterials materials;
        public string shell;
        public string whip;
        public string heart;
        public WireSyncWindow window;
        public WireSyncModel model;
        public WireSyncPositioning positioning;
        public WireSyncViewport viewport;
        public WireSyncStage stage;
    }

    [Serializable]
    public class WireMacaronMaterials
    {
        public string shell;
        public string whip;
        public string heart;
    }

    [Serializable]
    public class WireSyncWindow
    {
        public int x;
        public int y;
        public int width;
        public int height;
        public bool alwaysOnTop;
    }

    [Serializable]
    public class WireSyncModel
    {
        public string modelId;
        public string modelPath;
    }

    [Serializable]
    public class WireSyncPositioning
    {
        public float x;
        public float y;
        public float scale;
    }

    [Serializable]
    public class WireSyncViewport
    {
        public string mode;
    }

    [Serializable]
    public class WireSyncStage
    {
        public bool enabled;
    }

    [Serializable]
    public class AuthMessage
    {
        public string type = "module:authenticate";
        public AuthData data;
    }

    [Serializable]
    public class AuthData
    {
        public string token;
        public string caller = "stage-mate";
    }

    [Serializable]
    public class Vector3Dto
    {
        public float x;
        public float y;
        public float z;

        public Vector3 ToVector3() => new Vector3(x, y, z);
        public static Vector3Dto FromVector3(Vector3 v) => new Vector3Dto { x = v.x, y = v.y, z = v.z };
    }

    [Serializable]
    public class WindowBoundsDto
    {
        public int x;
        public int y;
        public int width;
        public int height;
    }

    [Serializable]
    public class ModelTransformDto
    {
        public Vector3Dto position;
        public Vector3Dto rotation;
        public Vector3Dto scale;
    }

    [Serializable]
    public class StateSyncPayload
    {
        public string currentModelPath;
        public string activeModelId;
        public string stageMode;
        public WindowBoundsDto windowBounds;
        public ModelTransformDto modelTransform;
        public bool isVisible = true;
        public bool lookAtEnabled = false;
        public float headFollowWeight = 0.7f;
        public float eyeFollowWeight = 1.0f;
    }

    [Serializable]
    public class StateSyncMessage
    {
        public string type = "stage:state:sync";
        public StateSyncPayload payload;
        public WireData data;
    }

    [Serializable]
    public class ModelPositionUpdateMessage
    {
        public string type = "stage:model:position";
        public string modelId;
        public Vector3Dto position;
        public Vector3Dto rotation;
        public Vector3Dto scale;
    }

    [Serializable]
    public class WindowBoundsUpdateMessage
    {
        public string type = "stage:window:bounds";
        public WindowBoundsDto bounds;
    }

    [Serializable]
    public class LipSyncPayload
    {
        public float rms;
    }

    [Serializable]
    public class LipSyncMessage
    {
        public string type = "stage:vrm:lip-sync";
        public LipSyncPayload payload;
        public WireData data;
    }

    [Serializable]
    public class GazePayload
    {
        public Vector3Dto target;
        public bool enableSaccades = true;
        public float weight = 1.0f;
    }

    [Serializable]
    public class GazeMessage
    {
        public string type = "stage:vrm:gaze";
        public GazePayload payload;
        public WireData data;
    }

    [Serializable]
    public class ActMessage
    {
        public string type = "stage:act";
        public string action;
        public string parameter;
    }
}
