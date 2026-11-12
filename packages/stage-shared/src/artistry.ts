import { defineInvokeEventa } from '@moeru/eventa'

/** Shared defaults for the independent OpenAI Images provider in settings and the desktop runtime. */
export const OPENAI_IMAGE_DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1/',
  model: 'gpt-image',
} as const

/** Shared defaults for the Cloudflare Workers AI image provider. */
export const CLOUDFLARE_IMAGE_DEFAULTS = {
  model: '@cf/black-forest-labs/flux-1-schnell',
  steps: 4,
} as const

export interface CloudflareImageModelMeta {
  label: string
  value: string
  description?: string
  format: 'multipart' | 'json'
  fixedSteps?: number
  defaultSteps?: number
  maxSteps?: number
  neuronEstimate?: string
}

export const CLOUDFLARE_IMAGE_MODELS: readonly CloudflareImageModelMeta[] = [
  {
    label: 'FLUX.1 Schnell (Recommended / 4-step)',
    value: '@cf/black-forest-labs/flux-1-schnell',
    description: 'Fast 4-step generation, lowest compute usage (~57.6 neurons/img)',
    format: 'json',
    defaultSteps: 4,
    maxSteps: 8,
    neuronEstimate: '~57.6 neurons / img (Recommended · ~173 imgs/day free)',
  },
  {
    label: 'FLUX.2 Klein 4B (Fast / Fixed 4-step)',
    value: '@cf/black-forest-labs/flux-2-klein-4b',
    description: 'Fast distilled generation and multi-reference editing with fixed 4 steps',
    format: 'multipart',
    fixedSteps: 4,
    defaultSteps: 4,
    maxSteps: 4,
    neuronEstimate: '~104 neurons / img (~95 imgs/day free)',
  },
  {
    label: 'FLUX.2 Klein 9B (High Quality / Fixed 4-step)',
    value: '@cf/black-forest-labs/flux-2-klein-9b',
    description: 'Larger Klein variant with improved quality and fixed 4 steps',
    format: 'multipart',
    fixedSteps: 4,
    defaultSteps: 4,
    maxSteps: 4,
    neuronEstimate: '~1,364 neurons / img (~7 imgs/day free)',
  },
  {
    label: 'FLUX.2 Dev (Detailed Photorealism)',
    value: '@cf/black-forest-labs/flux-2-dev',
    description: 'Detailed, realistic generation with multi-reference image support',
    format: 'multipart',
    defaultSteps: 20,
    maxSteps: 50,
    neuronEstimate: '~3,000 neurons / img at 20 steps (~3 imgs/day free)',
  },
  {
    label: 'Leonardo Lucid Origin (Stylized & Graphic)',
    value: '@cf/leonardo/lucid-origin',
    description: 'Prompt adherence, sharp graphic design, and accurate text rendering',
    format: 'json',
    defaultSteps: 20,
    maxSteps: 50,
    neuronEstimate: 'Leonardo partner model · Design & typography',
  },
  {
    label: 'Leonardo Phoenix 1.0 (Typography & Adherence)',
    value: '@cf/leonardo/phoenix-1.0',
    description: 'Strong prompt adherence and coherent text generation within images',
    format: 'json',
    defaultSteps: 20,
    maxSteps: 50,
    neuronEstimate: 'Leonardo partner model · Prompt adherence',
  },
  {
    label: 'SDXL Lightning (ByteDance / 4-step)',
    value: '@cf/bytedance/stable-diffusion-xl-lightning',
    description: 'Ultra-fast 4-step SDXL variant',
    format: 'json',
    defaultSteps: 4,
    maxSteps: 8,
    neuronEstimate: 'ByteDance fast 4-step SDXL',
  },
  {
    label: 'SDXL Base 1.0 (Stability AI)',
    value: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    description: 'Foundational Stable Diffusion XL model',
    format: 'json',
    defaultSteps: 20,
    maxSteps: 50,
    neuronEstimate: 'Stability AI foundational model',
  },
  {
    label: 'DreamShaper 8 LCM (Photorealistic LCM)',
    value: '@cf/lykon/dreamshaper-8-lcm',
    description: 'Fine-tuned Stable Diffusion LCM with photorealistic styling',
    format: 'json',
    defaultSteps: 8,
    maxSteps: 20,
    neuronEstimate: 'Lykon DreamShaper Latent Consistency Model',
  },
] as const

export function isCloudflareMultipartModel(model: string): boolean {
  return model.includes('flux-2')
}

export function isCloudflareFixedStepsModel(model: string): boolean {
  return model.includes('klein')
}

export function isCloudflareOmitDimensionsModel(model: string): boolean {
  return model.includes('flux-1-schnell')
}

export function getCloudflareModelDefaultSteps(model: string): number {
  if (isCloudflareFixedStepsModel(model))
    return 4
  const found = CLOUDFLARE_IMAGE_MODELS.find(m => m.value === model)
  if (found?.defaultSteps)
    return found.defaultSteps
  if (model.includes('flux-1-schnell') || model.includes('lightning'))
    return 4
  if (model.includes('dreamshaper'))
    return 8
  if (model.includes('flux-2-dev') || model.includes('leonardo') || model.includes('stable-diffusion-xl-base'))
    return 20
  return 4
}

export const artistryGenerateHeadless = defineInvokeEventa<{ imageUrl?: string, base64?: string, error?: string }, { prompt: string, model?: string, provider?: string, options?: Record<string, any>, globals?: Record<string, any> }>('eventa:invoke:electron:artistry:generate-headless')

export const artistryComfyHealthCheck = defineInvokeEventa<{ gpus: string, vramStr: string }, { url: string }>('eventa:invoke:electron:artistry:comfy-health-check')

export const REPLICATE_IMAGEGEN_PRESETS = [
  {
    id: 'prunaai/p-image',
    label: 'p-image',
    cost: '$1 / 200 imgs',
    prompt: 'A high-quality anime-style illustration with professional shading, vibrant colors, hand-drawn aesthetic, highly detailed,',
    preset: {
      aspect_ratio: '16:9',
    },
  },
  {
    id: 'prunaai/z-image-turbo',
    label: 'z-turbo',
    cost: '$1 / 200 imgs',
    prompt: 'A highly detailed anime illustration, crisp lines, vibrant color palette, professional digital art style, nicely shaded,',
    preset: {
      width: 1024,
      height: 768,
      output_format: 'jpg',
      guidance_scale: 0,
      output_quality: 80,
      num_inference_steps: 8,
    },
  },
  {
    id: 'black-forest-labs/flux-schnell',
    label: 'flux-schnell',
    cost: '$1 / 333 imgs',
    prompt: 'A stunning, high-definition anime scene, professional cel-shading, vibrant atmosphere, hand-drawn quality,',
    preset: {
      go_fast: true,
      num_outputs: 1,
      aspect_ratio: '1:1',
      output_format: 'webp',
      output_quality: 80,
    },
  },
  {
    id: 'prunaai/z-image-turbo-lora:197b2db2015aa366d2bc61a941758adf4c31ac66b18573f5c66dc388ab081ca2',
    label: 'z-turbo-lora',
    cost: '$1 / 217 imgs',
    prompt: 'A beautifully rendered anime illustration in a classic hand-drawn style, rich textures, vibrant colors, masterpiece quality,',
    preset: {
      width: 1024,
      height: 1024,
      lora_scales: [1],
      lora_weights: ['https://huggingface.co/renderartist/Technically-Color-Z-Image-Turbo/resolve/main/Technically_Color_Z_Image_Turbo_v1_renderartist_2000.safetensors'],
      output_format: 'jpg',
      guidance_scale: 0,
      output_quality: 80,
      num_inference_steps: 8,
    },
  },
  {
    id: 'aisha-ai-official/wai-nsfw-illustrious-v11:c1d5b02687df6081c7953c74bcc527858702e8c153c9382012ccc3906752d3ec',
    label: 'wai-ilx',
    cost: '$1 / 151 imgs',
    prompt: 'high quality, masterpiece, hirez, absurdres, anime style, highly detailed, vibrant colors, aesthetic,',
    preset: {
      vae: 'default',
      seed: -1,
      model: 'WAI-NSFW-illustrious-SDXL-v11',
      steps: 30,
      width: 1024,
      height: 1024,
      cfg_scale: 7,
      clip_skip: 2,
      pag_scale: 3,
      scheduler: 'Euler a',
      batch_size: 1,
      negative_prompt: 'nsfw, naked',
      guidance_rescale: 0.5,
      prepend_preprompt: true,
    },
  },
  {
    id: 'aisha-ai-official/anillustrious-v4:80441e2c32a55f2fcf9b77fa0a74c6c86ad7deac51eed722b9faedb253265cb4',
    label: 'anillustrious',
    cost: '$1 / 188 imgs',
    prompt: 'high quality, masterpiece, hirez, absurdres, anime style, detailed background, atmospheric, beautifully shaded,',
    preset: {
      vae: 'default',
      seed: -1,
      model: 'Anillustrious-v4',
      steps: 30,
      width: 1024,
      height: 1024,
      refiner: false,
      upscale: 'Original',
      cfg_scale: 7,
      clip_skip: 2,
      pag_scale: 0,
      scheduler: 'Euler a beta',
      adetailer_face: false,
      adetailer_hand: false,
      refiner_prompt: '',
      negative_prompt: 'nsfw, naked',
      adetailer_person: false,
      guidance_rescale: 1,
      refiner_strength: 0.8,
      prepend_preprompt: true,
      prompt_conjunction: true,
      adetailer_face_prompt: '',
      adetailer_hand_prompt: '',
      adetailer_person_prompt: '',
      negative_prompt_conjunction: false,
      adetailer_face_negative_prompt: '',
      adetailer_hand_negative_prompt: '',
      adetailer_person_negative_prompt: '',
    },
  },
]

export const REPLICATE_IMAGEEDIT_PRESETS = [
  {
    id: 'prunaai/p-image-edit',
    label: 'P-Image-Edit (Texture Swapper)',
    cost: 'Turbo',
    prompt: 'The woman\'s dress is changed to black',
    preset: {
      turbo: true,
      images: [{ value: '{{IMAGE}}' }],
      aspect_ratio: '1:1',
    },
  },
]
export const ARTISTRY_PRESET_GROUPS = [
  {
    id: 'fabrics',
    label: 'Fabric Lab',
    icon: 'i-solar:palette-bold-duotone',
    presets: [
      { id: 'gold', label: 'Gold Leaf', icon: 'i-solar:star-bold-duotone', text: 'Divine Golden transformation. Pure white velvet fabric with thick 24k gold leaf embroidery and glowing white celestial patterns.' },
      { id: 'gothic', label: 'Midnight Gothic', icon: 'i-solar:ghost-bold-duotone', text: 'Midnight Gothic style. Deep matte black fabric, crimson lace ruffles, dark leather straps, silver scrollwork embroidery.' },
      { id: 'royal', label: 'Royal Porcelain', icon: 'i-solar:crown-minimalistic-bold-duotone', text: 'Royal Porcelain style. White silk base, hand-painted cobalt blue patterns, golden silk sashes, jade ornaments.' },
      { id: 'denim', label: 'Raw Indigo Denim', icon: 'i-solar:t-shirt-bold-duotone', text: 'Heavyweight dark indigo denim with thick orange contrast stitching and realistic weathered fading.' },
      { id: 'plaid', label: 'Classic Tartan Plaid', icon: 'i-solar:widget-bold-duotone', text: 'Traditional red and green Scottish wool plaid with a visible woven texture and cozy feel.' },
      { id: 'satin', label: 'Powder Blue Satin', icon: 'i-solar:water-drops-bold-duotone', text: 'Highly reflective, pale baby blue silk with smooth flowing "liquid" highlights and high luster.' },
      { id: 'hex', label: 'Tactical Hex-Grid', icon: 'i-solar:shield-bold-duotone', text: 'Matte olive drab fabric with a subtle hexagonal heat-pressed grid pattern and dark grey utility straps.' },
      { id: 'camo', label: 'Cyber Pink Camo', icon: 'i-solar:skateboarding-bold-duotone', text: 'Vibrant hot pink and charcoal grey urban camouflage with a slight tech-fabric sheen.' },
    ],
  },
  {
    id: 'hair',
    label: 'Hair Salon',
    icon: 'i-solar:scissors-bold-duotone',
    presets: [
      { id: 'silver', label: 'Iridescent Silver', icon: 'i-solar:snowflake-bold-duotone', text: 'Pure white hair with subtle prismatic "oil-slick" highlights that catch the light.' },
      { id: 'onyx', label: 'Onyx Gloss', icon: 'i-solar:moon-bold-duotone', text: 'Pitch black hair with a high-mirror shine and sharp, high-contrast highlights.' },
      { id: 'sunset', label: 'Sunset Ombre', icon: 'i-solar:sun-2-bold-duotone', text: 'Vibrant gradient from deep copper roots to fiery orange and golden blonde tips.' },
      { id: 'mint', label: 'Ghost Mint', icon: 'i-solar:leaf-bold-duotone', text: 'Soft, matte pastel mint green with a "cloud-like" ethereal texture.' },
      { id: 'pink', label: 'Bubblegum Pop', icon: 'i-solar:heart-bold-duotone', text: 'High-gloss, vibrant candy pink with a plastic-like shine and white "rim" highlights.' },
      { id: 'rainbow', label: 'Retrowave Rainbow', icon: 'i-solar:filters-bold-duotone', text: 'Multi-colored "raver girl" hair; dark roots with glowing neon streaks of cyan, magenta, and lime green.' },
    ],
  },
  {
    id: 'eyes',
    label: 'Iris Forge',
    icon: 'i-solar:eye-bold-duotone',
    presets: [
      { id: 'dragon', label: 'Dragon Slit', icon: 'i-solar:fire-bold-duotone', text: 'Glowing orange irises with vertical black slit pupils and a subtle reptilian texture.' },
      { id: 'heart', label: 'Succubus Heart', icon: 'i-solar:heart-angle-bold-duotone', text: 'Soft pink irises with glowing white heart-shaped pupils and a "love-struck" aura.' },
      { id: 'star', label: 'Celestial Star', icon: 'i-solar:star-fall-bold-duotone', text: 'Deep violet eyes with white star-shaped pupils and a subtle ring of stardust.' },
      { id: 'galaxy', label: 'Nebula Galaxy', icon: 'i-solar:atom-bold-duotone', text: 'Deep space irises containing tiny sparkling stars and purple nebula clusters.' },
      { id: 'cyber-eye', label: 'Cyber Scan', icon: 'i-solar:scanner-2-bold-duotone', text: 'Glowing cyan HUD-style eyes with digital scanning rings and data-stream pupils.' },
    ],
  },
  {
    id: 'special',
    label: 'Special Motifs',
    icon: 'i-solar:magic-stick-bold-duotone',
    presets: [
      { id: 'lotus', label: 'Argent Lotus', icon: 'i-solar:flower-bold-duotone', text: 'The Argent Lotus motif. Translucent white silk petal layers over heavy silver brocade, with delicate silver filigree lotus accents.' },
    ],
  },
]

export const POLLINATIONS_DEFAULT_MODELS = [
  { id: '', name: 'Free Router (Pollinations Auto)', description: 'Fastest available free cluster node' },
  { id: 'flux', name: 'FLUX.1 Schnell', description: 'Fast, high-quality images at a tiny cost', price: '0.002 pollen' },
  { id: 'gptimage-large', name: 'GPT Image 1.5', description: 'High-fidelity image generation with fine detail', price: '0.000024 pollen' },
  { id: 'nanobanana-pro', name: 'Nano Banana Pro', description: 'Studio-quality images up to 4K with reasoning', price: '0.00012 pollen' },
  { id: 'seedream-pro', name: 'Seedream 4.5', description: 'Premium photorealism for lifelike scenes and portraits', price: '0.04 pollen' },
  { id: 'kontext', name: 'FLUX.1 Kontext Pro', description: 'Edits an existing image from plain instructions', price: '0.03 pollen' },
  { id: 'MarcosFRG/sdxl-lightning', name: 'SDXL Lightning', description: 'Ultra-fast distilled text-to-image in 1-8 steps', price: '0.0014 pollen' },
  { id: 'MarcosFRG/flux-2-klein-4b', name: 'FLUX.2 Klein 4B', description: 'Sub-second text-to-image transformer', price: '0.0025 pollen' },
]
