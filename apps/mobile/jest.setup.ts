// Skia a Jest: el mock oficial sobre CanvasKit (que carrega l'entorn
// `@shopify/react-native-skia/jestEnv.js`), així els shaders es compilen de debò.
import '@shopify/react-native-skia/jestSetup';
import { setUpTests } from 'react-native-reanimated';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Reanimated 4 a Jest: animacions síncrones a 60 fps (docs de Reanimated, «Testing»).
setUpTests();
