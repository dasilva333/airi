/**
 * Phase 7 prompt building for creative-code canvas generation.
 *
 * Target runtime: **p5.js v1 + p5.brush v1.1.4** (global mode). We deliberately
 * pair p5 v1 (dominant in training data) with p5.brush's v1 API — p5.brush v2
 * requires p5 v2, whose API the g1d checkpoints are unlikely to know well.
 * The API reference below was distilled from the official p5.brush v1.1.4
 * README (github.com/acamposuribe/p5.brush @ tag v.1.1.4), not from memory.
 *
 * Two prompt frames:
 *  - chat:       production `buildRwkvPrompt` user turn (G1 prefill on)
 *  - completion: raw prefix ending inside an open ```js fence (generateCode)
 *
 * The S0 conditioning corpus (Baseline B) is assembled here too — see the
 * Phase 7 Decision Log in docs/project-rwkv-cleanroom-harness-plan.md.
 */

export const CANVAS_SIZE = 600

/** Compact p5.brush v1 API reference (distilled from the v1.1.4 README). */
export const P5_BRUSH_API_REFERENCE = `p5.brush v1 API (loads as global \`brush\` after p5.min.js):
Setup (required): function setup() { createCanvas(600, 600, WEBGL); brush.load(); } — WEBGL puts origin (0,0) at canvas CENTER, so coordinates span -300..300 on a 600x600 canvas. p5's background() paints the paper first.
Strokes: brush.set(brushName, color, weight); brush.stroke(r,g,b) or brush.stroke("#hex"); brush.strokeWeight(w); brush.noStroke(). Built-in brushes: "2B","HB","2H","cpencil","pen","rotring","spray","marker","marker2","charcoal".
Watercolor fills: brush.fill(color, opacity0-255); brush.noFill(); brush.bleed(s,"out"|"in") with s<=0.5; brush.fillTexture(tex0-1, border0-1). Fill shapes must list vertices CLOCKWISE or the effect inverts.
Hatching: brush.hatch(dist, angleDeg, {rand:0-1,false, continuous:bool, gradient:0-1}); brush.noHatch(); brush.setHatch(name,color,weight).
Vector fields: brush.field("curved"|"truncated"|"zigzag"|"seabed"|"waves"); brush.noField(); affects strokes/fills drawn after.
Geometry: brush.line(x1,y1,x2,y2); brush.flowLine(x,y,length,dirDeg); brush.spline([[x,y],...], curvature0-1); brush.rect(x,y,w,h); brush.circle(x,y,radius,handDrawn?); brush.polygon([[x,y],...]); brush.beginShape(curvature0-1) + brush.vertex(x,y,pressure?) + brush.endShape(CLOSE); brush.beginStroke("curve"|"segments",x,y) + brush.segment(angleDeg,length,pressure) + brush.endStroke(angleDeg,pressure).
Utility: brush.push(); brush.pop(); brush.rotate(a); brush.scale(s); brush.seed(n) for determinism; brush.reDraw(); brush.reBlend(); brush.scaleBrushes(s).
Core p5 also available: background, random, noise, map, lerp, cos, sin, radians, degrees, color, lerpColor, dist, TWO_PI, PI, CLOSE, noLoop, frameCount.`

/** Style reference example (must stay a valid p5.brush v1 global-mode sketch). */
export const EXAMPLE_SKETCH_FLOWER = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(11);
  background(251, 247, 240);

  brush.noStroke();
  brush.noHatch();
  brush.bleed(0.4, "out");
  brush.fill(190, 205, 222, 60);
  brush.rect(-300, -300, 600, 340);
  brush.fill(224, 214, 198, 70);
  brush.rect(-300, 40, 600, 260);

  brush.fill(243, 170, 150, 95);
  brush.bleed(0.3, "out");
  for (let i = 0; i < 6; i++) {
    let a = (TWO_PI * i) / 6;
    let px = 70 * cos(a);
    let py = 70 * sin(a) - 20;
    brush.beginShape(0.6);
    brush.vertex(px * 0.3, py * 0.3);
    brush.vertex(px - 22, py - 18);
    brush.vertex(px + 20, py - 6);
    brush.vertex(px * 0.4, py * 0.5 + 12);
    brush.endShape(CLOSE);
  }

  brush.fill(240, 190, 90, 120);
  brush.circle(0, -20, 26, true);

  brush.set("HB", "#3a5a40", 1.4);
  brush.field("curved");
  brush.line(0, 6, 14, 260);
  brush.noStroke();
  brush.fill(90, 130, 90, 90);
  brush.bleed(0.25, "out");
  brush.beginShape(0.7);
  brush.vertex(6, 120);
  brush.vertex(70, 96);
  brush.vertex(96, 130);
  brush.vertex(30, 150);
  brush.endShape(CLOSE);
}`

/** Second style demonstration (moody scene) for few-shot / S0 conditioning. */
export const EXAMPLE_SKETCH_RAINY_STREET = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(4);
  background(30, 34, 48);

  brush.noStroke();
  brush.noHatch();
  brush.bleed(0.35, "out");
  brush.fill(50, 60, 86, 90);
  brush.rect(-300, -300, 600, 600);

  brush.fill(22, 24, 34, 200);
  for (let x = -300; x < 300; x += 90) {
    let h = random(180, 340);
    brush.rect(x + random(-8, 8), 300 - h, 74, h);
  }

  for (let i = 0; i < 40; i++) {
    brush.fill(255, 205, 120, random(60, 120));
    brush.rect(random(-280, 270), random(-220, 160), 8, 10);
  }

  brush.set("2B", "#8fa3c8", 0.8);
  for (let i = 0; i < 26; i++) {
    let x = random(-290, 290);
    brush.line(x, 220, x + random(-14, 14), 290);
  }
}`

function rules(scene: string): string {
  return `You are an expert generative artist. Write one complete p5.js sketch using the p5.brush library that paints "${scene}" as an expressive watercolor artwork.
RULES:
1. Output ONLY JavaScript inside a single \`\`\`js code fence. No prose, no explanations.
2. Declare exactly ONE function setup(). Inside setup(): createCanvas(${CANVAS_SIZE}, ${CANVAS_SIZE}, WEBGL); brush.load(); noLoop(); then paint the artwork. Never declare draw(). Never declare a second setup().
3. Paint shapes immediately: every brush.fill()/brush.set() must be followed by geometry (brush.rect, brush.circle, brush.polygon, brush.line, brush.beginShape...vertex...endShape). Configuration-only code with no shapes is a failure.
4. WEBGL origin is the canvas CENTER (coordinates -300..300). Fill vertices clockwise.
5. Keep the whole sketch between 300 and 600 tokens. Prefer fewer, bolder strokes over long repetitive loops.
6. Use only the p5.brush API below plus core p5 math/color helpers.`
}

/** Chat-frame user message (few-shot style reference included). */
export function buildCanvasUserPrompt(scene: string, opts: { fewShot?: boolean } = {}): string {
  const fewShot = opts.fewShot !== false
  return `${rules(scene)}

${P5_BRUSH_API_REFERENCE}
${fewShot ? `\nSTYLE EXAMPLE (study it, do not copy):\n\`\`\`js\n${EXAMPLE_SKETCH_FLOWER}\n\`\`\`` : ''}

Now paint "${scene}".`
}

/**
 * Completion-frame prefix for `generateRaw`/`generateCode`: ends with an open
 * \`\`\`js fence so the model continues straight into code. Caller appends the
 * extracted output back after the fence opener.
 */
export function buildCanvasCompletionPrefix(scene: string): string {
  return `${rules(scene)}

${P5_BRUSH_API_REFERENCE}

Task: paint "${scene}".
\`\`\`js
`
}

/**
 * Baseline B: texts ingested (no sampling) to precondition the recurrent state
 * as a p5-watercolor S0 cartridge. ~1.5k tokens — cheap at prefill speed.
 */
export function buildStateConditioningCorpus(): string[] {
  return [
    `${P5_BRUSH_API_REFERENCE}\n`,
    `Watercolor painting sketch using p5.brush:\n\`\`\`js\n${EXAMPLE_SKETCH_FLOWER}\n\`\`\`\n`,
    `Moody dusk scene sketch using p5.brush:\n\`\`\`js\n${EXAMPLE_SKETCH_RAINY_STREET}\n\`\`\`\n`,
  ]
}
