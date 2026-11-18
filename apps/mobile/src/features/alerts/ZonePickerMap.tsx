'use dom';

import 'maplibre-gl/dist/maplibre-gl.css';

import type { DOMProps } from 'expo/dom';
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import '@/core/map/maplibreWorker';
import { ATTRIBUTION } from '@/features/map/style/nightStyle';

type ZonePickerMapProps = {
  mapStyle: StyleSpecification;
  /** On comença el mapa: la zona triada abans, la ubicació actual o el centre de Catalunya. */
  center: { lat: number; lon: number };
  zoom: number;
  /** Límits del mapa (`[oest, sud, est, nord]`): només es pot triar una zona de Catalunya i voltants. */
  maxBounds: [number, number, number, number];
  chrome: { background: string; text: string; link: string };
  accessibilityLabel: string;
  /** Cada cop que el mapa s'atura, el punt del centre (on hi ha l'agulla, que és nativa). */
  onCenterChange: (center: { lat: number; lon: number }) => Promise<void>;
  dom?: DOMProps;
};

/**
 * Mapa pla per triar una zona arrossegant-lo sota una agulla fixa al centre (HU16, mockup 11).
 * És una DOM component, com `NightMap`: MapLibre corre dins d'un WebView i funciona a Expo Go.
 */
export default function ZonePickerMap({
  mapStyle,
  center,
  zoom,
  maxBounds,
  chrome,
  accessibilityLabel,
  onCenterChange,
}: ZonePickerMapProps) {
  const container = useRef<HTMLDivElement>(null);
  // El pont DOM torna a enviar les props a cada render: el mapa es crea un sol cop.
  const initial = useRef({ mapStyle, center, zoom, maxBounds });
  const report = useRef(onCenterChange);
  useEffect(() => {
    report.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    if (!container.current) return;
    const { mapStyle: style, center: start, zoom: startZoom, maxBounds: bounds } = initial.current;
    const map = new maplibregl.Map({
      container: container.current,
      style,
      center: [start.lon, start.lat],
      zoom: startZoom,
      maxBounds: [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      // Pla i sense girar: per triar una zona, el relleu 3D només fa nosa.
      pitch: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true, customAttribution: ATTRIBUTION },
    });
    map.touchZoomRotate.disableRotation();
    map.on('moveend', () => {
      const { lat, lng } = map.getCenter();
      void report.current({ lat, lon: lng });
    });
    return () => map.remove();
  }, []);

  return (
    <div
      role="application"
      aria-label={accessibilityLabel}
      style={{ position: 'absolute', inset: 0, background: chrome.background }}
    >
      <style>{`
        .maplibregl-ctrl-attrib { background: ${chrome.background}cc; color: ${chrome.text}; }
        .maplibregl-ctrl-attrib a { color: ${chrome.link}; }
      `}</style>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
