const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

config.resolver.alias = {
  '@': __dirname,
  '@/lib': __dirname + '/lib',
  '@/app': __dirname + '/app',
}

module.exports = config