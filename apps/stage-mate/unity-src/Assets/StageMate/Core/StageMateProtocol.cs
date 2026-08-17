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
    }

    [Serializable]
    public class AuthMessage
    {
        public string type = "auth";
        public string token;
    }

    [Serializable]
    public class AuthSuccessMessage
    {
        public string type;
        public string sessionId;
        public string version;
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
        public string stageMode; // "tactile", "drag", "orbit", "position"
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
    public class ViewportModeUpdateMessage
    {
        public string type = "control:viewport:mode";
        public string mode;
    }

    [Serializable]
    public class LipSyncPayload
    {
        public float rms;
        public float volume;
        public string vowel; // "a", "i", "u", "e", "o"
    }

    [Serializable]
    public class LipSyncMessage
    {
        public string type = "stage:vrm:lip-sync";
        public LipSyncPayload payload;
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
    }

    [Serializable]
    public class ExpressionMessage
    {
        public string type = "stage:vrm:expression";
        public string expressionKey;
        public float weight = 1.0f;
        public float duration = 0.5f;
    }

    [Serializable]
    public class ActMessage
    {
        public string type = "stage:act";
        public string action; // "sit", "peek", "drop", "chibi", "face_zoom", "macaron", "dance"
        public string parameter;
    }
}
