import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const rootStageMate = resolve(here, '..')
const mateEngineDir = resolve(rootStageMate, 'mate-engine')
const defaultScenePath = resolve(mateEngineDir, 'Assets', 'MATE ENGINE - Scenes', 'Mate Engine Main.unity')

export interface GameObjectData {
  id: string
  name: string
  isActive: boolean
  layer: number
  tag: string
  components: string[] // fileIDs
  transformId?: string
}

export interface TransformData {
  id: string
  gameObjectId: string
  fatherId?: string
  childrenIds: string[]
  isRectTransform: boolean
  anchoredPosition?: { x: number, y: number }
  sizeDelta?: { x: number, y: number }
}

export interface MonoBehaviourData {
  id: string
  gameObjectId: string
  scriptGuid?: string
  scriptName?: string
  customFields: Record<string, any>
}

export interface OtherComponentData {
  id: string
  classId: number
  typeName: string
  gameObjectId: string
}

export interface SceneGraph {
  gameObjects: Map<string, GameObjectData>
  transforms: Map<string, TransformData>
  monoBehaviours: Map<string, MonoBehaviourData>
  otherComponents: Map<string, OtherComponentData>
  rootTransformIds: string[]
  guidToScriptName: Map<string, string>
  parseTimeMs: number
}

// Build a cache of Script GUID -> C# Class Name by scanning .meta files
export function buildGuidCache(assetsDir: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!existsSync(assetsDir))
    return map

  function scan(dir: string) {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        scan(full)
      }
      else if (entry.endsWith('.cs.meta')) {
        const scriptBase = entry.replace(/\.meta$/, '')
        try {
          const content = readFileSync(full, 'utf8')
          const guidMatch = content.match(/guid:\s*([a-f0-9]{32})/i)
          if (guidMatch) {
            map.set(guidMatch[1], scriptBase.replace(/\.cs$/, ''))
          }
        }
        catch {}
      }
    }
  }

  scan(assetsDir)
  return map
}

const CLASS_NAMES: Record<number, string> = {
  1: 'GameObject',
  4: 'Transform',
  20: 'Camera',
  21: 'Material',
  23: 'MeshRenderer',
  33: 'MeshFilter',
  43: 'MeshCollider',
  54: 'Rigidbody',
  64: 'MeshCollider',
  65: 'BoxCollider',
  82: 'AudioSource',
  95: 'Animator',
  108: 'Light',
  114: 'MonoBehaviour',
  136: 'CapsuleCollider',
  137: 'SkinnedMeshRenderer',
  198: 'ParticleSystem',
  222: 'CanvasRenderer',
  223: 'Canvas',
  224: 'RectTransform',
  225: 'CanvasGroup',
}

export function parseUnityScene(scenePath: string = defaultScenePath, guidCache?: Map<string, string>): SceneGraph {
  const start = performance.now()
  if (!existsSync(scenePath)) {
    throw new Error(`Unity scene file not found: ${scenePath}`)
  }

  if (!guidCache) {
    guidCache = buildGuidCache(resolve(mateEngineDir, 'Assets'))
  }

  const content = readFileSync(scenePath, 'utf8')
  const lines = content.split(/\r?\n/)

  const gameObjects = new Map<string, GameObjectData>()
  const transforms = new Map<string, TransformData>()
  const monoBehaviours = new Map<string, MonoBehaviourData>()
  const otherComponents = new Map<string, OtherComponentData>()

  let curClassId = 0
  let curFileId = ''
  let curProps: Record<string, any> = {}

  function commitCurrent() {
    if (!curFileId)
      return

    if (curClassId === 1) {
      // GameObject
      gameObjects.set(curFileId, {
        id: curFileId,
        name: curProps.m_Name ?? 'Unnamed',
        isActive: curProps.m_IsActive !== '0',
        layer: Number.parseInt(curProps.m_Layer ?? '0', 10),
        tag: curProps.m_TagString ?? 'Untagged',
        components: curProps.components ?? [],
      })
    }
    else if (curClassId === 4 || curClassId === 224) {
      // Transform or RectTransform
      transforms.set(curFileId, {
        id: curFileId,
        gameObjectId: curProps.m_GameObject ?? '',
        fatherId: curProps.m_Father,
        childrenIds: curProps.children ?? [],
        isRectTransform: curClassId === 224,
        anchoredPosition: curProps.anchoredPos,
        sizeDelta: curProps.sizeDelta,
      })
    }
    else if (curClassId === 114) {
      // MonoBehaviour
      const guid = curProps.scriptGuid
      const scriptName = guid ? guidCache?.get(guid) : undefined
      monoBehaviours.set(curFileId, {
        id: curFileId,
        gameObjectId: curProps.m_GameObject ?? '',
        scriptGuid: guid,
        scriptName: scriptName ?? curProps.m_EditorClassIdentifier ?? 'MonoBehaviour',
        customFields: curProps.customFields ?? {},
      })
    }
    else {
      // Other Component
      const typeName = CLASS_NAMES[curClassId] || `Component_${curClassId}`
      if (curProps.m_GameObject) {
        otherComponents.set(curFileId, {
          id: curFileId,
          classId: curClassId,
          typeName,
          gameObjectId: curProps.m_GameObject,
        })
      }
    }

    curFileId = ''
    curClassId = 0
    curProps = {}
  }

  let inChildrenList = false
  let inComponentList = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('--- !u!')) {
      commitCurrent()
      inChildrenList = false
      inComponentList = false

      const match = line.match(/^---\s*!u!(\d+)\s*&(\d+)/)
      if (match) {
        curClassId = Number.parseInt(match[1], 10)
        curFileId = match[2]
      }
      continue
    }

    if (!curFileId)
      continue

    if (curClassId === 1) {
      // GameObject parsing
      if (line.startsWith('  m_Name: ')) {
        curProps.m_Name = line.slice(10).trim()
      }
      else if (line.startsWith('  m_IsActive: ')) {
        curProps.m_IsActive = line.slice(14).trim()
      }
      else if (line.startsWith('  m_Layer: ')) {
        curProps.m_Layer = line.slice(11).trim()
      }
      else if (line.startsWith('  m_TagString: ')) {
        curProps.m_TagString = line.slice(15).trim()
      }
      else if (line.startsWith('  m_Component:')) {
        inComponentList = true
        curProps.components = []
      }
      else if (inComponentList) {
        if (line.startsWith('  - component: {fileID: ')) {
          const compMatch = line.match(/fileID:\s*(\d+)/)
          if (compMatch)
            curProps.components.push(compMatch[1])
        }
        else if (!line.startsWith('  - ') && !line.startsWith('    ')) {
          inComponentList = false
        }
      }
    }
    else if (curClassId === 4 || curClassId === 224) {
      // Transform / RectTransform parsing
      if (line.startsWith('  m_GameObject: {fileID: ')) {
        const goMatch = line.match(/fileID:\s*(\d+)/)
        if (goMatch)
          curProps.m_GameObject = goMatch[1]
      }
      else if (line.startsWith('  m_Father: {fileID: ')) {
        const fatherMatch = line.match(/fileID:\s*(\d+)/)
        if (fatherMatch && fatherMatch[1] !== '0')
          curProps.m_Father = fatherMatch[1]
      }
      else if (line.startsWith('  m_Children:')) {
        inChildrenList = true
        curProps.children = []
      }
      else if (inChildrenList) {
        if (line.startsWith('  - {fileID: ')) {
          const childMatch = line.match(/fileID:\s*(\d+)/)
          if (childMatch)
            curProps.children.push(childMatch[1])
        }
        else if (!line.startsWith('  - ') && !line.startsWith('    ')) {
          inChildrenList = false
        }
      }
      else if (curClassId === 224) {
        if (line.startsWith('  m_AnchoredPosition: {x: ')) {
          const posMatch = line.match(/x:\s*([^,]+),\s*y:\s*([^}]+)/)
          if (posMatch) {
            curProps.anchoredPos = {
              x: Number.parseFloat(posMatch[1]),
              y: Number.parseFloat(posMatch[2]),
            }
          }
        }
        else if (line.startsWith('  m_SizeDelta: {x: ')) {
          const sizeMatch = line.match(/x:\s*([^,]+),\s*y:\s*([^}]+)/)
          if (sizeMatch) {
            curProps.sizeDelta = {
              x: Number.parseFloat(sizeMatch[1]),
              y: Number.parseFloat(sizeMatch[2]),
            }
          }
        }
      }
    }
    else if (curClassId === 114) {
      // MonoBehaviour parsing
      if (line.startsWith('  m_GameObject: {fileID: ')) {
        const goMatch = line.match(/fileID:\s*(\d+)/)
        if (goMatch)
          curProps.m_GameObject = goMatch[1]
      }
      else if (line.startsWith('  m_Script: {fileID: 11500000, guid: ')) {
        const guidMatch = line.match(/guid:\s*([a-f0-9]{32})/i)
        if (guidMatch)
          curProps.scriptGuid = guidMatch[1]
      }
      else if (line.startsWith('  m_EditorClassIdentifier: ')) {
        const id = line.slice(27).trim()
        if (id)
          curProps.m_EditorClassIdentifier = id
      }
    }
    else {
      // Other components (Canvas, Camera, Renderer, Light, etc.)
      if (line.startsWith('  m_GameObject: {fileID: ')) {
        const goMatch = line.match(/fileID:\s*(\d+)/)
        if (goMatch)
          curProps.m_GameObject = goMatch[1]
      }
    }
  }

  commitCurrent()

  // Link GameObjects to their Transform/RectTransform
  for (const [tfId, tf] of transforms.entries()) {
    const go = gameObjects.get(tf.gameObjectId)
    if (go) {
      go.transformId = tfId
    }
  }

  // Find root transforms (transforms with no fatherId or fatherId == '0')
  const rootTransformIds: string[] = []
  for (const [tfId, tf] of transforms.entries()) {
    if (!tf.fatherId || !transforms.has(tf.fatherId)) {
      rootTransformIds.push(tfId)
    }
  }

  const end = performance.now()

  return {
    gameObjects,
    transforms,
    monoBehaviours,
    otherComponents,
    rootTransformIds,
    guidToScriptName: guidCache,
    parseTimeMs: Math.round(end - start),
  }
}

// -----------------------------------------------------------------------------
// Tree Formatter & Queries
// -----------------------------------------------------------------------------

export function formatNodeSummary(graph: SceneGraph, go: GameObjectData, tf?: TransformData): string {
  const status = go.isActive ? '🟢 Active' : '🔴 Inactive'
  const comps: string[] = []

  // Attached MonoBehaviours
  for (const compId of go.components) {
    const mb = graph.monoBehaviours.get(compId)
    if (mb) {
      comps.push(`Script:${mb.scriptName}`)
      continue
    }
    const other = graph.otherComponents.get(compId)
    if (other) {
      comps.push(other.typeName)
    }
  }

  let rectInfo = ''
  if (tf?.isRectTransform) {
    const pos = tf.anchoredPosition ? `pos:(${Math.round(tf.anchoredPosition.x)}, ${Math.round(tf.anchoredPosition.y)})` : ''
    const size = tf.sizeDelta ? `size:${Math.round(tf.sizeDelta.x)}x${Math.round(tf.sizeDelta.y)}` : ''
    rectInfo = ` [Rect ${[pos, size].filter(Boolean).join(' ')}]`
  }

  const compStr = comps.length > 0 ? ` (${comps.join(', ')})` : ''
  return `${go.name} [ID:${go.id}] [${status}]${rectInfo}${compStr}`
}

export function renderSubtree(
  graph: SceneGraph,
  transformId: string,
  prefix = '',
  isLast = true,
  maxDepth = 20,
  currentDepth = 0,
): string[] {
  const tf = graph.transforms.get(transformId)
  if (!tf)
    return []

  const go = graph.gameObjects.get(tf.gameObjectId)
  if (!go)
    return []

  const connector = currentDepth === 0 ? '' : isLast ? '└── ' : '├── '
  const line = `${prefix}${connector}${formatNodeSummary(graph, go, tf)}`
  const lines = [line]

  if (currentDepth >= maxDepth) {
    if (tf.childrenIds.length > 0) {
      const childPrefix = prefix + (currentDepth === 0 ? '' : isLast ? '    ' : '│   ')
      lines.push(`${childPrefix}└── ... (${tf.childrenIds.length} children truncated)`)
    }
    return lines
  }

  const childPrefix = prefix + (currentDepth === 0 ? '' : isLast ? '    ' : '│   ')
  for (let i = 0; i < tf.childrenIds.length; i++) {
    const childId = tf.childrenIds[i]
    const isLastChild = i === tf.childrenIds.length - 1
    const childLines = renderSubtree(graph, childId, childPrefix, isLastChild, maxDepth, currentDepth + 1)
    lines.push(...childLines)
  }

  return lines
}

export function findNodes(graph: SceneGraph, query: string): Array<{ go: GameObjectData, tf?: TransformData, path: string }> {
  const q = query.trim().toLowerCase()
  const results: Array<{ go: GameObjectData, tf?: TransformData, path: string }> = []

  for (const go of graph.gameObjects.values()) {
    const tf = go.transformId ? graph.transforms.get(go.transformId) : undefined
    let matched = false

    if (go.name.toLowerCase().includes(q) || go.id === q) {
      matched = true
    }

    if (!matched) {
      for (const compId of go.components) {
        const mb = graph.monoBehaviours.get(compId)
        if (mb && (mb.scriptName?.toLowerCase().includes(q) || mb.scriptGuid?.toLowerCase() === q)) {
          matched = true
          break
        }
        const other = graph.otherComponents.get(compId)
        if (other && other.typeName.toLowerCase().includes(q)) {
          matched = true
          break
        }
      }
    }

    if (matched) {
      const path = getBreadcrumbPath(graph, go)
      results.push({ go, tf, path })
    }
  }

  return results
}

export function getBreadcrumbPath(graph: SceneGraph, go: GameObjectData): string {
  const parts: string[] = [go.name]
  let curTfId = go.transformId

  while (curTfId) {
    const curTf = graph.transforms.get(curTfId)
    if (!curTf || !curTf.fatherId)
      break
    const fatherTf = graph.transforms.get(curTf.fatherId)
    if (!fatherTf)
      break
    const fatherGo = graph.gameObjects.get(fatherTf.gameObjectId)
    if (!fatherGo)
      break
    parts.unshift(`${fatherGo.name}${fatherGo.isActive ? '' : ' [Inactive]'}`)
    curTfId = curTf.fatherId
  }

  return parts.join(' > ')
}

export function getAncestorChain(graph: SceneGraph, go: GameObjectData): Array<{ go: GameObjectData, tf: TransformData }> {
  const chain: Array<{ go: GameObjectData, tf: TransformData }> = []
  let curTfId = go.transformId

  while (curTfId) {
    const tf = graph.transforms.get(curTfId)
    if (!tf)
      break
    const currentGo = graph.gameObjects.get(tf.gameObjectId)
    if (currentGo) {
      chain.unshift({ go: currentGo, tf })
    }
    if (!tf.fatherId)
      break
    curTfId = tf.fatherId
  }

  return chain
}

// -----------------------------------------------------------------------------
// Markdown Generator
// -----------------------------------------------------------------------------

export function generateMarkdownHierarchy(graph: SceneGraph, sceneName = 'Mate Engine Main'): string {
  const lines: string[] = []
  lines.push(`# Unity Scene Hierarchy Map: \`${sceneName}\``)
  lines.push('')
  lines.push(`> Automatically generated in **${graph.parseTimeMs} ms**. Total GameObjects: **${graph.gameObjects.size}**, Total Transforms: **${graph.transforms.size}**, Total MonoBehaviours: **${graph.monoBehaviours.size}**.`)
  lines.push('')
  lines.push('## Root Object Index')
  lines.push('')

  for (const rootTfId of graph.rootTransformIds) {
    const tf = graph.transforms.get(rootTfId)
    if (!tf)
      continue
    const go = graph.gameObjects.get(tf.gameObjectId)
    if (!go)
      continue
    const anchor = go.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    lines.push(`- [${go.name}](#${anchor}) (${go.isActive ? 'Active' : 'Inactive'}, ${tf.childrenIds.length} direct children)`)
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Scene Hierarchies')
  lines.push('')

  for (const rootTfId of graph.rootTransformIds) {
    const tf = graph.transforms.get(rootTfId)
    if (!tf)
      continue
    const go = graph.gameObjects.get(tf.gameObjectId)
    if (!go)
      continue

    lines.push(`### ${go.name}`)
    lines.push('')
    lines.push('<details><summary>Click to expand hierarchy tree</summary>')
    lines.push('')
    lines.push('```text')
    const treeLines = renderSubtree(graph, rootTfId, '', true, 15)
    lines.push(...treeLines)
    lines.push('```')
    lines.push('')
    lines.push('</details>')
    lines.push('')
  }

  return lines.join('\n')
}

// -----------------------------------------------------------------------------
// CLI Runner
// -----------------------------------------------------------------------------

export function runCli(argv: string[] = process.argv.slice(2)) {
  const cmd = argv[0] || 'help'
  const arg1 = argv[1]
  const arg2 = argv[2]

  const sceneFile = argv.find(a => a.endsWith('.unity')) || defaultScenePath

  console.log(`[scene-tree] Inspecting scene: ${basename(sceneFile)}...`)
  const graph = parseUnityScene(sceneFile)
  console.log(`[scene-tree] Indexed ${graph.gameObjects.size} GameObjects in ${graph.parseTimeMs}ms.\n`)

  switch (cmd) {
    case 'tree': {
      let rootTfId = graph.rootTransformIds[0]
      if (arg1) {
        const matches = findNodes(graph, arg1)
        if (matches.length === 0) {
          console.error(`❌ No GameObject found matching: "${arg1}"`)
          process.exit(1)
        }
        if (matches.length > 1) {
          console.log(`⚠️ Multiple matches found for "${arg1}". Showing first match:`)
          for (const m of matches) {
            console.log(`  - ${m.path} [ID: ${m.go.id}]`)
          }
          console.log('')
        }
        const target = matches[0]
        if (!target.tf) {
          console.error(`❌ Matched GameObject has no Transform: ${target.go.name}`)
          process.exit(1)
        }
        rootTfId = target.tf.id
      }

      const depth = arg2 ? Number.parseInt(arg2, 10) : 10
      const treeLines = renderSubtree(graph, rootTfId, '', true, depth)
      console.log(treeLines.join('\n'))
      break
    }

    case 'find': {
      if (!arg1) {
        console.error('Usage: scene-tree find <name|guid|id>')
        process.exit(1)
      }
      const matches = findNodes(graph, arg1)
      console.log(`Found ${matches.length} matches for "${arg1}":\n`)
      for (const m of matches) {
        console.log(`📍 ${formatNodeSummary(graph, m.go, m.tf)}`)
        console.log(`   Breadcrumb: ${m.path}\n`)
      }
      break
    }

    case 'path':
    case 'ancestors': {
      if (!arg1) {
        console.error('Usage: scene-tree path <name|id>')
        process.exit(1)
      }
      const matches = findNodes(graph, arg1)
      if (matches.length === 0) {
        console.error(`❌ No GameObject found matching: "${arg1}"`)
        process.exit(1)
      }
      const target = matches[0]
      const chain = getAncestorChain(graph, target.go)
      console.log(`Ancestor chain for "${target.go.name}" (Root to Leaf):\n`)
      chain.forEach((item, idx) => {
        const indent = '  '.repeat(idx)
        const arrow = idx === 0 ? 'Root: ' : '└── '
        console.log(`${indent}${arrow}${item.go.name} [ID:${item.go.id}] [${item.go.isActive ? 'Active' : 'INACTIVE ⚠️'}]`)
      })
      break
    }

    case 'stats': {
      let activeCount = 0
      let rectCount = 0
      for (const go of graph.gameObjects.values()) {
        if (go.isActive)
          activeCount++
      }
      for (const tf of graph.transforms.values()) {
        if (tf.isRectTransform)
          rectCount++
      }
      console.log(`=== Scene Statistics ===`)
      console.log(`Total GameObjects:     ${graph.gameObjects.size}`)
      console.log(`  - Active:            ${activeCount}`)
      console.log(`  - Inactive:          ${graph.gameObjects.size - activeCount}`)
      console.log(`Total Transforms:      ${graph.transforms.size} (${rectCount} RectTransforms / 2D UI)`)
      console.log(`Total MonoBehaviours:  ${graph.monoBehaviours.size}`)
      console.log(`Root Scene Trees:      ${graph.rootTransformIds.length}`)
      break
    }

    case 'dump-md': {
      const outPath = arg1 ? resolve(process.cwd(), arg1) : resolve(rootStageMate, '..', '..', 'docs', 'mate-scene-hierarchy.md')
      console.log(`Exporting Markdown hierarchy to: ${outPath}...`)
      const md = generateMarkdownHierarchy(graph, basename(sceneFile))
      const outDir = resolve(outPath, '..')
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }
      writeFileSync(outPath, md, 'utf8')
      console.log(`✅ Successfully wrote ${md.length} bytes to ${outPath}`)
      break
    }

    default:
      console.log('Usage: tsx scripts/scene-tree.ts <command> [args]')
      console.log('Commands:')
      console.log('  tree [nameOrId] [maxDepth]   - Print visual hierarchy tree for root or target object')
      console.log('  find <query>                 - Search by GameObject name, Script class, GUID, or ID')
      console.log('  path <nameOrId>              - Show full ancestor chain (root-to-leaf) and active states')
      console.log('  stats                        - Display total GameObject, Transform, and script counts')
      console.log('  dump-md [outPath]            - Generate complete Markdown documentation of the scene')
      break
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli()
}
