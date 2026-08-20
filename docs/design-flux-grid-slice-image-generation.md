# Proposal: Flux "Grid-Slice" & Multi-Image Artistry Support

## Motivation: The "Grid Hack" for Cost Savings
Our investigation into OpenRouter's Flux pricing (`black-forest-labs/flux.2-klein-4b`) suggests a tiered pricing model:
- **1MP**: ~$0.014 per image.
- **4MP**: ~$0.017 per image.

By requesting a single **4MP (2048x2048)** image containing a 2x2 grid of results and then slicing it into four **1MP (1024x1024)** quadrants, we can effectively generate four images for the price of 1.2, reducing the per-image cost from **$0.014** to **$0.00425** (a ~70% saving).

## Proposed Architecture

### 1. Virtual Provider Layer
Introduce a `GridSliceProvider` in `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/`. This provider acts as a middleware/wrapper around an underlying provider (like Replicate):
- **Request intercepted**: If `grid` parameters (e.g., `rows: 2, cols: 2`) are detected.
- **Dimensions adjusted**: Up-scale the requested resolution to fit the grid.
- **Post-processing**: Once the high-res image is generated, the `GridSliceProvider` downloads the Buffer, uses `sharp` to slice it, and returns an array of image data.

### 2. Multi-Output API Extension
Update the Artistry bridge and provider interfaces to support batches:
- **`ArtistryJobStatus`**: Add `imageUrls?: string[]` and `imageBuffers?: Buffer[]`.
- **`ReplicateProvider`**: Update to capture all URLs from the `output` array (enabling native `num_outputs > 1` support).

### 3. Native Slicing in Main Process
Use the `sharp` library in the Electron Main process for high-performance image manipulation.
```typescript
// Example Slicing Logic
async function sliceGrid(inputBuffer: Buffer, rows: number, cols: number) {
  const image = sharp(inputBuffer)
  const { width, height } = await image.metadata()
  const tileW = Math.floor(width! / cols)
  const tileH = Math.floor(height! / rows)

  const slices = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slices.push(await image.clone().extract({
        left: c * tileW,
        top: r * tileH,
        width: tileW,
        height: tileH
      }).toBuffer())
    }
  }
  return slices
}
```

### 4. Multi-Image Ingestion (Renderer)
Update the `image_journal` tool in `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/image-journal.ts`:
- Detect if the `artistryResult` contains multiple images.
- Iterate and call `backgroundStore.addBackground` for each result.
- Update the Artistry widget to show the latest result or a "batch" indicator.

## Component Impact Map
- **`artistry-bridge.ts`**: Registering the virtual provider and coordinating fetch/slice.
- **`replicate.ts`**: Exposing multi-output arrays.
- **`artistry.ts` (Store)**: Adding UI toggles for Grid Mode.
- **`image-journal.ts`**: Handling batch ingestion into the Background Store.

## Next Steps (Post-Pivoting)
- [ ] Add `sharp` dependency to `@proj-airi/stage-tamagotchi`.
- [ ] Implement `GridSliceProvider` core.
- [ ] Update `ReplicateProvider` for native batching.
- [ ] Implement the UI settings in the Artistry tab.

## Relevant Skills

- [[airi-artistry-comfyui-widgets]]
