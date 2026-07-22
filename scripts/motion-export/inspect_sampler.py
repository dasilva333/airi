"""
FlowMDM Diffusion Sampler Parameter Inspector & Coefficient Exporter.

Loads the pre-trained FlowMDM pipeline and exports the Gaussian Diffusion parameters
(alphas_cumprod, posterior variances, posterior mean coefficients) to diffusion_stats.json.

These stats are consumed by the browser JS client to run the 50-step DDIM sampler loop.
"""

import sys
import json

from hftrainer.pipelines.flowmdm import FlowMDMPipeline


def main():
    print("Loading pre-trained FlowMDM pipeline...")
    pipe = FlowMDMPipeline.from_pretrained(
        "ZeyuLing/hftrainer-flowmdm-humanml3d",
        device="cpu",
    )
    sampler = pipe.bundle.sampler
    diffusion = sampler.diffusion

    print(f"Diffusion num_timesteps: {diffusion.num_timesteps}")
    print(f"Model mean type: {diffusion.model_mean_type}")
    print(f"Model var type: {diffusion.model_var_type}")

    stats = {
        "betas": diffusion.betas.tolist(),
        "alphas_cumprod": diffusion.alphas_cumprod.tolist(),
        "sqrt_alphas_cumprod": diffusion.sqrt_alphas_cumprod.tolist(),
        "sqrt_one_minus_alphas_cumprod": diffusion.sqrt_one_minus_alphas_cumprod.tolist(),
        "posterior_mean_coef1": diffusion.posterior_mean_coef1.tolist(),
        "posterior_mean_coef2": diffusion.posterior_mean_coef2.tolist(),
        "posterior_variance": diffusion.posterior_variance.tolist(),
        "posterior_log_variance_clipped": diffusion.posterior_log_variance_clipped.tolist(),
    }

    out_file = "diffusion_stats.json"
    with open(out_file, "w") as f:
        json.dump(stats, f, indent=2)

    print(f"Diffusion parameters exported successfully to {out_file}!")


if __name__ == "__main__":
    main()
