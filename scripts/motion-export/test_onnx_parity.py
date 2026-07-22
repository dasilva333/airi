"""
FlowMDM ONNX Parity & Mathematical Verification Script.

Compares the output of the PyTorch reference pipeline against python onnxruntime
execution using the 50-step DDIM sampler loop to verify mathematical precision.
"""

import sys
import json
import torch
import numpy as np
import onnxruntime as ort

from hftrainer.pipelines.flowmdm import FlowMDMPipeline


def main():
    print("Loading pre-trained PyTorch pipeline...")
    pipe = FlowMDMPipeline.from_pretrained(
        "ZeyuLing/hftrainer-flowmdm-humanml3d",
        device="cpu",
    )

    prompt = "a person doing jumping jacks"
    print(f"Running PyTorch reference inference for prompt: '{prompt}'...")
    ref_motions = pipe.infer_t2m([prompt], [60], seed=42)
    ref_motion = ref_motions[0]

    print("\nLoading exported ONNX model...")
    session = ort.InferenceSession("flow_mdm.onnx", providers=['CPUExecutionProvider'])

    print("Encoding prompt using pipeline CLIP...")
    with torch.no_grad():
        enc_text = pipe.bundle.sampler.model.encode_text([prompt])
        clip_emb = enc_text

    clip_emb_np = clip_emb.cpu().numpy().astype(np.float32)

    with open("diffusion_stats.json", "r") as f:
        diff_stats = json.load(f)
    alphas_cumprod = np.array(diff_stats["alphas_cumprod"])

    np.random.seed(42)
    seq_len = 60
    input_dim = 263

    x = np.random.normal(size=(1, input_dim, 1, seq_len)).astype(np.float32)

    num_steps = 50
    timesteps = [int(np.round(999 - i * (999 / (num_steps - 1)))) for i in range(num_steps)]

    print("Running 50-step DDIM loop in Python via ONNX Runtime...")
    for step in range(num_steps):
        t_val = timesteps[step]
        s_val = 0 if step == num_steps - 1 else timesteps[step + 1]

        feeds = {
            "noisy_motion": x,
            "timestep": np.array([t_val], dtype=np.int64),
            "clip_embedding": clip_emb_np,
            "guidance_scale": np.array([2.5], dtype=np.float32),
        }

        results = session.run(None, feeds)
        pred_xstart = results[0]

        alpha_t = alphas_cumprod[t_val]
        alpha_s = alphas_cumprod[s_val]

        sqrt_alpha_t = np.sqrt(alpha_t)
        sqrt_alpha_s = np.sqrt(alpha_s)
        sqrt_one_minus_alpha_t = np.sqrt(1.0 - alpha_t)
        sqrt_one_minus_alpha_s = np.sqrt(1.0 - alpha_s)

        eps = (x - sqrt_alpha_t * pred_xstart) / sqrt_one_minus_alpha_t
        x = (sqrt_alpha_s * pred_xstart + sqrt_one_minus_alpha_s * eps).astype(np.float32)

    mean = np.load("Mean.npy")
    std = np.load("Std.npy")

    motion_norm = x[0, :, 0, :].T
    motion_denorm = motion_norm * std + mean

    print("\n--- Numerical Parity Comparison ---")
    print(f"Reference Hips Height (Frame 0):  {ref_motion[0][3]:.6f}")
    print(f"ONNX DDIM Hips Height (Frame 0):   {motion_denorm[0][3]:.6f}")
    print(f"Difference:                        {abs(ref_motion[0][3] - motion_denorm[0][3]):.6f}")

    mse = np.mean((ref_motion - motion_denorm) ** 2)
    print(f"Overall Feature MSE:              {mse:.6f}")

    if mse < 0.1:
        print("\nSUCCESS: ONNX DDIM execution matches PyTorch pipeline!")
    else:
        print("\nWARNING: High MSE discrepancy detected.")


if __name__ == "__main__":
    main()
