# The Creative Canvas Benchmark: Painterly Watercolor with `p5.brush`

This prompt is designed to test an AI model's latent aesthetic taste, spatial composition, and creative coding capability using **p5.js** and the **p5.brush (v1.1.4)** library.

Copy and paste the section below to any model (text-only or multimodal) to see their unique artistic style, color palettes, and compositional instincts.

---

```markdown
# Creative Coding Challenge: Generative Watercolor Art with p5.brush

You are an expert generative artist and creative coder. Your goal is to create an expressive, painterly digital watercolor artwork by writing a single, self-contained JavaScript sketch using **p5.js** and the **p5.brush** creative library.

Rather than drawing rigid, geometric diagrams with flat colors, use the organic physics of `p5.brush` (watercolor bleeds, pigment layering, pressure variations, and textured bristle marks) to evoke genuine human artistic sensibility and atmosphere.

---

### Canvas Environment & Technical Rules
1. **Setup & Lifecycle**:
   - Declare exactly one `function setup()`.
   - Start with: `createCanvas(600, 600, WEBGL); brush.load(); noLoop();`
   - Paint the entire scene inside `setup()`. Do **not** declare a `draw()` function.
2. **Coordinate Space**:
   - In p5's `WEBGL` mode, the origin `(0, 0)` is at the **center of the canvas**.
   - The X coordinate spans from `-300` (left) to `+300` (right).
   - The Y coordinate spans from `-300` (top) to `+300` (bottom).
3. **Fills & Bleed Direction**:
   - In `p5.brush`, shape vertices MUST be defined in **clockwise order** for watercolor fill algorithms to blend correctly.
4. **Output Format**:
   - Output **ONLY** the executable JavaScript code wrapped in a single ` ```js ` code block.
   - Do not include explanatory prose or walkthroughs before or after the code block.

---

### p5.brush v1 API Palette Reference

- **Brushes**: `brush.set(brushName, color, weight)`
  - Available brush types: `"2B"`, `"HB"`, `"2H"`, `"charcoal"`, `"cpencil"`, `"pen"`, `"rotring"`, `"spray"`, `"marker"`, `"marker2"`.
- **Watercolor Fills**:
  - `brush.fill(r, g, b, opacity)` or `brush.fill("#hex", opacity)` (opacity: 0–255).
  - `brush.bleed(strength, "out" | "in")` (strength: 0.1–0.5 for realistic bleed).
  - `brush.noFill()`
- **Strokes & Textures**:
  - `brush.stroke(r, g, b)` or `brush.stroke("#hex")`
  - `brush.strokeWeight(w)`
  - `brush.noStroke()`
  - `brush.hatch(distance, angleInDegrees, { rand: 0-1, continuous: boolean })`
  - `brush.noHatch()`
  - `brush.field("curved" | "seabed" | "waves" | "zigzag")` (adds organic curvature to lines).
- **Geometry**:
  - `brush.circle(x, y, radius, handDrawnBoolean)`
  - `brush.rect(x, y, width, height)`
  - `brush.line(x1, y1, x2, y2)`
  - `brush.flowLine(x, y, length, directionDegrees)`
  - `brush.beginShape(curvature0-1)` + `brush.vertex(x, y)` + `brush.endShape(CLOSE)`
- **Core p5 Helpers Available**:
  - `background(r, g, b)`, `random(min, max)`, `cos(a)`, `sin(a)`, `TWO_PI`, `PI`, `radians(deg)`.

---

### Choose ONE of the following scenes to paint:

#### Option A: The Blooming Botanical (Peach & Crimson Hibiscus)
*Artistic Prose Vision:*
Imagine a sunlit morning on warm, textured washi paper. Paint a single blooming flower with layered, translucent watercolor washes. The outer petals should have soft, peach-coral tones that bleed gently into the background. The inner core transitions into concentrated, velvety magenta and deep crimson pigment. Delicate charcoal or graphite stamen lines radiate outward, tipped with warm golden pollen flecks. Below, an organic curved stem supports broad, earthy sage and olive watercolor leaves with subtle vein accents.

#### Option B: The Twilight Alley (Nocturne Rain & Neon Reflections)
*Artistic Prose Vision:*
A moody, atmospheric cityscape at dusk under a steady drizzle. The sky is a deep twilight wash of slate navy and dark indigo, silhouettes of misty buildings framing a narrow alley. Warm, glowing orange paper lanterns and cool cyan/magenta neon shop signs hang in the air, casting vibrant, colorful halos through the haze. Below, the wet asphalt glistens with wide, reflective watercolor bleeds where the glowing light puddles and melts into the dark pavement. Fine, directional rain streaks cross the scene.

#### Option C: Artist's Choice (Open Landscape / Nature / Architecture)
*Artistic Prose Vision:*
Choose any atmospheric scene of your liking (e.g. a misty mountain forest at dawn, a lonely seaside lighthouse in a storm, or an autumn tea garden). Express the mood through rich watercolor layering, thoughtful color harmonies, and tactile brush textures.

---

Now, write the complete, executable `p5.brush` JavaScript sketch for your chosen scene:
```
