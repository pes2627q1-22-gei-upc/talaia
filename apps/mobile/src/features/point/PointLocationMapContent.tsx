import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { ATTRIBUTION } from '@/features/map/style/nightStyle';

type Props = {
  mapStyle: StyleSpecification;
  coordinates: { lat: number; lon: number };
  palette: {
    background: string;
    text: string;
    link: string;
    marker: string;
    shadow: string;
    markerPulse: string;
    markerGlow: string;
    markerHalo: string;
  };
  metrics: {
    touch: number;
    icon: number;
    marker: number;
    core: number;
    stem: number;
    halo: number;
    /** Alçada de la zona segura de dalt: els crèdits van a l'altura del botó enrere, a la dreta. */
    top: number;
  };
  label: string;
  attributionLabel: string;
  unavailableLabel: string;
  /** Volta lenta al voltant del punt. Fals si la pantalla no es veu o es vol reduir el moviment. */
  orbit: boolean;
};

/** Prou a prop i inclinat perquè el relleu 3D de l'ICGC es llegeixi al voltant del punt. */
export const POINT_VIEW = { zoom: 12.6, pitch: 62, bearing: -20 };
/** Una volta sencera cada dos minuts: es veu que el relleu gira, però no distreu. */
export const ORBIT_DEGREES_PER_MS = 360 / 120_000;
/** La volta arrenca i torna a arrencar a poc a poc, sense cap salt. */
export const ORBIT_RAMP_MS = 4_000;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Mapa de situació sense gestos (permet desplaçar la fitxa sense capturar el dit), inclinat sobre
 * el relleu i amb una òrbita lenta al voltant del punt.
 */
export default function PointLocationMapContent({
  mapStyle,
  coordinates,
  palette,
  metrics,
  label,
  attributionLabel,
  unavailableLabel,
  orbit,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const failure = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
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
        ...POINT_VIEW,
        interactive: false,
        attributionControl: false,
      });
      const current = map;
      mapRef.current = current;
      // El punt, al centre de la part que es veu sota la capçalera (no de tot el mapa).
      current.setPadding({ top: metrics.top + metrics.touch, bottom: 0, left: 0, right: 0 });
      current.on('load', () => setLoaded(true));
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
      mapRef.current = null;
      setLoaded(false);
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la zona segura només canvia si gira la pantalla, i no cal tornar a crear el mapa
  }, [coordinates.lat, coordinates.lon, label, attributionLabel]);

  // La càmera gira al voltant del centre, que és el punt. Cada fotograma avança segons el temps
  // real, i la velocitat puja amb una corba suau en començar o en tornar a la pantalla.
  useEffect(() => {
    const map = mapRef.current;
    if (!orbit || !loaded || !map) return;
    let frame = 0;
    let start: number | undefined;
    let last: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const elapsed = last === undefined ? 0 : now - last;
      last = now;
      const speed = smoothstep(Math.min(1, (now - start) / ORBIT_RAMP_MS));
      map.setBearing(map.getBearing() + ORBIT_DEGREES_PER_MS * elapsed * speed);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [orbit, loaded]);

  return (
    <div
      role="region"
      aria-label={label}
      style={{ position: 'absolute', inset: 0, background: palette.background }}
    >
      <style>{`
        :root {
          --talaia-marker: ${palette.marker};
          --talaia-marker-size: ${metrics.marker}px;
          --talaia-marker-core: ${metrics.core}px;
          --talaia-marker-stem: ${metrics.stem}px;
          --talaia-marker-halo: ${metrics.halo}px;
        }
        .talaia-map-credits {
          position: absolute; z-index: 4; top: ${metrics.top}px; right: 8px;
          display: flex; flex-direction: row-reverse; align-items: flex-start; gap: 8px;
          pointer-events: none;
        }
        .talaia-map-credits__button {
          display: grid; place-items: center; flex: 0 0 ${metrics.touch}px;
          width: ${metrics.touch}px; height: ${metrics.touch}px;
          padding: 3px; border: 0; border-radius: 50%; background: transparent;
          color: ${palette.link}; cursor: pointer; pointer-events: auto;
        }
        .talaia-map-credits__button svg {
          display: block; width: ${metrics.icon}px; height: ${metrics.icon}px;
          fill: none; stroke: currentColor;
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
          box-shadow: 0 4px 14px ${palette.shadow}; pointer-events: auto;
        }
        .talaia-map-credits__panel[hidden] { display: none; }
        .talaia-map-credits__panel a { color: ${palette.link}; }
        .talaia-point-marker {
          width: var(--talaia-marker-size);
          height: calc(var(--talaia-marker-size) + var(--talaia-marker-stem) - var(--talaia-marker-halo));
          display: flex; justify-content: center; position: relative;
          color: var(--talaia-marker);
        }
        .talaia-point-marker::before {
          content: ''; position: absolute; top: 0; left: 0; box-sizing: border-box;
          width: var(--talaia-marker-size); height: var(--talaia-marker-size);
          border: 1px solid ${palette.markerPulse};
          border-radius: 50%;
          animation: talaia-point-pulse 1.8s ease-out infinite;
        }
        .talaia-point-marker::after {
          content: ''; position: absolute;
          top: calc(var(--talaia-marker-size) - var(--talaia-marker-halo));
          left: calc((var(--talaia-marker-size) - 2px) / 2);
          width: 2px; height: var(--talaia-marker-stem);
          background: var(--talaia-marker);
          box-shadow: 0 0 6px ${palette.markerGlow};
        }
        .talaia-point-marker__core {
          position: absolute; z-index: 2;
          top: calc((var(--talaia-marker-size) - var(--talaia-marker-core)) / 2);
          left: calc((var(--talaia-marker-size) - var(--talaia-marker-core)) / 2);
          box-sizing: border-box;
          width: var(--talaia-marker-core); height: var(--talaia-marker-core);
          display: grid; place-items: center;
          border: 3px solid var(--talaia-marker); border-radius: 50%;
          background: ${palette.background};
          box-shadow: 0 0 0 var(--talaia-marker-halo)
            ${palette.markerHalo};
        }
        .talaia-point-marker__core svg { width: ${metrics.icon}px; height: ${metrics.icon}px; }
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
