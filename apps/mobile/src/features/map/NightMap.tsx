'use dom';

import 'maplibre-gl/dist/maplibre-gl.css';

import type { DOMProps } from 'expo/dom';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import {
  bindClusterInteraction,
  MARKERS_LAYER,
  type MapPoints,
  type MarkerPalette,
  syncMapPoints,
} from './pointMarkers';

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
  userLocation: { lat: number; lon: number } | null;
  userHeading: number | null;
  locationActive: boolean;
  userLocationLabel: string;
  userLocationColor: string;
  points: MapPoints;
  markerPalette: MarkerPalette;
  onPointPress: (id: string) => Promise<void>;
  dom?: DOMProps;
};

/**
 * Mapa nocturn amb MapLibre GL JS. És una DOM component: corre dins d'un WebView, i per això funciona
 * a Expo Go i té terreny 3D real (ADR-0015). Les props arriben serialitzades pel pont asíncron.
 */
export default function NightMap({
  mapStyle,
  camera,
  chrome,
  accessibilityLabel,
  points,
  userLocation,
  userHeading,
  locationActive,
  userLocationLabel,
  userLocationColor,
  markerPalette,
  onPointPress,
}: NightMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const locationMarker = useRef<maplibregl.Marker | null>(null);
  const headingMarker = useRef<maplibregl.Marker | null>(null);
  const latestPoints = useRef({ points, markerPalette });
  const onPointPressRef = useRef(onPointPress);
  // El pont torna a enviar les props a cada render natiu: el mapa es crea un sol cop amb les inicials.
  const initial = useRef({ mapStyle, camera });

  useEffect(() => {
    onPointPressRef.current = onPointPress;
  }, [onPointPress]);

  useEffect(() => {
    latestPoints.current = { points, markerPalette };
    const map = mapRef.current;
    if (map && ready.current) syncMapPoints(map, points, markerPalette);
  }, [points, markerPalette]);

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
      // En dividir un clúster, evita superposar la fosa del pare amb els nous símbols.
      // MapLibre aplica aquesta opció a totes les etiquetes del mapa.
      fadeDuration: 0,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const unbindClusters = bindClusterInteraction(map);
    const clickPoint = (event: maplibregl.MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === 'string') void onPointPressRef.current(id);
    };
    const enterPoint = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const leavePoint = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('click', MARKERS_LAYER, clickPoint);
    map.on('mouseenter', MARKERS_LAYER, enterPoint);
    map.on('mouseleave', MARKERS_LAYER, leavePoint);
    // Les dades poden arribar abans o després que l'estil s'hagi carregat.
    map.on('load', () => {
      ready.current = true;
      syncMapPoints(map, latestPoints.current.points, latestPoints.current.markerPalette);
      // L'atribució compacta arrenca desplegada: es plega i queda al botó (i).
      container.current
        ?.querySelector('.maplibregl-ctrl-attrib')
        ?.classList.remove('maplibregl-compact-show');
    });
    return () => {
      unbindClusters();
      map.off('click', MARKERS_LAYER, clickPoint);
      map.off('mouseenter', MARKERS_LAYER, enterPoint);
      map.off('mouseleave', MARKERS_LAYER, leavePoint);
      ready.current = false;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  const lat = userLocation?.lat;
  const lon = userLocation?.lon;
  const hasLocation =
    lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasLocation) return;
    const dot = document.createElement('div');
    dot.className = 'talaia-location';
    const pulse = document.createElement('span');
    pulse.className = 'talaia-location-pulse';
    pulse.setAttribute('aria-hidden', 'true');
    dot.appendChild(pulse);
    dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', userLocationLabel);
    Object.assign(dot.style, {
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      boxSizing: 'border-box',
      backgroundColor: userLocationColor,
      border: `2px solid ${markerPalette.text}`,
      pointerEvents: 'none',
      color: userLocationColor,
      zIndex: '2',
    });
    // Marcador independent dels punts d'observació: mai entra en un clúster.
    const marker = new maplibregl.Marker({ element: dot, pitchAlignment: 'viewport' })
      .setLngLat([0, 0])
      .addTo(map);
    locationMarker.current = marker;
    return () => {
      locationMarker.current = null;
      marker.remove();
    };
  }, [hasLocation, userLocationLabel, userLocationColor, markerPalette.text]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasLocation) return;
    const cone = document.createElement('div');
    cone.setAttribute('aria-hidden', 'true');
    Object.assign(cone.style, {
      width: '80px',
      height: '80px',
      pointerEvents: 'none',
      color: userLocationColor,
    });
    // Fletxeta per apuntar la direcció
    cone.innerHTML =
      '<svg width="80" height="80" viewBox="0 0 80 80"><path d="M40 20 L45 29 Q40 26 35 29 Z" fill="currentColor"/></svg>';
    cone.style.visibility = 'hidden';
    const marker = new maplibregl.Marker({
      element: cone,
      rotationAlignment: 'map',
      pitchAlignment: 'viewport',
    })
      .setLngLat([0, 0])
      .addTo(map);
    headingMarker.current = marker;
    return () => {
      headingMarker.current = null;
      marker.remove();
    };
  }, [hasLocation, userLocationColor]);

  useEffect(() => {
    if (!hasLocation || lat === undefined || lon === undefined) return;
    locationMarker.current?.setLngLat([lon, lat]);
    headingMarker.current?.setLngLat([lon, lat]);
  }, [lat, lon, hasLocation, userLocationLabel, userLocationColor, markerPalette.text]);

  useEffect(() => {
    const marker = headingMarker.current;
    if (!marker) return;
    const visible = userHeading !== null && Number.isFinite(userHeading) && locationActive;
    marker.getElement().style.visibility = visible ? 'visible' : 'hidden';
    if (visible) marker.setRotation(userHeading);
  }, [userHeading, locationActive, lat, lon, userLocationColor]);

  return (
    <>
      <style>{`
        .talaia-location-pulse {
          position: absolute; inset: -7px; border-radius: 50%;
          background: currentColor; pointer-events: none;
          animation: talaia-location-pulse 2200ms ease-out infinite;
          animation-play-state: ${locationActive ? 'running' : 'paused'};
          z-index: -1;
        }
        @keyframes talaia-location-pulse {
          0% { transform: scale(0.65); opacity: 0.3; }
          75%, 100% { transform: scale(1.65); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .talaia-location-pulse { animation: none; opacity: 0.12; }
        }

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
