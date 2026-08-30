const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro resolve packages from both project node_modules and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Ensure standard source extensions
config.resolver.sourceExts = [
  ...new Set([...config.resolver.sourceExts, 'ts', 'tsx', 'js', 'jsx', 'json', 'cjs', 'mjs']),
];

module.exports = config;
