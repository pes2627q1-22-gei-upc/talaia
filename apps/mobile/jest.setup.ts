// Skia a Jest: el mock oficial sobre CanvasKit (que carrega l'entorn
// `@shopify/react-native-skia/jestEnv.js`), així els shaders es compilen de debò.
import '@shopify/react-native-skia/jestSetup';
import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';

// Gesture Handler 3 instal·la els lligams del runtime de UI en carregar-se, i a Jest Worklets és la
// versió web: es fa servir la implementació web d'aquest pas, que no fa res. Com el `jestSetup` de
// Gesture Handler, a les dues còpies del paquet (`lib/module`, que és la que es carrega, i `src`).
jest.mock(
  'react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings',
  () =>
    jest.requireActual(
      'react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings.web',
    ),
);
jest.mock('react-native-gesture-handler/src/handlers/gestures/installUIRuntimeBindings', () =>
  jest.requireActual(
    'react-native-gesture-handler/src/handlers/gestures/installUIRuntimeBindings.web',
  ),
);

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Reanimated 4 a Jest: animacions síncrones a 60 fps (docs de Reanimated, «Testing»).
setUpTests();
