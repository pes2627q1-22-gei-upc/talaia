/** @jest-environment jsdom */
import type { Map } from 'maplibre-gl';

import { colors } from '@/core/theme/tokens';

import { EMPTY_MAP_POINTS, POINTS_SOURCE, syncMapPoints } from '../pointMarkers';

afterEach(() => jest.restoreAllMocks());

it.each([1, 2, 3])(
  'registra imatges a %d× i reutilitza la font en rebre les mateixes dades',
  (pixelRatio) => {
    jest.replaceProperty(window, 'devicePixelRatio', pixelRatio);
    const fills: string[] = [];
    const strokes: string[] = [];
    const context = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      scale: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      fill() {
        fills.push(this.fillStyle);
      },
      stroke() {
        strokes.push(this.strokeStyle);
      },
      getImageData: jest.fn((_x: number, _y: number, width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      })),
    };
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation((() => context) as unknown as HTMLCanvasElement['getContext']);
    const source = { setData: jest.fn() };
    const map = {
      getSource: jest.fn(() => undefined as typeof source | undefined),
      hasImage: jest.fn(() => false),
      addImage: jest.fn(),
      addSource: jest.fn(() => {
        map.getSource.mockReturnValue(source);
      }),
      addLayer: jest.fn(),
    };
    const palette = {
      background: colors.nit,
      clusterBackground: colors.crep,
      clusterBorder: colors.vora,
      text: colors.lluna,
      unknown: colors.boira,
      ras: colors.ras,
      jus: colors.jus,
      tap: colors.tap,
    };
    syncMapPoints(map as unknown as Map, EMPTY_MAP_POINTS, palette);
    expect(map.addImage).toHaveBeenCalledWith(
      'talaia-cluster-disc',
      expect.objectContaining({ width: 46 * pixelRatio, height: 46 * pixelRatio }),
      { pixelRatio },
    );
    for (const band of ['ras', 'jus', 'tap', 'unknown'] as const) {
      expect(map.addImage).toHaveBeenCalledWith(
        `talaia-pin-${band}`,
        expect.objectContaining({ width: 44 * pixelRatio, height: 60 * pixelRatio }),
        { pixelRatio },
      );
      expect(strokes).toContain(palette[band]);
    }
    expect(fills).toContain(palette.background);
    expect(fills).toContain(palette.clusterBackground);
    expect(strokes).toContain(palette.clusterBorder);
    expect(map.addSource).toHaveBeenCalledWith(
      POINTS_SOURCE,
      expect.objectContaining({ cluster: true }),
    );
    syncMapPoints(map as unknown as Map, { ...EMPTY_MAP_POINTS }, palette);
    expect(map.addImage).toHaveBeenCalledTimes(5);
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(source.setData).not.toHaveBeenCalled();
  },
);
