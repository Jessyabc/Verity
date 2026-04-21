const fs = require('fs')
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..', '..')

/**
 * Load EXPO_PUBLIC_* from env files into process.env so Metro inlines them in the bundle.
 * Later files override earlier. Matches monorepo layout: keys often live in repo-root `.env.local`.
 */
function loadExpoPublicFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return
    const text = fs.readFileSync(filePath, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      if (!key.startsWith('EXPO_PUBLIC_')) continue
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  } catch {
    /* missing or unreadable file */
  }
}

loadExpoPublicFromFile(path.join(projectRoot, '.env'))
loadExpoPublicFromFile(path.join(workspaceRoot, '.env'))
loadExpoPublicFromFile(path.join(workspaceRoot, '.env.local'))

function resolveFrom(root, pkg) {
  return path.dirname(require.resolve(`${pkg}/package.json`, { paths: [root] }))
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot)

// Monorepo: watch shared folders and see hoisted deps at repo root
// Keep Expo defaults, then extend for monorepo.
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]))
config.resolver.nodeModulesPaths = Array.from(
  new Set([
    ...(config.resolver.nodeModulesPaths ?? []),
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ]),
)

// One React instance — avoid invalid hook call from root + mobile versions
config.resolver.extraNodeModules = {
  react: resolveFrom(projectRoot, 'react'),
  'react-dom': resolveFrom(projectRoot, 'react-dom'),
}

module.exports = config
