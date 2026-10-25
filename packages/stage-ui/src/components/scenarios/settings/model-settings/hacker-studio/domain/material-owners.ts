/**
 * Human-readable material/owner labels shown by the texture browser and the
 * shared-texture warning.
 */

export function prettyMaterialName(name: string): string {
  return name
    .replace(/\s*\(Instance\)\s*$/i, '')
    .replace(/\s*\(Outline\)\s*$/i, ' outline')
    .replace(/^N00_[0-9_]+_/, '')
}

export function uniqueOwnerNames(names: Iterable<string>): string[] {
  const owners = new Set<string>()
  for (const name of names) {
    const pretty = prettyMaterialName(name)
    if (pretty)
      owners.add(pretty)
  }
  return [...owners]
}
