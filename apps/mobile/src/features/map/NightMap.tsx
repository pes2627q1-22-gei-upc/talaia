'use dom';

import 'maplibre-gl/dist/maplibre-gl.css';

import type { DOMProps } from 'expo/dom';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

export type MapCamera = {
  center: [number, number];
  zoom: number;
  pitch: number;
  minZoom: number;
  maxZoom: number;
  maxBounds: [number, number, number, number];
};

/** Colors dels controls de MapLibre: dins del WebView no hi ha tokens, arriben com a props. */
export type MapChrome = { background: string; text: string; link: string };

type NightMapProps = {
  mapStyle: StyleSpecification;
  camera: MapCamera;
  chrome: MapChrome;
  accessibilityLabel: string;
  dom?: DOMProps;
};

/**
 * Mapa nocturn amb MapLibre GL JS. És una DOM component: corre dins d'un WebView, i per això funciona
 * a Expo Go i té terreny 3D real (ADR-0015). Les props arriben serialitzades pel pont asíncron.
 */
export default function NightMap({ mapStyle, camera, chrome, accessibilityLabel }: NightMapProps) {
  const container = useRef<HTMLDivElement>(null);
  // El pont torna a enviar les props a cada render natiu: el mapa es crea un sol cop amb les inicials.
  const initial = useRef({ mapStyle, camera });

  useEffect(() => {
    if (!container.current) return;
    const { mapStyle: style, camera: view } = initial.current;
    const map = new maplibregl.Map({
      container: container.current,
      style,
      center: view.center,
      zoom: view.zoom,
      pitch: view.pitch,
      minZoom: view.minZoom,
      maxZoom: view.maxZoom,
      maxBounds: view.maxBounds,
      maxPitch: 75,
      attributionControl: { compact: true },
    });
    // L'atribució compacta arrenca desplegada: es plega i queda al botó (i).
    map.once('load', () =>
      container.current
        ?.querySelector('.maplibregl-ctrl-attrib')
        ?.classList.remove('maplibregl-compact-show'),
    );
    return () => map.remove();
  }, []);

  return (
    <>
      <style>{`
        .maplibregl-ctrl-attrib { background-color: ${chrome.background} !important; color: ${chrome.text}; }
        .maplibregl-ctrl-attrib a { color: ${chrome.link}; }
        .maplibregl-ctrl-attrib-button { background-color: transparent !important; filter: invert(1); }
      `}</style>
      <div
        ref={container}
        role="region"
        aria-label={accessibilityLabel}
        style={{ position: 'fixed', inset: 0, background: chrome.background }}
      />
    </>
  );
}
