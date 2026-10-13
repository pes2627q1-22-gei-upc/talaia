import type { LayerSpecification } from 'maplibre-gl';

import { colors } from '@/core/theme/tokens';

import { ATTRIBUTION, nightStyle, RELIEF_SOURCE_ID, TERRAIN_SOURCE_ID } from '../style/nightStyle';

const layers = nightStyle.layers;
const paint = (layer: LayerSpecification) => (layer.paint ?? {}) as Record<string, unknown>;
const layout = (layer: LayerSpecification) => (layer.layout ?? {}) as Record<string, unknown>;

describe("estil nocturn sobre l'ICGC", () => {
  it('dibuixa el fons amb el color de la nit', () => {
    const background = layers.find((layer) => layer.type === 'background');
    expect(background).toBeDefined();
    expect(background?.maxzoom).toBeUndefined();
    expect(paint(background!)['background-color']).toBe(colors.card);
  });

  it('no deixa capes amagades ni fonts que cap capa fa servir', () => {
    expect(layers.filter((layer) => layout(layer).visibility === 'none')).toEqual([]);
    const used = new Set(layers.flatMap((layer) => ('source' in layer ? [layer.source] : [])));
    used.add(TERRAIN_SOURCE_ID);
    expect(new Set(Object.keys(nightStyle.sources))).toEqual(used);
    expect(nightStyle.sources).not.toHaveProperty('contextmapsadmpt');
  });

  it('pinta totes les etiquetes clares sobre un halo de nit, amb una sola font', () => {
    const labels = layers.filter((layer) => layer.type === 'symbol');
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect([colors.lluna, colors.boira]).toContain(paint(label)['text-color']);
      expect(paint(label)['text-halo-color']).toBe(colors.nit);
      expect((layout(label)['text-font'] as string[] | undefined)?.length ?? 1).toBe(1);
    }
  });

  it('afegeix el relleu ombrejat sota els edificis i les carreteres', () => {
    const relief = layers.findIndex((layer) => layer.type === 'hillshade');
    const firstRoad = layers.findIndex(
      (layer) => 'source-layer' in layer && layer['source-layer'] === 'transportation',
    );
    expect(nightStyle.sources[RELIEF_SOURCE_ID]).toMatchObject({
      type: 'raster-dem',
      encoding: 'mapbox',
    });
    expect(relief).toBeGreaterThan(-1);
    expect(relief).toBeLessThan(firstRoad);
  });

  it('té terreny 3D amb una font pròpia i un cel de nit', () => {
    expect(nightStyle.terrain?.source).toBe(TERRAIN_SOURCE_ID);
    expect(TERRAIN_SOURCE_ID).not.toBe(RELIEF_SOURCE_ID);
    expect(nightStyle.sources[TERRAIN_SOURCE_ID]).toMatchObject({ type: 'raster-dem' });
    expect(nightStyle.sky?.['sky-color']).toBe(colors.nit);
  });

  it("cita l'ICGC i OpenStreetMap a totes les fonts", () => {
    expect(ATTRIBUTION).toMatch(/Institut Cartogràfic i Geològic de Catalunya/);
    expect(ATTRIBUTION).toMatch(/OpenStreetMap/);
    for (const source of Object.values(nightStyle.sources)) {
      expect(source).toHaveProperty('attribution', ATTRIBUTION);
    }
  });
});
