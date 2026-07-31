"""
FlowMDM PyTorch-to-ONNX Exporter for AIRI WebGPU Inference.

Exports the FlowMDM pre-trained checkpoint (ZeyuLing/hftrainer-flowmdm-humanml3d)
to a self-contained ONNX binary (flow_mdm.onnx) for in-browser execution via
onnxruntime-web / WebGPU.

Key Features & Monkeypatches:
1. Sinusoidal/BPE Position Embedding Type Mismatch Patch:
   Casts position arange tensors to float32 to prevent ONNX Runtime WebGPU
   Einsum type binding crashes (int64 vs float32).
2. Guidance Scale Classifier-Free Guidance (CFG):
   Embeds CFG directly into the computational graph so ONNX execution automatically
   computes: out = uncond + scale * (cond - uncond).
3. In-Memory Weight Serialization:
   Forces PyTorch to inline all weight tensors into a single standalone binary (flow_mdm.onnx)
   rather than external .data files, bypassing browser CORS / MountedFiles sandbox blocks.
"""

import sys
import os
import io

import torch
import torch.nn as nn
from hftrainer.pipelines.flowmdm import FlowMDMPipeline
from hftrainer.models.motion.flowmdm.network.model.x_transformers.x_transformers import (
    BPE_Rotary,
    ScaledSinusoidalEmbedding,
    exists,
    einsum,
)

# Monkeypatch BPE_Rotary to prevent ONNX Einsum type mismatch crash
def patched_bpe_rotary_forward(self, seq_len, device, timesteps, training, pe_bias, **kwargs):
    freqs_rel, _ = self.relative.forward(seq_len, device, **kwargs)
    freqs_rel = freqs_rel.unsqueeze(0)
    w = self.schedule.get_time_weights(timesteps, training).unsqueeze(-1).unsqueeze(-1)
    w = w.to(dtype=freqs_rel.dtype)  # Cast to match floating point precision
    freqs = w * freqs_rel
    return freqs, 1.0

BPE_Rotary.forward = patched_bpe_rotary_forward

# Monkeypatch ScaledSinusoidalEmbedding to cast position arange to float32
def patched_scaled_sinusoidal_forward(self, x, pos=None):
    seq_len, device = x.shape[1], x.device
    if not exists(pos):
        pos = torch.arange(seq_len, device=device)
    pos = pos.to(dtype=self.inv_freq.dtype)
    emb = einsum('i, j -> i j', pos, self.inv_freq)
    emb = torch.cat((emb.sin(), emb.cos()), dim=-1)
    return emb * self.scale

def patched_scaled_sinusoidal_forward_seqlen(self, seq_len, device):
    pos = torch.arange(seq_len, device=device)
    pos = pos.to(dtype=self.inv_freq.dtype)
    emb = einsum('i, j -> i j', pos, self.inv_freq)
    emb = torch.cat((emb.sin(), emb.cos()), dim=-1)
    return emb * self.scale

ScaledSinusoidalEmbedding.forward = patched_scaled_sinusoidal_forward
ScaledSinusoidalEmbedding.forward_seqlen = patched_scaled_sinusoidal_forward_seqlen


class FlowMDMONNXWrapper(nn.Module):
    def __init__(self, base_model):
        super().__init__()
        self.model = base_model

    def forward_base(self, x, timesteps, clip_embedding):
        bs, njoints, nfeats, nframes = x.shape

        # 1. Project clip_embedding to latent_dim
        text_emb = self.model.embed_text(clip_embedding)  # [bs, latent_dim]
        text_emb = text_emb.unsqueeze(0).expand(nframes, -1, -1)  # [nframes, bs, latent_dim]

        # 2. Compute time embedding
        time_emb = self.model.embed_timestep(timesteps)  # [1, bs, latent_dim]

        # Combined condition embedding
        emb = time_emb + text_emb

        # 3. Input Process
        x_emb = self.model.input_process(x)  # [seq_len, bs, latent_dim]

        # 4. Transformer Encoder
        x_emb, emb = x_emb.permute(1, 0, 2), emb.permute(1, 0, 2)
        mask = torch.ones((bs, nframes), dtype=torch.bool, device=x.device)

        rotary_kwargs = {
            'timesteps': timesteps,
            'pos_pe_abs': None,
            'training': False,
            'pe_bias': None
        }

        output = self.model.seqTransEncoder(
            x_emb,
            mask=mask,
            cond_tokens=emb,
            attn_bias=None,
            rotary_kwargs=rotary_kwargs,
            chunked_attn=False
        )
        output = output.permute(1, 0, 2)  # [seq_len, bs, latent_dim]

        # 5. Output Process
        return self.model.output_process(output)  # [bs, 263, 1, seq_len]

    def forward(self, x, timesteps, clip_embedding, guidance_scale):
        # Conditional pass
        out_cond = self.forward_base(x, timesteps, clip_embedding)
        # Unconditional pass (zero-filled condition mask)
        out_uncond = self.forward_base(x, timesteps, torch.zeros_like(clip_embedding))
        # Classifier-Free Guidance (CFG)
        return out_uncond + guidance_scale * (out_cond - out_uncond)


def main():
    print("Loading pre-trained FlowMDM pipeline...")
    pipe = FlowMDMPipeline.from_pretrained(
        "ZeyuLing/hftrainer-flowmdm-humanml3d",
        device="cpu",
    )
    base_model = pipe.bundle.sampler.model.model

    wrapper = FlowMDMONNXWrapper(base_model)
    wrapper.eval()

    print("Testing wrapper forward pass with dummy inputs...")
    x = torch.randn(1, 263, 1, 60)
    timesteps = torch.tensor([500], dtype=torch.long)
    clip_embedding = torch.randn(1, 512)
    guidance_scale = torch.tensor([2.5], dtype=torch.float32)

    buffer = io.BytesIO()

    print("Exporting ONNX model to memory buffer...")
    torch.onnx.export(
        wrapper,
        (x, timesteps, clip_embedding, guidance_scale),
        buffer,
        input_names=['noisy_motion', 'timestep', 'clip_embedding', 'guidance_scale'],
        output_names=['denoised_motion'],
        dynamic_axes={
            'noisy_motion': {3: 'seq_len'},
            'denoised_motion': {3: 'seq_len'}
        },
        opset_version=18
    )

    onnx_path = "flow_mdm.onnx"
    print(f"Writing self-contained ONNX binary to {onnx_path}...")
    with open(onnx_path, "wb") as f:
        f.write(buffer.getvalue())

    print(f"ONNX model exported successfully: {onnx_path}")


if __name__ == "__main__":
    main()
