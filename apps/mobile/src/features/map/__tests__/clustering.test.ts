import type { Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';

import { colors } from '@/core/theme/tokens';

import {
  bindClusterInteraction,
  CLUSTERS_LAYER,
  EMPTY_MAP_POINTS,
  POINTS_SOURCE,
  syncMapPoints,
} from '../pointMarkers';

function setup() {
  const source = { getClusterExpansionZoom: jest.fn().mockResolvedValue(10) };
  const canvas = { style: { cursor: '' } };
  const map = {
    getSource: jest.fn(() => source),
    getCanvas: jest.fn(() => canvas),
    getMaxZoom: jest.fn(() => 17),
    getZoom: jest.fn(() => 7),
    easeTo: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };
  const dispose = bindClusterInteraction(map as unknown as MapLibreMap);
  const click = map.on.mock.calls.find(([event]) => event === 'click')?.[2] as (
    event: MapLayerMouseEvent,
  ) => Promise<void>;
  const invalidate = map.on.mock.calls.find(
    ([event]) => event === 'sourcedataloading',
  )?.[1] as (event: { sourceId: string }) => void;
  const event = {
    features: [
      {
        geometry: { type: 'Point', coordinates: [1.05, 41.31] },
        properties: { cluster_id: 12, point_count: 2 },
      },
    ],
  } as unknown as MapLayerMouseEvent;
  return { source, map, click, event, dispose, invalidate };
}

describe('clustering', () => {
  it('amb un rànquing, la font no agrupa els punts', () => {
    const map = {
      getSource: jest.fn(),
      hasImage: jest.fn(() => true),
      addSource: jest.fn(),
      addLayer: jest.fn(),
    };
    syncMapPoints(
      map as unknown as MapLibreMap,
      EMPTY_MAP_POINTS,
      {
        background: colors.nit,
        clusterBackground: colors.crep,
        clusterBorder: colors.vora,
        text: colors.lluna,
        unknown: colors.boira,
        ras: colors.ras,
        jus: colors.jus,
        tap: colors.tap,
      },
      false,
    );
    expect(map.addSource).toHaveBeenCalledWith(POINTS_SOURCE, {
      type: 'geojson',
      data: EMPTY_MAP_POINTS,
    });
  });

  it('crea una font amb clustering local i capes diferents per a grups i punts', () => {
    const map = {
      getSource: jest.fn(),
      hasImage: jest.fn(() => true),
      addSource: jest.fn(),
      addLayer: jest.fn(),
    };
    syncMapPoints(map as unknown as MapLibreMap, EMPTY_MAP_POINTS, {
      background: colors.nit,
      clusterBackground: colors.crep,
      clusterBorder: colors.vora,
      text: colors.lluna,
      unknown: colors.boira,
      ras: colors.ras,
      jus: colors.jus,
      tap: colors.tap,
    });
    expect(map.addSource).toHaveBeenCalledWith(
      POINTS_SOURCE,
      expect.objectContaining({
        type: 'geojson',
        cluster: true,
        clusterMaxZoom: 14,
        data: EMPTY_MAP_POINTS,
      }),
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: CLUSTERS_LAYER,
        filter: ['has', 'point_count'],
      }),
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'talaia-point-markers',
        filter: ['!', ['has', 'point_count']],
      }),
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: CLUSTERS_LAYER,
        type: 'symbol',
        layout: expect.objectContaining({
          'text-field': ['to-string', ['get', 'point_count']],
          'icon-image': 'talaia-cluster-disc',
        }),
      }),
    );
  });

  it('amplia fins al zoom de divisió del grup, també si encara queden subgrups', async () => {
    const { source, map, click, event } = setup();
    await click(event);
    expect(source.getClusterExpansionZoom).toHaveBeenCalledWith(12);
    expect(map.easeTo).toHaveBeenCalledWith({ center: [1.05, 41.31], zoom: 10.5 });
    source.getClusterExpansionZoom.mockResolvedValue(12);
    await click(event);
    expect(map.easeTo).toHaveBeenLastCalledWith({ center: [1.05, 41.31], zoom: 12.5 });
  });

  it('continua ampliant si el grup encara es veu per sobre del seu llindar de divisió', async () => {
    const { map, click, event } = setup();
    map.getZoom.mockReturnValue(10.7);
    await click(event);
    expect(map.easeTo).toHaveBeenCalledWith({ center: [1.05, 41.31], zoom: 11.7 });
  });

  it('respecta el zoom màxim del mapa', async () => {
    const { source, map, click, event } = setup();
    source.getClusterExpansionZoom.mockResolvedValue(20);
    await click(event);
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 17 }));
  });

  it('no mou el mapa si el grup ha desaparegut del worker', async () => {
    const { source, map, click, event } = setup();
    source.getClusterExpansionZoom.mockRejectedValue(new Error('cluster removed'));
    await expect(click(event)).resolves.toBeUndefined();
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it('ignora respostes pendents quan es renoven els punts', async () => {
    const { map, click, event, invalidate } = setup();
    const pending = click(event);
    invalidate({ sourceId: POINTS_SOURCE });
    await pending;
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it('retira els listeners i no anima un mapa desmuntat', async () => {
    const { map, click, event, dispose } = setup();
    const pending = click(event);
    dispose();
    await pending;
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.off).toHaveBeenCalledTimes(4);
  });
});
