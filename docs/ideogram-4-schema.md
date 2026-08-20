# Ideogram 4 JSON Caption Schema

*(For context on how this schema is integrated into AIRI's spatial vision routing, see the [Regional Orchestration Proposal](file:///C:/Users/h4rdc/Documents/Github/airi-rebase-scratch/docs/proposal-director-led-regional-orchestration.md).)*

Ideogram 4 supports a structured JSON captioning format that provides granular control over spatial placement, rendering of text, color palette distribution, and overall aesthetic medium. Following this schema is recommended to match the model's training distribution.

---

## 1. Top-Level Structure

A valid JSON caption object consists of three root keys:

```json
{
  "high_level_description": "A global summary of the overall scene",
  "style_description": { ... },
  "compositional_deconstruction": { ... }
}
```

---

## 2. Style Description (`style_description`)

This block defines the visual render style. When present, it must follow strict rules:

### Required Fields
*   `medium`: The overall form of the output image (see valid values below).
*   `aesthetics`: A string specifying style markers (e.g., `"minimalist, clean, organic textures"`).
*   `lighting`: A string defining light sources and quality (e.g., `"warm golden hour glow, long dramatic shadows"`).

### Mutually Exclusive Configuration (Choose Exactly One)
*   **For Photos:**
    *   You must use the `photo` key.
    *   The `medium` field **must** be set to `"photograph"`.
    *   *Example details to include in `photo`:* camera bodies, lenses, shutter speed, f-stop, camera angle, perspective, film grain.
*   **For Non-Photos (Illustration, Painting, etc.):**
    *   You must use the `art_style` key.
    *   *Example details to include in `art_style`:* design movements, drawing tools, vector properties, art styles (e.g., `"flat vector style, bold black outlines"`).

### Optional Fields
*   `color_palette`: A list of up to 16 hex color codes (e.g., `["#FFFFFF", "#000000"]`).
    *   **Crucial Rule:** If included, `color_palette` **must be the very last key** in the `style_description` object.

---

## 3. Medium & Style Values

Although the fields are open-ended strings rather than a strict enum validation set, the model is trained on a specific set of primary categories. Using these categories helps steer generation cleanly:

### Primary Mediums (`medium`)
| Value | Best Paired Key | Description |
| :--- | :--- | :--- |
| `"photograph"` | `photo` | Realistic, film-like, digital, or mobile captures. |
| `"illustration"` | `art_style` | Digital art, vector art, hand-drawn styles, anime, manga, and cartoons. |
| `"painting"` | `art_style` | Traditional physical media like oil, watercolor, acrylic, gouache, canvas. |
| `"3d_render"` | `art_style` | CGI, claymation, isometric low-poly, volumetric path-tracing. |
| `"graphic_design"` | `art_style` | Posters, typography layouts, logos, print templates, streetwear stickers. |

---

## 4. Compositional Deconstruction (`compositional_deconstruction`)

This block handles spatial layout and elements within the scene.

*   `background`: A description of the background environment.
*   `elements`: A list of objects/subjects or text layers in the image.

### Element Key Ordering Rules
The schema enforces a strict order of keys for items inside the `elements` array. Sticking to this order prevents validation or inference pipeline issues:

#### Standard Objects (`type: "obj"`)
Must be ordered exactly as:
1.  `type` (always `"obj"`)
2.  `bbox` (optional)
3.  `desc` (descriptive string)
4.  `color_palette` (optional array of hex codes)

#### In-Image Text (`type: "text"`)
Must be ordered exactly as:
1.  `type` (always `"text"`)
2.  `bbox` (optional)
3.  `text` (the literal string/word(s) to render)
4.  `desc` (descriptive style of the text, e.g. `"bold puffy 3D letters, inflatable texture"`)
5.  `color_palette` (optional array of hex codes)

---

## 5. Bounding Box Format (`bbox`)

*   **Format:** `[y_min, x_min, y_max, x_max]`
*   **Normalized Coordinate System:** Bounding boxes use integer values from **0 to 1000**.
*   **Origin:** The origin `[0, 0]` is at the **top-left** corner of the image canvas.
*   **Corner Boundary:** `[1000, 1000]` is the bottom-right corner.
*   **Proportions:** The aspect ratio of the bounding box coordinates should loosely match the aspect ratio of the described element to prevent stretching.

---

## 6. Complete Schema Example

```json
{
  "high_level_description": "A minimalist graphic design poster of a sleeping cat under a sunny window.",
  "style_description": {
    "aesthetics": "flat design, clean vector art, matte look",
    "lighting": "bright, flat ambient lighting with soft cast shadows",
    "art_style": "minimalist flat graphic design illustration",
    "medium": "graphic_design",
    "color_palette": ["#FFF3E0", "#FFB74D", "#37474F", "#78909C"]
  },
  "compositional_deconstruction": {
    "background": "A warm cream-colored textured paper background with a soft yellow square representing a window reflection.",
    "elements": [
      {
        "type": "obj",
        "bbox": [400, 300, 800, 700],
        "desc": "A stylized, sleeping orange tabby cat curled up in a circle.",
        "color_palette": ["#FFB74D", "#FF9800", "#37474F"]
      },
      {
        "type": "text",
        "bbox": [850, 200, 920, 800],
        "text": "COZY NOOK",
        "desc": "Clean, sans-serif uppercase typography in dark slate gray",
        "color_palette": ["#37474F"]
      }
    ]
  }
}
```

## Relevant Skills

- [[airi-artistry-comfyui-widgets]]
