# PROPOSAL: Director-Led Regional Orchestration (Spatial Vision)

## Objective
Upgrade the AIRI Director LLM from a "Flat Prompt" generator to a "Spatial Scene Architect" capable of designing complex, multi-panel, and regionally conditioned visual compositions without breaking the generic, model-agnostic nature of the AIRI platform.

## 1. The Core Architecture: The "Regional Resolver" Node
To avoid "Rube Goldberg" deadlocks and maintain generic compatibility with any workflow, we introduce a custom ComfyUI node that acts as the bridge between the LLM's vision and the image engine.

- **Class Name**: `AIRIRegionalResolver`
- **Inputs**:
    - `text`: A JSON string from the Director (containing layout, narrative actions, and weights).
    - `clip`: The CLIP model from the user's workflow.
    - `model`: The Diffusion model from the user's workflow.
- **Internal Logic**:
    - Parses the Layout JSON.
    - Internally executes the equivalent of `CLIPTextEncode` and `ConditioningSetArea` for each zone defined in the JSON.
    - Performs a "Conditioning Combine" chain to merge all regional zones with a global scene prompt.
- **Output**: A single `CONDITIONING` object, compatible with any standard KSampler.

## 2. Automatic Mode Inference (Zero-UI Selection)
AIRI will automatically determine the "Intelligence Level" required for a generation by observing the architecture of the user's uploaded workflow.

- **Detection**: When a user selects a node as the "Director's Input" during workflow setup, AIRI inspects its `class_type`.
- **Simple Mode (`CLIPTextEncode`)**:
    - Director LLM is given a standard "Flat Prompt" system prompt.
    - Output is a single string injected into the node's `text` property.
- **Rich Mode (`AIRIRegionalResolver`)**:
    - Director LLM is given the "Spatial Vision Handbook" (0-100 grid system, JSON schema).
    - Output is a Layout JSON string injected into the node's `text` property.

## 3. Persona & Outfit Decoupling
To ensure narrative persistence, the system separates a character's physical identity from their contextual wardrobe.

- **Director's Perspective**: The LLM works with character keys (e.g., `"subject": "kanjira"`) and describes "Contextual Outfits" (e.g., `"outfit": "a vibrant blue bikini"`).
- **Identity Injection (The UI Hook)**: Before sending the JSON to ComfyUI, the AIRI Frontend intercepts the JSON and replaces the character keys with the full "Base Identity" prompt from the character's persona card (hair color, skin tone, signature features).
- **Benefit**: The Director can "re-dress" characters for any scene while maintaining perfect visual continuity of their core traits.

## 4. Spatial Reasoning (The 0-100 Grid)
The Director designs scenes using a normalized coordinate system to remain independent of specific resolutions.

- **Grid**: 0-100% based (Top-Left 0,0).
- **Aspect Ratio Awareness**: Director is informed of the target shape (`wide`, `tall`, or `square`) and adjusts the bounding boxes (BBoxes) to fit cinematic conventions (e.g., side-by-side splits for tall, comic panels for wide).
- **Multi-Zone Support**: Handles asymmetrical splits and "reaction box" overlays dynamically.

## 5. Summary of Benefits
- **No Deadlocks**: The generation happens entirely within the standard ComfyUI execution loop.
- **Generic & Extensible**: Works with any model or LoRA provided by the user.
- **Clean UI**: No extra toggles or "expert modes" required; the system infers capabilities from the workflow.
- **Cinematic Control**: Empowers the AI to tell stories across a single canvas using sophisticated visual layering.

## 5.5 When This System Is Necessary vs. Overkill

The value of this entire system — regional orchestration, concept enrichment, identity injection — depends heavily on **training corpus saturation**: how well the underlying image model already knows who your character is.

### High Corpus Saturation — Flat Prompt Is Fine
Well-established characters from popular IP (e.g. Asuka, Misato from NGE) exist in the model's training data thousands of times over. The model has a strong, stable internal representation of what they look like. A flat prompt like `"Asuka Langley in a red plugsuit"` reliably produces a consistent, recognizable result. Regional tech here is overkill — you're engineering around a problem that doesn't exist.

### Low Corpus Saturation — Regional Tech Is Required
Original characters or obscure OCs (e.g. Kanjira, 37) have no meaningful presence in any model's training data. Without anchoring, the model will drift — different hair, different build, wrong vibe — on every generation. A flat prompt will produce something, just never the same something twice. This is where the regional resolver + concept enrichment pipeline pays off: it compensates for what the model wasn't trained on by explicitly injecting the visual spec at generation time.

### Practical Takeaway
This system is not a universal upgrade to the image pipeline — it is a targeted solution for **character consistency in low-saturation scenarios**. If you're working exclusively with well-known IP, a good flat prompt and a reliable workflow is genuinely sufficient. The moment you introduce original characters with a specific, non-negotiable look, this system stops being optional.

## 6. Resource & Reference Paths

### Core Director Engine (Prototypes)
- **Engine Directory**: `e:\CUIPP\comfyGalleryAppBackend\scripts\director_engine\`
- **Workflow Generator**: `e:\CUIPP\comfyGalleryAppBackend\scripts\director_engine\generateZoneWorkflow.js`
- **Integrated Pipeline**: `e:\CUIPP\comfyGalleryAppBackend\scripts\director_engine\generate_scene.js`
- **Stress Test Script**: `e:\CUIPP\comfyGalleryAppBackend\scripts\director_layout_stress_test.js`

### Reference Workflows & Data
- **Manual Regional Reference**: `C:\Users\h4rdc\Documents\Github\coding-agent\VRMs\Project-Mint-2\vertical-kanjira-37.json`
- **Mock Scene Blueprint**: `e:\CUIPP\comfyGalleryAppBackend\scripts\director_engine\mock_scene.json`
- **4-Way Quadrant Blueprint**: `e:\CUIPP\comfyGalleryAppBackend\scripts\director_engine\4way_scene.json`

### Key Backend Logic
- **Artistry Store (UI)**: `c:\Users\h4rdc\Documents\Github\airi-rebase-scratch\packages\stage-ui\src\stores\modules\artistry-autonomous.ts`
- **ComfyUI Controller**: `e:\CUIPP\comfyGalleryAppBackend\ComfyUiApi.js`

---

## 7. Potential Pivot: Ideogram 4 as a Native Regional Backend

> **Status**: Exploratory — pending hardware validation
> **Date added**: 2026-06-07

Ideogram 4 (released June 2026, 9.3B parameters) is the first open-weight text-to-image model that natively understands spatial/regional prompting as a first-class feature — not through conditioning tricks, but through its own structured JSON input format. This is worth evaluating as an alternative or complementary backend to `AIRIRegionalResolver`.

*(For the complete syntax specification, see [Ideogram 4 Schema Guide](file:///C:/Users/h4rdc/Documents/Github/airi-rebase-scratch/docs/design-ideogram-4-schema.md).)*

### Why It's Relevant

The `AIRIRegionalResolver` approach is a universal solution that rolls its own regional conditioning on top of any diffusion model using `CLIPTextEncode` + `ConditioningSetArea` chains. Ideogram 4 collapses that entire layer — the model itself understands regions, bounding boxes, per-area prompts, and the distinction between object areas and text areas natively.

The Director was designed to be a Spatial Scene Architect. Ideogram 4 is a model that speaks that language out of the box.

### How the Integration Would Work

Same zero-UI mode inference from §2, extended with a new detection target:

- **Detection**: Inspect the workflow's Director input node `class_type`
- **If `AIRIRegionalResolver`**: Director uses the existing Spatial Vision Handbook + 0-100 grid schema (§4)
- **If Ideogram 4 manual JSON node**: Director switches to Ideogram 4's native area spec — same high-level spatial reasoning, different output schema

The post-processing enrichment step (§3 identity injection) still applies and actually becomes more precise. The key mechanic is a **schema extension**: the Director's output follows the Ideogram 4 spec but with one additional field per region — a `concept` key that tags the region with a named entity from the character/scene config.

Example Director output (extended schema):
```json
{
  "regions": [
    {
      "bbox": [10, 5, 60, 95],
      "type": "object",
      "prompt": "woman walking confidently, red dress, holding camera",
      "concept": "kanjira"
    },
    {
      "bbox": [0, 0, 100, 100],
      "type": "object",
      "prompt": "Times Square at night, neon lights, crowds",
      "concept": null
    }
  ]
}
```

The enrichment layer then:
1. Sees `"concept": "kanjira"` on the first region
2. Looks up `kanjira`'s concept prompts from the character card (hair color, skin tone, signature features, etc.)
3. Appends those prompts to that region's `prompt` field
4. **Strips the `concept` key** before sending the clean, Ideogram 4-compliant JSON to ComfyUI

The Director stays narrative ("kanjira walking confidently"), the config layer injects the visual fidelity details, and Ideogram 4 receives a perfectly valid spec with no knowledge of the extension. The concept key is purely a pre-send enrichment hook — it never leaves AIRI.

### The Schema Convergence Insight

Regardless of which path is taken, adopting Ideogram 4's JSON schema as the **Director's internal output format** is worth considering even for the `AIRIRegionalResolver` route. The schema is just a structured representation of spatial intent. For the universal solution, the fallback is trivial: concat all region prompts into a single flat string and feed it to `CLIPTextEncode` as normal. Cross-compatibility is essentially free.

### Why the Original Plan Is Still the Right Default

Ideogram 4 is a 9.3B model. Performance on consumer hardware is unvalidated and may be impractical for real-time or near-real-time use cases. The `AIRIRegionalResolver` approach works with any model the user already has running — Flux, SDXL, whatever — and adds zero additional resource overhead.

### Next Step Before Committing

**Gate**: Install Ideogram 4 on the secondary machine and validate actual generation speed and quality under realistic conditions. If performance is usable, the Ideogram 4 path becomes a legitimate first-class option. If not, `AIRIRegionalResolver` remains the primary path and Ideogram 4's schema still informs the Director's output format for future cross-compatibility.
