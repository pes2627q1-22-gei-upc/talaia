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

it('en mode nit, cada franja té la seva forma, i en canviar la paleta es tornen a dibuixar', () => {
  const calls: { fill: string; dashed: boolean }[] = [];
  let dashed = false;
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    scale: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    setLineDash: jest.fn(() => {
      dashed = true;
    }),
    fill: jest.fn(),
    stroke() {
      // Només l'anell del pin (gruix 2): la tija fa 1,5 i el clúster, 1.
      if (this.lineWidth === 2) calls.push({ fill: this.fillStyle, dashed });
    },
    getImageData: jest.fn((_x: number, _y: number, width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    })),
  };
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
    dashed = false;
    return context;
  }) as unknown as HTMLCanvasElement['getContext']);
  const images = new Set<string>();
  const getSource = jest.fn((): { setData: jest.Mock } | undefined => undefined);
  const map = {
    getSource,
    getLayer: jest.fn(() => ({})),
    hasImage: jest.fn((id: string) => images.has(id)),
    addImage: jest.fn((id: string) => images.add(id)),
    removeImage: jest.fn((id: string) => images.delete(id)),
    addSource: jest.fn(() => {
      getSource.mockReturnValue({ setData: jest.fn() });
    }),
    removeSource: jest.fn(() => {
      getSource.mockReturnValue(undefined);
    }),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
  };
  const day = {
    background: colors.nit,
    clusterBackground: colors.crep,
    clusterBorder: colors.vora,
    text: colors.lluna,
    unknown: colors.boira,
    ras: colors.ras,
    jus: colors.jus,
    tap: colors.tap,
  };
  syncMapPoints(map as unknown as Map, EMPTY_MAP_POINTS, day);
  expect(calls.some((call) => call.dashed)).toBe(false);

  calls.length = 0;
  const night = { ...day, ras: colors.lluna, jus: colors.lluna, tap: colors.lluna, shapes: true };
  syncMapPoints(map as unknown as Map, EMPTY_MAP_POINTS, night);
  expect(map.removeSource).toHaveBeenCalledWith(POINTS_SOURCE);
  expect(map.removeImage).toHaveBeenCalledWith('talaia-pin-ras');
  // Ordre dels pins: ras (ple), jus (anell), tap (discontinu) i unknown.
  const [ras, jus, tap] = calls;
  expect(ras).toEqual({ fill: colors.lluna, dashed: false });
  expect(jus).toEqual({ fill: colors.nit, dashed: false });
  expect(tap?.dashed).toBe(true);
  expect(map.addSource).toHaveBeenCalledTimes(2);
});
