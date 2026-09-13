const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Let Metro resolve packages from both project node_modules and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 2. In monorepos, watch monorepo root and all workspace packages
config.watchFolders = [...new Set([...(config.watchFolders || []), monorepoRoot])];

// 3. Map any peer dependencies across pnpm symlinks to the canonical installed package
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      if (typeof name !== 'string') return target[name];
      try {
        const pkgJson = require.resolve(name + '/package.json', {
          paths: [projectRoot, monorepoRoot],
        });
        return path.dirname(pkgJson);
      } catch {
        return path.resolve(projectRoot, 'node_modules', name);
      }
    },
  },
);

module.exports = config;
