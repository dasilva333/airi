/**
 * Standalone render spike for Antigravity's creative-freedom recreations.
 * Uses the cleanroom CanvasRenderer without touching model inference or existing reports.
 */

import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { startStaticServer } from '../engine/server.js'

const BRAVE_PATH = process.env.RWKV_HARNESS_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'

const SKETCH_FLOWER_ANTIGRAVITY = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(88);
  
  // Warm textured washi paper background
  background(252, 249, 242);
  
  // Soft ambient watercolor washes (sky blush & earth warmth)
  brush.noStroke();
  brush.noHatch();
  brush.bleed(0.45, "out");
  brush.fill(210, 225, 238, 45); // Cool morning mist wash
  brush.rect(-300, -300, 600, 320);
  
  brush.fill(248, 228, 212, 55); // Warm ambient glow wash
  brush.rect(-300, -20, 600, 320);
  
  // Outer soft watercolor bleed halo
  brush.fill(255, 200, 210, 40);
  brush.bleed(0.5, "out");
  brush.circle(0, -15, 160, true);
  
  // Layer 1: Broad translucent petals (outer tier)
  brush.bleed(0.35, "out");
  for (let i = 0; i < 5; i++) {
    let a = (TWO_PI * i) / 5 - PI / 2;
    let dist = 85;
    let px = dist * cos(a);
    let py = dist * sin(a) - 15;
    
    // Peach-to-coral petal wash
    brush.fill(255, 175, 160, 110);
    brush.beginShape(0.65);
    brush.vertex(px * 0.2, py * 0.2);
    brush.vertex(px - 38 * sin(a), py + 38 * cos(a));
    brush.vertex(px * 1.25, py * 1.25);
    brush.vertex(px + 38 * sin(a), py - 38 * cos(a));
    brush.endShape(CLOSE);
  }
  
  // Layer 2: Inner deep magenta-crimson core petal gradient
  brush.bleed(0.28, "out");
  for (let i = 0; i < 5; i++) {
    let a = (TWO_PI * i) / 5 - PI / 2 + 0.35;
    let dist = 55;
    let px = dist * cos(a);
    let py = dist * sin(a) - 15;
    
    brush.fill(215, 45, 95, 140);
    brush.beginShape(0.6);
    brush.vertex(0, -15);
    brush.vertex(px - 22 * sin(a), py + 22 * cos(a));
    brush.vertex(px * 1.1, py * 1.1);
    brush.vertex(px + 22 * sin(a), py - 22 * cos(a));
    brush.endShape(CLOSE);
  }
  
  // Layer 3: Central pistil / stamen radiation (crimson and gold)
  brush.set("charcoal", "#7a0c2e", 1.8);
  for (let i = 0; i < 8; i++) {
    let a = (TWO_PI * i) / 8 + random(-0.15, 0.15);
    let len = random(25, 45);
    brush.line(0, -15, len * cos(a), len * sin(a) - 15);
  }
  
  // Center golden pollen cluster
  brush.noStroke();
  brush.bleed(0.2, "out");
  brush.fill(245, 195, 50, 200);
  brush.circle(0, -15, 18, true);
  
  // Stamen tips (gold dots)
  brush.fill(255, 220, 90, 230);
  for (let i = 0; i < 8; i++) {
    let a = (TWO_PI * i) / 8;
    let len = random(30, 48);
    brush.circle(len * cos(a), len * sin(a) - 15, random(4, 7), true);
  }
  
  // Stem (curved organic line)
  brush.set("2B", "#2d4a2d", 2.2);
  brush.field("curved");
  brush.line(0, 15, -12, 140);
  brush.line(-12, 140, 5, 275);
  
  // Leaves (Layered Olive & Sage watercolor)
  brush.noStroke();
  brush.bleed(0.3, "out");
  
  // Right leaf
  brush.fill(75, 120, 75, 110);
  brush.beginShape(0.7);
  brush.vertex(-8, 110);
  brush.vertex(65, 80);
  brush.vertex(110, 105);
  brush.vertex(70, 135);
  brush.vertex(-5, 125);
  brush.endShape(CLOSE);
  
  // Left lower leaf
  brush.fill(55, 95, 60, 125);
  brush.beginShape(0.7);
  brush.vertex(-10, 180);
  brush.vertex(-65, 155);
  brush.vertex(-105, 185);
  brush.vertex(-60, 210);
  brush.vertex(-8, 195);
  brush.endShape(CLOSE);
  
  // Leaf vein accents
  brush.set("HB", "#1e351e", 0.9);
  brush.line(-8, 110, 100, 105);
  brush.line(-10, 180, -95, 185);
}`

const SKETCH_STREET_ANTIGRAVITY = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(108);
  
  // Deep twilight indigo atmosphere
  background(18, 20, 32);
  
  brush.noStroke();
  brush.noHatch();
  
  // Sky gradient wash (twilight violet to midnight blue)
  brush.bleed(0.45, "out");
  brush.fill(32, 28, 56, 120);
  brush.rect(-300, -300, 600, 300);
  
  // Distant hazy cityscape silhouettes
  brush.bleed(0.3, "out");
  brush.fill(22, 26, 42, 220);
  brush.rect(-280, -160, 110, 240);
  brush.rect(-150, -220, 130, 300);
  brush.rect(0, -180, 140, 260);
  brush.rect(160, -240, 120, 320);
  
  // Midground alley building blocks
  brush.fill(14, 16, 24, 250);
  brush.rect(-300, -80, 180, 280);
  brush.rect(120, -110, 180, 310);
  
  // Wet pavement wash with dramatic reflective bleed
  brush.bleed(0.4, "out");
  brush.fill(16, 22, 36, 240);
  brush.rect(-300, 100, 600, 200);
  
  // Ambient neon puddle reflections on the asphalt
  brush.bleed(0.45, "out");
  // Amber / Golden izakaya glow reflection
  brush.fill(255, 160, 50, 95);
  brush.rect(-180, 120, 120, 160);
  
  // Neon Magenta / Pink lantern reflection
  brush.fill(255, 40, 130, 90);
  brush.rect(40, 110, 100, 170);
  
  // Cyan shop sign reflection
  brush.fill(40, 220, 240, 75);
  brush.rect(-60, 140, 90, 140);
  
  // Hanging Japanese Paper Lanterns (Glowing in mid-air)
  brush.bleed(0.3, "out");
  // Red/Orange Izakaya Lanterns
  brush.fill(255, 80, 40, 240);
  brush.circle(-120, -10, 22, true);
  brush.circle(-85, 5, 18, true);
  
  // Glowing yellow lantern core
  brush.fill(255, 230, 120, 255);
  brush.circle(-120, -10, 10, true);
  brush.circle(-85, 5, 8, true);
  
  // Right side neon signs (Pink & Cyan vertical bars)
  brush.fill(255, 50, 150, 220);
  brush.rect(150, -70, 18, 75);
  brush.fill(50, 230, 255, 200);
  brush.rect(180, -40, 14, 60);
  
  // Rain streaks and electrical powerlines (fine textured charcoal/ink)
  brush.set("rotring", "#101218", 1.5);
  // Overhead power lines crossing the alley
  brush.line(-300, -180, 300, -110);
  brush.line(-300, -150, 300, -70);
  brush.line(-220, -190, 150, -50);
  
  // Rain streaks (fine directional hatch lines)
  brush.set("2B", "#657d9e", 0.7);
  for (let i = 0; i < 45; i++) {
    let rx = random(-290, 290);
    let ry = random(-280, 180);
    let len = random(25, 55);
    brush.line(rx, ry, rx - 6, ry + len);
  }
}`

async function run() {
  console.log('=== Rendering Antigravity Creative Spikes ===\n')
  const webroot = path.resolve(process.cwd(), 'webroot')
  const server = await startStaticServer(webroot, {})
  console.log(`✓ Static server running at ${server.baseUrl}`)

  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--window-position=1000,80',
    ],
  })
  const page = await browser.newPage()
  const renderer = new CanvasRenderer(page)
  await renderer.open(server.baseUrl)
  console.log('✓ Renderer tab ready\n')

  const spikeDir = path.resolve(process.cwd(), 'reports/spike')
  fs.mkdirSync(spikeDir, { recursive: true })

  // 1. Render Flower
  console.log('Rendering Flower (Antigravity style)...')
  const resFlower = await renderer.render({ code: SKETCH_FLOWER_ANTIGRAVITY, size: 600, settleMs: 2500 })
  console.log(`  Outcome: ok=${resFlower.ok}, ink=${(resFlower.inkCoverage * 100).toFixed(1)}%, colors=${resFlower.uniqueColors}`)
  if (resFlower.dataUrl) {
    const flowerPath = path.join(spikeDir, 'flower-antigravity.png')
    renderer.savePng(flowerPath, resFlower.dataUrl)
    console.log(`  ✓ Saved to ${flowerPath}\n`)
  }

  // 2. Render Street
  console.log('Rendering Street / Twilight Alley (Antigravity style)...')
  const resStreet = await renderer.render({ code: SKETCH_STREET_ANTIGRAVITY, size: 600, settleMs: 2500 })
  console.log(`  Outcome: ok=${resStreet.ok}, ink=${(resStreet.inkCoverage * 100).toFixed(1)}%, colors=${resStreet.uniqueColors}`)
  if (resStreet.dataUrl) {
    const streetPath = path.join(spikeDir, 'street-antigravity.png')
    renderer.savePng(streetPath, resStreet.dataUrl)
    console.log(`  ✓ Saved to ${streetPath}\n`)
  }

  await browser.close()
  await server.close()
  console.log('Done!')
}

run().catch(console.error)
