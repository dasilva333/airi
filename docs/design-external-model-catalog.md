# Architecture & Protocol Specification: External HTTP Avatar Catalog (v1)

> **Document Status:** Standard Specification & Reference Blueprint
> **Target Subsystem:** `@proj-airi/stage-ui` (Model Selector, Display Models Store)
> **Reference Backend:** `airi-external-catalog` (Express + SQLite FTS5)
> **Last Updated:** 2026-10-12

---

## 1. Executive Summary & Problem Space

AIRI natively supports avatar models through two standard mechanisms:
1. **Local Library (`displayModelsStore`)**: Direct binary storage in IndexedDB (`localforage`) keyed by `display-model-<nanoid>` with in-memory thumbnail caching.
2. **BYOS Cloud Sync (`sync-engine.ts`)**: Two-way delta synchronization across devices (via S3, Cloudflare R2, or local filesystem) using `assets/models/manifest.json` and synthetic `assets/models/${id}.bin` blobs.

### The 20K+ Model Scaling Barrier
Power users with extensive 3D/2D avatar libraries (e.g., 20,000+ VRM, Live2D Cubism, Spine, and MMD models totaling 200GB+) face critical architectural bottlenecks when using traditional synchronization models:
- **Forced Renaming & Container Wrapping**: BYOS converts original named model files (`model.vrm`, `character.zip`) into opaque nanoid `.bin` payloads, destroying filesystem interoperability with external tools.
- **Two-Way Reconciliation Overhead**: Sync engines perform periodic full-catalog diffing over `manifest.json`. Parsing, comparing, and serializing a 30MB–60MB manifest file on every heartbeat exhausts browser memory and causes severe UI stutter.
- **Client Storage Quotas**: Storing tens of thousands of model records and preview textures in client IndexedDB exceeds browser quota limits and exhausts Pinia reactive memory.
- **Redundant Processing**: Users with large collections frequently already maintain external indices (tag databases, pre-rendered thumbnails, categorizations) outside AIRI.

### The External Catalog Solution
The **External HTTP Avatar Catalog (v1)** decouples catalog indexing and binary storage from AIRI's internal state machine:
- **Read-Only On-Demand Repository**: AIRI interacts with the catalog strictly as an HTTP/HTTPS client. AIRI never pushes mutations to the external server.
- **Server-Side Search & Pagination**: SQLite FTS5 provides sub-10ms full-text and tag searches across tens of thousands of records, returning lightweight paginated slices (default 50 items).
- **Zero Client Overhead**: Un-downloaded models consume zero local storage.
- **Native File Preservation**: Models are served in their original formats (`.zip`, `.vrm`, `.pmx`, `.skel`).
- **One-Click Local Staging**: On user request, the client streams the model archive and its pre-rendered thumbnail directly into the local IndexedDB library, un-proxying all attributes to guarantee binary and structured-clone safety.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   External Catalog Server / Service                    │
│                                                                        │
│   ┌─────────────────────┐               ┌──────────────────────────┐   │
│   │   SQLite Database   │               │   Avatar File Storage    │   │
│   │   (catalog.db)      │               │   (Disk / NAS / S3)      │   │
│   │ - models table      │               │ - triage/live2d/*.zip    │   │
│   │ - models_fts (FTS5) │               │ - triage/vrm/*.vrm       │   │
│   └──────────┬──────────┘               │ - thumbnails/*.png       │   │
│              │                          └────────────┬─────────────┘   │
│              │ Dynamic SQL queries                   │ Stream file     │
│              ▼                                       ▼                 │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 Express / Fastify REST API                     │   │
│   │  GET /api/v1/models/stats      (Live aggregates)               │   │
│   │  GET /api/v1/models            (FTS5 query, pagination)        │   │
│   │  GET /api/v1/models/:id        (Single model detail)           │   │
│   │  GET /api/v1/models/:id/thumb  (Static cached image)           │   │
│   │  GET /api/v1/models/:id/down   (Chunked binary stream)         │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ HTTP / HTTPS (JSON + Streams)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              AIRI Client                               │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │     Model Selector Dialog (`model-selector.vue` - Cloud)       │   │
│   │ - Server URL Config Popover (`localStorage` persistent)        │   │
│   │ - Live Server Health Badge & Library Stats                     │   │
│   │ - Format Filter Chips (Live2D, VRM, Spine, MMD)                │   │
│   │ - Infinite Scroll Sentinel & "Load More" Pagination            │   │
│   │ - Lazy Thumbnail Images (direct <img> tags, browser cached)    │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Click "Download"                   │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │       Client Ingestion Pipeline (`display-models.ts`)          │   │
│   │ 1. Stream binary -> File/Blob                                  │   │
│   │ 2. Fetch remote thumbnail -> Persistent DataURL                │   │
│   │ 3. Deep un-proxy (`toPlainModel`) to avoid structuredClone bug │   │
│   │ 4. Atomic persist to `localforage` IndexedDB                   │   │
│   │ 5. Immediate stage binding & character selection               │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Protocol & REST Endpoints Specification

Any external catalog implementation (whether written in Node.js, Go, Python, Rust, or a Cloudflare Worker) that conforms to the following 5 endpoints is 100% compatible with AIRI.

### Base URL Convention
The catalog server is addressed by its root origin (e.g. `http://192.168.1.50:8085` or `https://catalog.example.com`). All API endpoints are mounted under `/api/v1/models`.

---

### Endpoint 1: System Statistics
Returns real-time aggregate statistics about the catalog. Used by the AIRI UI to display catalog size, available models, and connection status.

- **Method:** `GET`
- **Path:** `/api/v1/models/stats`
- **Headers:**
  - `Accept: application/json`

#### Response: `200 OK`
```json
{
  "total_models": 21843,
  "by_type": {
    "live2d": 17982,
    "spine": 2961,
    "vrm": 867,
    "mmd": 20,
    "vrma": 13
  },
  "total_bytes": 254278844249,
  "models_with_thumbnails": 21460
}
```

#### Field Definitions
| Field | Type | Description |
|---|---|---|
| `total_models` | `number` | Total number of models indexed in the catalog. |
| `by_type` | `Record<string, number>` | Model count broken down by format category (`live2d`, `vrm`, `spine`, `mmd`, `vrma`). |
| `total_bytes` | `number` | Total cumulative size of all model archives on storage in bytes. |
| `models_with_thumbnails` | `number` | Number of indexed models with a verified thumbnail image available. |

---

### Endpoint 2: Paginated Model Search & Listing
Returns a paginated list of avatar models matching query filters.

- **Method:** `GET`
- **Path:** `/api/v1/models`
- **Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | `string` | `""` | Search query text. Matches against title, creator, tags, or description via full-text search. |
| `type` | `string` | `""` (all) | Format filter. Permitted values: `live2d`, `vrm`, `spine`, `mmd`, `vrma`, or empty for all. |
| `tags` | `string` | `""` | Comma-separated list of tags to filter by (e.g. `1girl,uniform`). |
| `tag_mode` | `string` | `"and"` | `"and"` requires all tags; `"or"` matches any tag. |
| `nsfw` | `string` | `"sfw"` | Content safety filter: `"sfw"` (SFW only), `"nsfw"` (NSFW only), or `"all"`. |
| `page` | `number` | `1` | 1-based page number. |
| `limit` | `number` | `50` | Maximum items to return per page (typically 20–100). |
| `sort` | `string` | `"created_at"` | Sort field: `"title"`, `"file_size"`, or `"created_at"`. |
| `order` | `string` | `"desc"` | Sort direction: `"asc"` or `"desc"`. |

#### Response: `200 OK`
```json
{
  "total": 21843,
  "page": 1,
  "limit": 50,
  "pages": 437,
  "items": [
    {
      "id": "nizima_10001",
      "title": "Nizima Model 10001",
      "model_type": "live2d",
      "format": "zip",
      "file_size": 615534,
      "has_thumbnail": true,
      "thumbnail_url": "/api/v1/models/nizima_10001/thumbnail",
      "download_url": "/api/v1/models/nizima_10001/download",
      "tags": [
        "solo",
        "1girl",
        "elbow gloves",
        "dress",
        "long hair"
      ],
      "creator": "ArtistName",
      "source": "nizima",
      "nsfw": false,
      "created_at": "2026-10-12T15:19:57.487Z"
    }
  ]
}
```

#### Item Schema (`ModelListItem`)
| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the model in the catalog. |
| `title` | `string` | Human-readable model display name. |
| `model_type` | `string` | Canonical avatar format: `"live2d"`, `"vrm"`, `"spine"`, `"mmd"`, or `"vrma"`. |
| `format` | `string` | File container extension: `"zip"`, `"vrm"`, `"skel"`, `"pmx"`, `"lpk"`. |
| `file_size` | `number` | Archive size in bytes. |
| `has_thumbnail`| `boolean` | Whether a preview thumbnail is available for this model. |
| `thumbnail_url`| `string \| null`| Relative path to thumbnail endpoint (e.g. `/api/v1/models/:id/thumbnail`). |
| `download_url` | `string` | Relative path to archive download endpoint (e.g. `/api/v1/models/:id/download`). |
| `tags` | `string[]` | Clean array of descriptive tags. |
| `creator` | `string \| null`| Author, rigger, or modeler attribution. |
| `source` | `string \| null`| Provenance origin (e.g. `"nizima"`, `"booth"`, `"steam_workshop"`, `"iriam"`). |
| `nsfw` | `boolean` | Flag indicating explicit or mature content. |
| `created_at` | `string` | ISO 8601 timestamp of record ingestion. |

---

### Endpoint 3: Model Detail
Returns full metadata, provenance history, and storage paths for a specific model ID.

- **Method:** `GET`
- **Path:** `/api/v1/models/:id`
- **Response:** `200 OK` (JSON) or `404 Not Found`

```json
{
  "id": "nizima_10001",
  "title": "Nizima Model 10001",
  "model_type": "live2d",
  "format": "zip",
  "container_path": "triage/live2d/10001.zip",
  "container_filename": "10001.zip",
  "file_size": 615534,
  "thumbnail_path": "dist_index/triage/live2d/10001.png",
  "thumbnail_filename": "10001.png",
  "tags": ["solo", "1girl", "dress"],
  "creator": "ArtistName",
  "source": "nizima",
  "provenance": {
    "source_type": "nizima",
    "source_collection": "podi-copyparty",
    "original_filename": "10001",
    "selected_revision": "bc63963acb5a56f9"
  },
  "nsfw": false,
  "created_at": "2026-10-12T15:19:57.487Z",
  "updated_at": "2026-10-12T15:19:57.487Z",
  "has_thumbnail": true,
  "thumbnail_url": "/api/v1/models/nizima_10001/thumbnail",
  "download_url": "/api/v1/models/nizima_10001/download"
}
```

---

### Endpoint 4: Stream Thumbnail Image
Streams the cached preview image for a model.

- **Method:** `GET`
- **Path:** `/api/v1/models/:id/thumbnail`
- **Response Headers:**
  - `Content-Type: image/png` (or `image/webp` / `image/jpeg`)
  - `Content-Length: <bytes>`
  - `Cache-Control: public, max-age=31536000, immutable`
  - `Access-Control-Allow-Origin: *`
- **Status:** `200 OK` with binary image body, or `404 Not Found`.

> **Performance Rule:** Because model preview thumbnails are immutable representations of a model snapshot, the server **MUST** send long-lived caching headers (`max-age=31536000, immutable`). The browser and Electron renderer automatically cache these images in memory and disk cache, eliminating repeat network round-trips when scrolling.

---

### Endpoint 5: Stream Model Archive (Download)
Streams the raw model file (.zip, .vrm, .pmx, .skel) for ingestion by AIRI.

- **Method:** `GET`
- **Path:** `/api/v1/models/:id/download`
- **Response Headers:**
  - `Content-Type: application/octet-stream` (or `application/zip`, `model/gltf-binary`)
  - `Content-Disposition: attachment; filename="<container_filename>"`
  - `Content-Length: <file_size>`
  - `Accept-Ranges: bytes`
  - `Access-Control-Allow-Origin: *`
- **Status:** `200 OK` (or `206 Partial Content` if Range requested).

---

## 4. AIRI Client Integration Contract

### 1. Connection & State Management
In `packages/stage-ui/src/components/scenarios/dialogs/model-selector/model-selector.vue`:
- The user selects **External Catalog (HTTP)** from the Cloud source dropdown.
- The server base URL is stored in `useLocalStorage('airi:settings:external-catalog-url', 'http://localhost:8085')`.
- The client validates connectivity by issuing a `GET /api/v1/models/stats` request.
  - If successful, a green dot indicates online status and displays total library size and model count.
  - If the server is offline, an inline retry banner explains that the server is unreachable.

### 2. The Structured-Clone / Proxy-Stripping Invariant
When AIRI downloads an external model, it must store it in IndexedDB (`localforage`).
A known failure mode occurs if Vue 3 reactive proxies are passed into IndexedDB:
```
DOMException: Failed to execute 'put' on 'IDBObjectStore': [object Array] could not be cloned.
```

**Required Client Pattern:**
All data passed from the UI into `displayModelsStore` MUST pass through `toPlainModel()` to guarantee clean structured cloning:
```ts
function toPlainModel<T>(obj: T): T {
  if (obj === null || obj === undefined)
    return obj
  if (typeof obj !== 'object')
    return obj
  if (obj instanceof Blob || obj instanceof File || obj instanceof ArrayBuffer)
    return toRaw(obj) as any
  if (Array.isArray(obj)) {
    const rawArr = toRaw(obj)
    return rawArr.map(item => toPlainModel(item)) as any
  }
  const rawObj = toRaw(obj) as any
  const clean: any = {}
  for (const key of Object.keys(rawObj)) {
    clean[key] = toPlainModel(rawObj[key])
  }
  return clean
}
```

### 3. Persistent Offline Thumbnail Caching
When downloading a model from the external catalog, AIRI simultaneously fetches the server thumbnail and encodes it as a base64 `DataURL` stored inside the IndexedDB record. This guarantees that once downloaded, the model will render its preview thumbnail in the **Library** tab even when the user disconnects from the LAN catalog server.

---

## 5. Reference Backend Implementation Blueprint

A turnkey reference implementation exists in `airi-external-catalog` (Node.js 22 + TypeScript + Express + Knex + SQLite FTS5).

### 1. Database Schema (`data/catalog.db`)

```sql
-- Core Models Table
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  model_type TEXT NOT NULL,
  format TEXT NOT NULL,
  container_path TEXT NOT NULL,
  container_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  thumbnail_path TEXT,
  thumbnail_filename TEXT,
  tags TEXT NOT NULL,            -- JSON array of strings
  creator TEXT,
  source TEXT,
  provenance TEXT,              -- JSON object
  nsfw INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indices for fast filtering
CREATE INDEX IF NOT EXISTS idx_models_type ON models(model_type);
CREATE INDEX IF NOT EXISTS idx_models_nsfw ON models(nsfw);
CREATE INDEX IF NOT EXISTS idx_models_created ON models(created_at);

-- FTS5 Full-Text Search Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS models_fts USING fts5(
  id,
  title,
  creator,
  tags,
  content='models',
  content_rowid='rowid'
);

-- Triggers for automatic FTS5 synchronization
CREATE TRIGGER IF NOT EXISTS models_ai AFTER INSERT ON models BEGIN
  INSERT INTO models_fts(rowid, id, title, creator, tags)
  VALUES (new.rowid, new.id, new.title, new.creator, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS models_ad AFTER DELETE ON models BEGIN
  INSERT INTO models_fts(models_fts, rowid, id, title, creator, tags)
  VALUES('delete', old.rowid, old.id, old.title, old.creator, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS models_au AFTER UPDATE ON models BEGIN
  INSERT INTO models_fts(models_fts, rowid, id, title, creator, tags)
  VALUES('delete', old.rowid, old.id, old.title, old.creator, old.tags);
  INSERT INTO models_fts(rowid, id, title, creator, tags)
  VALUES (new.rowid, new.id, new.title, new.creator, new.tags);
END;
```

### 2. Multi-Schema Sidecar Ingestion
Avatar collections typically originate from disparate sources (e.g. Steam Workshop, Nizima, Booth, IRIAM, eikanya/Live2D-Viewer). The catalog indexer (`scan-and-ingest.ts`) handles multi-schema sidecar normalization:
- **Schema 1.0**: `{ container: { file_name, file_size }, thumbnail, tags: [] }`.
- **Legacy Steam Workshop**: `{ file: "live2d_*.zip", steam_id, subscriptions, tags: [] }`.
- **Bare Archives**: Files with matching basenames (`model.zip` + `model.png` + `model.json`).
- **Secondary Thumbnail Resolution**: When thumbnails are not colocated with the container archive, the scanner checks secondary web gallery caches (`dist_index/thumbnails/` and `dist_index/triage/<format>/`) using stripped IDs (`10001.png` for `nizima_10001`), ensuring over 98%+ thumbnail coverage.

---

## 6. Deployment & Self-Hosting Recipes

### Option A: Local LAN / NAS (Recommended)
1. Place the catalog server project on your desktop or NAS alongside your avatar models drive (`E:\Avatar Models` or `/mnt/avatars`).
2. Configure `.env`:
   ```ini
   PORT=8085
   MODELS_ROOT=E:\Avatar Models
   TRIAGE_DIR=E:\Avatar Models\triage
   DIST_INDEX_DIR=E:\Avatar Models\dist_index
   ```
3. Run ingestion:
   ```bash
   npm run migrate
   npm run scan
   ```
4. Start server:
   ```bash
   npm start
   ```
5. In AIRI, open the Model Selector Cloud tab, select **External Catalog (HTTP)**, and enter `http://<your-lan-ip>:8085`.

### Option B: Remote VPS / CDN with Basic Authentication or Tailscale
- **Tailscale / WireGuard**: Bind the Express server to your Tailscale IP (`100.x.y.z:8085`). AIRI running on any of your devices (Mac, Windows, iOS, Android) within your tailnet connects securely without exposing ports to the public internet.
- **Reverse Proxy with Caddy**:
  ```caddyfile
  catalog.my-domain.com {
      reverse_proxy localhost:8085
      header {
          Access-Control-Allow-Origin *
          Access-Control-Allow-Methods "GET, OPTIONS"
      }
  }
  ```

---

## 7. Roadmap & Future Enhancements

1. **Category & Collection Facets**: Group models into arbitrary collections (e.g., "Genshin Impact", "Hololive", "VTuber Originals") via a dedicated `/api/v1/collections` endpoint.
2. **On-the-fly Mesh / Motion Transcoding**: Server-side WebAssembly conversions for older legacy formats (e.g. Spine 3.x to 4.1 or MMD PMD to PMX) before streaming to the client.
3. **Multi-Server Catalog Aggregator**: Allow AIRI to register multiple external catalog endpoints simultaneously (e.g., "Personal Archive", "Community Roster", "Team Shared NAS").
