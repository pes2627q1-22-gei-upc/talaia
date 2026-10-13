import { renderHook } from '@testing-library/react-native';

import i18n from '@/core/i18n';

import { nightStyle } from '../style/nightStyle';
import { useMapViewModel } from '../useMapViewModel';

describe('useMapViewModel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ca');
  });

  it("dona l'estil nocturn i una càmera dins dels límits de Catalunya", async () => {
    const { result } = await renderHook(() => useMapViewModel());
    const { center, zoom, minZoom, maxZoom, maxBounds } = result.current.camera;
    const [west, south, east, north] = maxBounds;
    const [lng, lat] = center;

    expect(result.current.mapStyle).toBe(nightStyle);
    expect(lng).toBeGreaterThan(west);
    expect(lng).toBeLessThan(east);
    expect(lat).toBeGreaterThan(south);
    expect(lat).toBeLessThan(north);
    expect(zoom).toBeGreaterThanOrEqual(minZoom);
    expect(zoom).toBeLessThanOrEqual(maxZoom);
    expect(result.current.accessibilityLabel).toBe('Mapa nocturn de Catalunya amb el relleu');
  });
});
