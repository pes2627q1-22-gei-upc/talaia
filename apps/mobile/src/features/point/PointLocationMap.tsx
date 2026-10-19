'use dom';

import 'maplibre-gl/dist/maplibre-gl.css';

import type { DOMProps } from 'expo/dom';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import { ATTRIBUTION } from '@/features/map/style/nightStyle';

type Props = {
  mapStyle: StyleSpecification;
  coordinates: { lat: number; lon: number };
  palette: { background: string; text: string; link: string };
  label: string;
  attributionLabel: string;
  unavailableLabel: string;
  dom?: DOMProps;
};

/** Mapa de situació sense gestos: permet desplaçar la fitxa sense capturar el dit. */
export default function PointLocationMap({
  mapStyle,
  coordinates,
  palette,
  label,
  attributionLabel,
  unavailableLabel,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const failure = useRef<HTMLDivElement>(null);
  // El pont DOM reenvia objectes: conservem l'estil inicial, com fa NightMap.
  const initialStyle = useRef(mapStyle);
  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map | undefined;
    let creditControl: HTMLDivElement | undefined;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: initialStyle.current,
        center: [coordinates.lon, coordinates.lat],
        zoom: 10,
        pitch: 0,
        interactive: false,
        attributionControl: false,
      });
      const current = map;
      creditControl = document.createElement('div');
      creditControl.className = 'talaia-map-credits';
      const creditsButton = document.createElement('button');
      creditsButton.className = 'talaia-map-credits__button';
      creditsButton.type = 'button';
      creditsButton.setAttribute('aria-label', attributionLabel);
      creditsButton.setAttribute('aria-expanded', 'false');
      creditsButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="1"/></svg>`;
      const creditsPanel = document.createElement('div');
      creditsPanel.className = 'talaia-map-credits__panel';
      creditsPanel.setAttribute('role', 'region');
      creditsPanel.setAttribute('aria-label', attributionLabel);
      creditsPanel.hidden = true;
      creditsPanel.innerHTML = ATTRIBUTION;
      creditsButton.addEventListener('click', () => {
        creditsPanel.hidden = !creditsPanel.hidden;
        creditsButton.setAttribute('aria-expanded', String(!creditsPanel.hidden));
      });
      creditControl.append(creditsButton, creditsPanel);
      current.getContainer().appendChild(creditControl);
      current.on('error', () => {
        if (failure.current) failure.current.hidden = false;
      });
      current.on('idle', () => {
        if (current.areTilesLoaded() && failure.current) failure.current.hidden = true;
      });
      const marker = document.createElement('div');
      marker.className = 'talaia-point-marker';
      marker.setAttribute('role', 'img');
      marker.setAttribute('aria-label', label);
      marker.innerHTML = `<span class="talaia-point-marker__core"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M186.875 159.583V163.25H188.25M188.25 163.25H193.75M188.25 163.25L187.15 174.25H194.85L193.75 163.25M193.75 163.25H195.125V159.583M189.625 159.583V161.417M192.375 159.583V161.417" transform="translate(-179 -154)" fill="none" stroke="currentColor" stroke-width="1.83333" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
      new maplibregl.Marker({ element: marker, anchor: 'bottom' })
        .setLngLat([coordinates.lon, coordinates.lat])
        .addTo(current);
    } catch {
      if (failure.current) failure.current.hidden = false;
    }
    return () => {
      creditControl?.remove();
      map?.remove();
    };
  }, [coordinates.lat, coordinates.lon, label, attributionLabel]);

  return (
    <div
      role="region"
      aria-label={label}
      style={{ position: 'absolute', inset: 0, background: palette.background }}
    >
      <style>{`
        .talaia-map-credits {
          position: absolute; z-index: 4; top: 8px; left: 8px;
          display: flex; align-items: flex-start; gap: 8px; pointer-events: none;
        }
        .talaia-map-credits__button {
          display: grid; place-items: center; flex: 0 0 30px; width: 30px; height: 30px;
          padding: 3px; border: 0; border-radius: 50%; background: transparent;
          color: ${palette.link}; cursor: pointer; pointer-events: auto;
        }
        .talaia-map-credits__button svg {
          display: block; width: 24px; height: 24px; fill: none; stroke: currentColor;
          stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;
        }
        .talaia-map-credits__button:focus { outline: none; }
        .talaia-map-credits__button:focus-visible {
          outline: 2px solid ${palette.link}; outline-offset: 2px;
        }
        .talaia-map-credits__panel {
          max-width: min(260px, calc(100vw - 64px)); margin-top: 0; padding: 8px 10px;
          border-radius: 8px; background: ${palette.background}; color: ${palette.text};
          font: 12px/18px Arial, sans-serif; text-align: left; direction: ltr;
          box-shadow: 0 4px 14px rgba(0, 0, 0, .28); pointer-events: auto;
        }
        .talaia-map-credits__panel[hidden] { display: none; }
        .talaia-map-credits__panel a { color: ${palette.link}; }
        .talaia-point-marker {
          width: 66px; height: 74px; display: flex; justify-content: center; position: relative;
          color: #5fd4c4;
        }
        .talaia-point-marker::before {
          content: ''; position: absolute; top: 0; left: 0; box-sizing: border-box;
          width: 66px; height: 66px;
          border: 1px solid rgba(95, 212, 196, .72); border-radius: 50%;
          animation: talaia-point-pulse 1.8s ease-out infinite;
        }
        .talaia-point-marker::after {
          content: ''; position: absolute; top: 56px; left: 32px; width: 2px; height: 18px;
          background: #5fd4c4; box-shadow: 0 0 6px rgba(95, 212, 196, .7);
        }
        .talaia-point-marker__core {
          position: absolute; z-index: 2; top: 11.5px; left: 11.5px;
          box-sizing: border-box; width: 43px; height: 43px;
          display: grid; place-items: center; border: 3px solid #5fd4c4; border-radius: 50%;
          background: #0e1433; box-shadow: 0 0 0 10px rgba(95, 212, 196, .18);
        }
        .talaia-point-marker__core svg { width: 24px; height: 24px; }
        @keyframes talaia-point-pulse {
          0% { transform: scale(.82); opacity: .65; }
          100% { transform: scale(1.12); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .talaia-point-marker::before { animation: none; }
        }
      `}</style>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
      {
        <div
          ref={failure}
          hidden
          role="status"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            color: palette.text,
            background: palette.background,
          }}
        >
          {unavailableLabel}
        </div>
      }
    </div>
  );
}
