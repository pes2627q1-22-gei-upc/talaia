/* eslint-disable @typescript-eslint/no-require-imports -- Metro llegeix la configuració en CommonJS */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.transformer.babelTransformerPath = require.resolve('./metro.transformer.js');

module.exports = config;
/* eslint-enable @typescript-eslint/no-require-imports -- fi del CommonJS */
