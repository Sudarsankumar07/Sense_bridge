const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow loading 3D avatar/model files as static assets
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf'];

module.exports = config;
