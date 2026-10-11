/* eslint-disable @typescript-eslint/no-require-imports -- transformador de Metro, en CommonJS */
const { parseSync } = require('@babel/core');
const upstream = require('@expo/metro-config/babel-transformer');

// MapLibre GL JS converteix el codi del seu worker en text i l'executa en un Web Worker. Si Babel hi
// passa, hi posa helpers (`_wrapNativeSuper`) que el worker no té i el mapa no pinta res. El bundle de
// `maplibre-gl/dist` ja és ES2017: només se'n fa el parse.
const UNTOUCHED = /node_modules[\\/]maplibre-gl[\\/]dist[\\/]/;

module.exports = {
  ...upstream,
  transform(args) {
    if (!UNTOUCHED.test(args.filename)) return upstream.transform(args);
    const ast = parseSync(args.src, {
      filename: args.filename,
      sourceType: 'script',
      babelrc: false,
      configFile: false,
    });
    return { ast, metadata: {} };
  },
};
/* eslint-enable @typescript-eslint/no-require-imports -- fi del CommonJS */
