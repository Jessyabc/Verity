const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..', '..')

function resolveFrom(root, pkg) {
  return path.dirname(require.resolve(`${pkg}/package.json`, { paths: [root] }))
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot)

// Monorepo: watch shared folders and see hoisted deps at repo root
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// One React instance — avoid invalid hook call from root + mobile versions
config.resolver.extraNodeModules = {
  react: resolveFrom(projectRoot, 'react'),
  'react-dom': resolveFrom(projectRoot, 'react-dom'),
}

module.exports = config
