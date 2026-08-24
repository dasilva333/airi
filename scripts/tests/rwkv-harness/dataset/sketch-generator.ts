/**
 * Synthetic p5.brush Sketch Generator for RWKV/WebLLM State-Tuning Corpus.
 *
 * Produces structured, diverse, high-quality p5.brush watercolor sketches
 * across 4 core aesthetic themes (botanicals, nocturnes, landscapes, celestial).
 */

export interface SketchTemplate {
  id: string
  title: string
  theme: 'botanical' | 'nocturne' | 'landscape' | 'celestial'
  prompt: string
  code: string
}

export function generateSeedCorpus(): SketchTemplate[] {
  const seeds: SketchTemplate[] = []

  // =========================================================================
  // THEME 1: BOTANICAL (Hibiscus, Lotus, Cherry Blossom, Bamboo, Orchid, Peony)
  // =========================================================================

  seeds.push({
    id: 'botanical-peach-hibiscus-01',
    title: 'Peach Hibiscus with Velvet Core',
    theme: 'botanical',
    prompt: 'blooming peach hibiscus with soft watercolor petals, golden pollen, and olive leaves',
    code: `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(252, 248, 240);

  // Background wash
  brush.noStroke();
  brush.bleed(0.4, "out");
  brush.fill(245, 230, 218, 50);
  brush.circle(0, 0, 240, true);

  // Broad sage watercolor leaves
  brush.fill(95, 128, 92, 120);
  brush.bleed(0.3, "out");
  brush.beginShape(0.4);
  brush.vertex(-180, 80);
  brush.vertex(-80, 40);
  brush.vertex(-40, 160);
  brush.vertex(-140, 200);
  brush.endShape(CLOSE);

  brush.fill(75, 110, 78, 130);
  brush.beginShape(0.4);
  brush.vertex(40, 120);
  brush.vertex(160, 60);
  brush.vertex(190, 170);
  brush.vertex(80, 190);
  brush.endShape(CLOSE);

  // Curved stem
  brush.set("HB", "#3b533b", 2.2);
  brush.field("curved");
  brush.line(0, 50, -20, 260);

  // Outer peach petals
  const angles = [0, 72, 144, 216, 288];
  for (let i = 0; i < angles.length; i++) {
    const rad = radians(angles[i] - 15);
    const cx = cos(rad) * 65;
    const cy = sin(rad) * 65 - 30;
    brush.fill(248, 172, 150, 135);
    brush.bleed(0.35, "out");
    brush.circle(cx, cy, 75, true);
  }

  // Inner crimson core wash
  for (let i = 0; i < angles.length; i++) {
    const rad = radians(angles[i] + 18);
    const cx = cos(rad) * 35;
    const cy = sin(rad) * 35 - 30;
    brush.fill(188, 38, 72, 170);
    brush.bleed(0.45, "out");
    brush.circle(cx, cy, 42, true);
  }

  // Stamen and golden pollen
  brush.set("2B", "#4a1824", 1.5);
  for (let i = 0; i < 8; i++) {
    const a = radians(i * 45 + 10);
    const ex = cos(a) * 55;
    const ey = sin(a) * 55 - 30;
    brush.line(0, -30, ex, ey);
    brush.fill(248, 198, 48, 220);
    brush.bleed(0.1, "out");
    brush.circle(ex, ey, 5, true);
  }
}`,
  })

  seeds.push({
    id: 'botanical-lotus-pond-02',
    title: 'Pink Lotus Floating in Twilight Water',
    theme: 'botanical',
    prompt: 'zen pink lotus flower floating on calm emerald pond with watercolor ripples',
    code: `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(108);
  background(242, 245, 243);

  // Pond water washes
  brush.noStroke();
  brush.bleed(0.5, "out");
  brush.fill(42, 95, 110, 80);
  brush.rect(-280, -200, 560, 480);
  brush.fill(28, 68, 85, 90);
  brush.rect(-260, -50, 520, 320);

  // Lotus pads (broad emerald discs)
  brush.bleed(0.3, "out");
  brush.fill(48, 118, 88, 160);
  brush.circle(-130, 80, 110, true);
  brush.fill(36, 92, 70, 180);
  brush.circle(140, 110, 130, true);

  // Lotus flower petals (layered white to magenta)
  const petalLayers = [
    { count: 7, r: 85, fill: [255, 230, 240, 140], bleed: 0.35 },
    { count: 6, r: 60, fill: [248, 150, 190, 160], bleed: 0.3 },
    { count: 5, r: 40, fill: [225, 45, 120, 190], bleed: 0.25 },
  ];

  for (const layer of petalLayers) {
    brush.fill(...layer.fill);
    brush.bleed(layer.bleed, "out");
    for (let i = 0; i < layer.count; i++) {
      const a = map(i, 0, layer.count - 1, -PI * 0.85, -PI * 0.15);
      const px = cos(a) * layer.r;
      const py = sin(a) * (layer.r * 0.9) - 10;
      brush.circle(px, py, layer.r * 0.55, true);
    }
  }

  // Golden lotus pod core
  brush.fill(242, 195, 45, 230);
  brush.bleed(0.15, "out");
  brush.circle(0, -25, 22, true);

  // Delicate ripple lines
  brush.set("rotring", "#245866", 0.9);
  brush.noFill();
  brush.circle(0, 20, 180, false);
  brush.circle(0, 30, 240, false);
}`,
  })

  seeds.push({
    id: 'botanical-cherry-blossom-03',
    title: 'Spring Sakura Branch in Morning Light',
    theme: 'botanical',
    prompt: 'delicate cherry blossom sakura branch with blush pink petals on washi paper',
    code: `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(77);
  background(253, 250, 245);

  // Soft sky morning glow
  brush.noStroke();
  brush.bleed(0.45, "out");
  brush.fill(255, 235, 215, 60);
  brush.circle(-80, -100, 260, true);

  // Rugged dark branch
  brush.set("charcoal", "#2d1e18", 3.2);
  brush.field("curved");
  brush.line(-280, 160, -80, 20);
  brush.line(-80, 20, 140, -110);
  brush.line(140, -110, 270, -180);

  // Sub-branches
  brush.set("charcoal", "#2d1e18", 1.8);
  brush.line(-80, 20, -30, -70);
  brush.line(30, -50, 90, -10);
  brush.line(140, -110, 170, -40);

  // Sakura blossom clusters
  const clusterPos = [
    [-180, 100], [-120, 50], [-70, -20], [-30, -80],
    [20, -40], [80, -20], [140, -120], [200, -150], [240, -180]
  ];

  for (const [bx, by] of clusterPos) {
    // Petal wash cluster
    for (let p = 0; p < 5; p++) {
      const pa = radians(p * 72 + random(-15, 15));
      const px = bx + cos(pa) * random(14, 28);
      const py = by + sin(pa) * random(14, 28);
      brush.fill(255, 192, 203, 145);
      brush.bleed(0.3, "out");
      brush.circle(px, py, random(18, 28), true);
    }
    // Deep rose center
    brush.fill(219, 68, 108, 180);
    brush.bleed(0.2, "out");
    brush.circle(bx, by, 10, true);

    // Stamen dots
    brush.set("2B", "#5c1b2c", 1.0);
    for (let d = 0; d < 4; d++) {
      const da = radians(d * 90);
      brush.line(bx, by, bx + cos(da) * 8, by + sin(da) * 8);
    }
  }

  // Floating fallen petals
  for (let f = 0; f < 12; f++) {
    brush.fill(255, 182, 193, 110);
    brush.bleed(0.25, "out");
    brush.circle(random(-240, 240), random(0, 260), random(10, 16), true);
  }
}`,
  })

  // =========================================================================
  // THEME 2: NOCTURNE & CITY (Rainy Alley, Izakaya Lanterns, Neon Reflections)
  // =========================================================================

  seeds.push({
    id: 'nocturne-rainy-alley-01',
    title: 'Rainy Kyoto Alley with Glowing Lanterns',
    theme: 'nocturne',
    prompt: 'nocturne rainy alley in Kyoto with amber paper lanterns and wet asphalt reflections',
    code: `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(314);
  background(18, 22, 34);

  // Indigo twilight wash
  brush.noStroke();
  brush.bleed(0.5, "out");
  brush.fill(32, 42, 68, 140);
  brush.rect(-300, -300, 600, 360);

  // Silhouette buildings framing alley
  brush.fill(12, 14, 22, 230);
  brush.bleed(0.15, "out");
  // Left roof & wall
  brush.beginShape(0.1);
  brush.vertex(-300, -300);
  brush.vertex(-120, -180);
  brush.vertex(-90, 80);
  brush.vertex(-300, 140);
  brush.endShape(CLOSE);
  // Right roof & wall
  brush.beginShape(0.1);
  brush.vertex(110, -200);
  brush.vertex(300, -290);
  brush.vertex(300, 140);
  brush.vertex(80, 80);
  brush.endShape(CLOSE);

  // Wet pavement ground wash
  brush.bleed(0.4, "out");
  brush.fill(24, 28, 40, 220);
  brush.rect(-300, 80, 600, 220);

  // Warm glowing paper lanterns
  const lanterns = [
    { x: -105, y: -40, r: 24, c: [255, 140, 25, 230], halo: [255, 160, 40, 70] },
    { x: -75, y: 10, r: 18, c: [255, 120, 20, 230], halo: [255, 140, 30, 60] },
    { x: 95, y: -20, r: 22, c: [255, 80, 60, 220], halo: [255, 100, 80, 65] },
  ];

  for (const l of lanterns) {
    // Ambient light halo
    brush.fill(...l.halo);
    brush.bleed(0.6, "out");
    brush.circle(l.x, l.y, l.r * 3.5, true);

    // Solid lantern body
    brush.fill(...l.c);
    brush.bleed(0.2, "out");
    brush.rect(l.x - l.r * 0.6, l.y - l.r, l.r * 1.2, l.r * 1.8);

    // Wet puddle light reflection on ground
    brush.fill(l.c[0], l.c[1], l.c[2], 90);
    brush.bleed(0.5, "out");
    brush.rect(l.x - l.r * 0.8, 120 + l.y * 0.4, l.r * 1.6, 90);
  }

  // Cyan shop sign glow
  brush.fill(35, 210, 240, 60);
  brush.bleed(0.5, "out");
  brush.circle(130, -70, 70, true);
  brush.fill(35, 210, 240, 190);
  brush.rect(115, -85, 30, 30);
  // Cyan puddle reflection
  brush.fill(35, 210, 240, 70);
  brush.rect(110, 140, 40, 70);

  // Overhead wire lines
  brush.set("rotring", "#1a1e28", 1.1);
  brush.noFill();
  brush.line(-300, -110, 300, -80);
  brush.line(-300, -90, 300, -50);

  // Fine rain streaks
  brush.set("pen", "rgba(180, 200, 230, 0.45)", 0.8);
  for (let r = 0; r < 35; r++) {
    const rx = random(-280, 280);
    const ry = random(-250, 220);
    brush.line(rx, ry, rx - 8, ry + 26);
  }
}`,
  })

  // =========================================================================
  // THEME 3: LANDSCAPE & NATURE (Misty Mountain, Pine Forest, Waterfall)
  // =========================================================================

  seeds.push({
    id: 'landscape-misty-mountains-01',
    title: 'Misty Alpine Mountain Ridge at Sunrise',
    theme: 'landscape',
    prompt: 'atmospheric sumi-e watercolor of misty mountain ridges with sunrise glow and pine silhouettes',
    code: `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(512);
  background(250, 245, 236);

  // Soft morning sun disc
  brush.noStroke();
  brush.fill(255, 145, 75, 160);
  brush.bleed(0.4, "out");
  brush.circle(110, -120, 95, true);

  // Distant mountain ridge (pale indigo)
  brush.fill(168, 178, 198, 110);
  brush.bleed(0.3, "out");
  brush.beginShape(0.2);
  brush.vertex(-300, -50);
  brush.vertex(-160, -140);
  brush.vertex(-40, -90);
  brush.vertex(140, -170);
  brush.vertex(300, -70);
  brush.vertex(300, 60);
  brush.vertex(-300, 60);
  brush.endShape(CLOSE);

  // Mid-ground mountain ridge (slate blue-green)
  brush.fill(102, 128, 142, 160);
  brush.bleed(0.25, "out");
  brush.beginShape(0.2);
  brush.vertex(-300, 10);
  brush.vertex(-190, -40);
  brush.vertex(-60, 40);
  brush.vertex(70, -30);
  brush.vertex(220, 60);
  brush.vertex(300, 20);
  brush.vertex(300, 160);
  brush.vertex(-300, 160);
  brush.endShape(CLOSE);

  // Foreground hill (deep evergreen charcoal)
  brush.fill(38, 56, 52, 220);
  brush.bleed(0.15, "out");
  brush.beginShape(0.15);
  brush.vertex(-300, 110);
  brush.vertex(-110, 70);
  brush.vertex(80, 130);
  brush.vertex(300, 90);
  brush.vertex(300, 300);
  brush.vertex(-300, 300);
  brush.endShape(CLOSE);

  // Pine tree silhouettes
  brush.set("2B", "#1b2b25", 1.8);
  const pineX = [-230, -180, -130, -80, 140, 190, 240];
  for (const px of pineX) {
    const py = 90 + random(-15, 20);
    const th = random(45, 80);
    // Trunk
    brush.line(px, py, px, py - th);
    // Branch tiers
    for (let t = 0; t < 5; t++) {
      const by = py - th + (t * th * 0.18);
      const bw = (t + 1) * 6;
      brush.line(px - bw, by + 4, px + bw, by + 4);
    }
  }

  // Soft mist bands across valleys
  brush.fill(250, 245, 236, 120);
  brush.bleed(0.55, "out");
  brush.rect(-300, -20, 600, 45);
  brush.rect(-300, 60, 600, 40);
}`,
  })

  // =========================================================================
  // THEME 4: CELESTIAL & ABSTRACT (Aurora Borealis, Cosmic Nebula)
  // =========================================================================

  seeds.push({
    id: 'celestial-aurora-borealis-01',
    title: 'Emerald & Violet Aurora over Dark Tundra',
    theme: 'celestial',
    prompt: 'glowing emerald green and violet aurora borealis flowing across starry polar night sky',
    code: `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(999);
  background(12, 15, 28);

  // Deep night sky gradient washes
  brush.noStroke();
  brush.bleed(0.5, "out");
  brush.fill(24, 28, 55, 150);
  brush.rect(-300, -300, 600, 400);

  // Flowing violet aurora ribbon
  brush.fill(155, 58, 210, 95);
  brush.bleed(0.55, "out");
  brush.beginShape(0.6);
  brush.vertex(-300, -180);
  brush.vertex(-120, -240);
  brush.vertex(60, -160);
  brush.vertex(220, -220);
  brush.vertex(300, -150);
  brush.vertex(300, -90);
  brush.vertex(140, -110);
  brush.vertex(-60, -180);
  brush.vertex(-300, -110);
  brush.endShape(CLOSE);

  // Luminous emerald green aurora ribbons
  brush.fill(42, 235, 160, 120);
  brush.bleed(0.6, "out");
  brush.beginShape(0.7);
  brush.vertex(-300, -130);
  brush.vertex(-150, -190);
  brush.vertex(20, -110);
  brush.vertex(180, -180);
  brush.vertex(300, -100);
  brush.vertex(300, -40);
  brush.vertex(120, -60);
  brush.vertex(-80, -130);
  brush.vertex(-300, -60);
  brush.endShape(CLOSE);

  // Vertical light curtain rays
  brush.set("marker", "rgba(80, 255, 190, 0.25)", 4.5);
  for (let r = -240; r < 260; r += 22) {
    const topY = -230 + sin(r * 0.02) * 40;
    const botY = -50 + cos(r * 0.02) * 30;
    brush.line(r, topY, r + random(-6, 6), botY);
  }

  // Polar snowy tundra silhouette
  brush.fill(16, 20, 32, 240);
  brush.bleed(0.15, "out");
  brush.beginShape(0.1);
  brush.vertex(-300, 110);
  brush.vertex(-140, 95);
  brush.vertex(50, 130);
  brush.vertex(210, 105);
  brush.vertex(300, 125);
  brush.vertex(300, 300);
  brush.vertex(-300, 300);
  brush.endShape(CLOSE);

  // Tiny distant pine trees
  brush.set("2B", "#0d141e", 1.2);
  for (let x = -260; x < 280; x += 38) {
    const py = 115 + random(-10, 15);
    brush.line(x, py, x, py - random(14, 26));
  }

  // Delicate starry speckles
  brush.set("pen", "rgba(255, 255, 255, 0.8)", 1.0);
  for (let s = 0; s < 30; s++) {
    const sx = random(-280, 280);
    const sy = random(-280, 60);
    brush.circle(sx, sy, 1.5, true);
  }
}`,
  })

  return seeds
}
