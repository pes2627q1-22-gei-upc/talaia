import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import i18n from '@/core/i18n';

import { MapScreen } from '../MapScreen';
import { nightStyle } from '../style/nightStyle';
import { camera } from '../useMapViewModel';

// La DOM component corre en un WebView: aquí només es comprova què li passa la pantalla.
const mockNightMap = jest.fn((_props: unknown) => <View testID="night-map" />);
jest.mock('../NightMap', () => ({
  __esModule: true,
  default: (props: unknown) => mockNightMap(props),
}));

describe('MapScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ca');
    mockNightMap.mockClear();
  });

  it("passa l'estil nocturn, la càmera i l'etiqueta accessible al mapa", async () => {
    await render(<MapScreen />);
    expect(screen.getByTestId('night-map')).toBeOnTheScreen();
    expect(mockNightMap).toHaveBeenCalledWith(
      expect.objectContaining({
        mapStyle: nightStyle,
        camera,
        accessibilityLabel: 'Mapa nocturn de Catalunya amb el relleu',
      }),
    );
  });
});
