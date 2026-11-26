const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all files within the monorepo
config.watchFolders = [workspaceRoot]

// Let Metro know where to resolve packages (hoisted at monorepo root)
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
]

// Ensure serverRoot is the app directory so entry-file resolves correctly
config.server = {
  ...config.server,
  unstable_serverRoot: projectRoot,
}

config.resolver.alias = {
  '@': __dirname,
  '@/lib': __dirname + '/lib',
  '@/app': __dirname + '/app',
}

module.exports = config
