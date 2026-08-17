using System;
using System.Threading.Tasks;
using UnityEngine;

namespace StageMate.Models
{
    public interface IStageModelDriver
    {
        bool IsLoaded { get; }
        GameObject ModelObject { get; }
        Transform HeadTransform { get; }
        Transform HipsTransform { get; }
        Transform LeftHandTransform { get; }
        Transform RightHandTransform { get; }

        Task<bool> LoadModelAsync(string filePath);
        void UnloadModel();

        void SetPosition(Vector3 position, Quaternion rotation, Vector3 scale);
        void SetExpression(string expressionKey, float weight);
        void SetLipSync(float rms);
        void SetGazeTarget(Vector3 targetWorldPos, bool enableSaccades, float weight);
        void ToggleChibiMode();
        bool IsChibiMode { get; }
        void ResetPosture();
    }
}
