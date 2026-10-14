import {
  BlurMask,
  Canvas,
  Circle,
  Fill,
  Group,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Shader,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import {
  SensorType,
  type SharedValue,
  useAnimatedSensor,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import { colors } from '@/core/theme/tokens';

import { STARS } from '../stars';
import { ILLUSTRATION } from '../WelcomeIllustration';
import { CASSIOPEIA, METEOR, meteorAt, noise, TOWER_STAR_CENTER, WARP_RAYS } from './sky';
import { SKY_COLORS, skyEffect } from './skyShader';
import { beamAngle, beamIntensity, beat, curve, flare, TL } from './timeline';

/** Com es passa de les coordenades del frame del Figma a píxels de la pantalla. */
export type Box = { left: number; top: number; scale: number };
export type Tap = { x: number; y: number; at: number };

type SkyCanvasProps = {
  width: number;
  height: number;
  box: Box;
  /** Rellotge de la intro (ms de la línia de temps). */
  t: SharedValue<number>;
  /** Rellotge ambient (ms des que s'ha muntat la pantalla). */
  clock: SharedValue<number>;
  /** Quan comencen els estels fugaços, en ms del rellotge ambient. */
  meteorsSince: number;
  /** De 0 a 1 en triar una opció: salt a la velocitat de la llum. */
  exit: SharedValue<number>;
  /** L'últim toc al cel: en surt un estel fugaç. */
  tap: SharedValue<Tap | null>;
  /** «Reduir moviment»: el cel queda quiet (sense giroscopi, parpelleig ni estels fugaços). */
  still: boolean;
};

const transparent = 'transparent';
const PARALLAX = 14;

/**
 * Opacitat mínima del que apareix més tard (esclat, estels fugaços, salt final). Skia no dibuixa
 * res a opacitat 0 i compilaria el pipeline de la GPU el primer cop que surt: una aturada visible
 * just a l'encesa. Amb 1/255 es compila d'entrada i no es veu.
 */
const WARM = 1 / 255;

// A nivell de mòdul i amb 'worklet': dins d'un worklet, el React Compiler trauria una fletxa
// sense captures fora del component (`_temp`) i el fil d'UI no la podria cridar.
function clampParallax(value: number) {
  'worklet';
  return Math.max(-PARALLAX, Math.min(PARALLAX, value));
}

/** Inclinació del mòbil → desplaçament de les capes, suavitzat. */
function useParallax(still: boolean) {
  const rotation = useAnimatedSensor(SensorType.ROTATION);
  const base = useSharedValue<{ roll: number; pitch: number } | null>(null);
  const offset = useSharedValue({ x: 0, y: 0 });

  useFrameCallback(() => {
    if (still) return;
    const { roll, pitch } = rotation.sensor.get();
    if (base.get() === null && (roll !== 0 || pitch !== 0)) base.set({ roll, pitch });
    const origin = base.get() ?? { roll, pitch };
    const target = {
      x: clampParallax((roll - origin.roll) * 40),
      y: clampParallax((pitch - origin.pitch) * 40),
    };
    const current = offset.get();
    offset.set({
      x: current.x + (target.x - current.x) * 0.08,
      y: current.y + (target.y - current.y) * 0.08,
    });
  });

  return offset;
}

export function SkyCanvas(props: SkyCanvasProps) {
  const { width, height, box, t, clock, exit, still } = props;
  const parallax = useParallax(still);
  const cx = box.left + TOWER_STAR_CENTER.x * box.scale;
  const cy = box.top + TOWER_STAR_CENTER.y * box.scale;

  const uniforms = useDerivedValue(() => {
    const now = t.get();
    const warp = exit.get();
    const offset = parallax.get();
    return {
      res: [width, height],
      time: still ? 0 : clock.get() / 1000,
      open: beat(now, TL.open, TL.openFor, curve.power2Out),
      milky: beat(now, TL.milky, TL.milkyFor, curve.sineInOut),
      center: [cx, cy],
      par: [offset.x, offset.y],
      zoom: 1 + 0.9 * warp * warp,
      beamA: (beamAngle(now) * Math.PI) / 180,
      beamI: beamIntensity(now),
      horizon: box.top + ILLUSTRATION.height * box.scale,
      ...SKY_COLORS,
    };
  });

  const starsLayer = useDerivedValue(() => {
    const offset = parallax.get();
    return [{ translateX: offset.x * 0.5 }, { translateY: offset.y * 0.5 }];
  });

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Fill>{skyEffect ? <Shader source={skyEffect} uniforms={uniforms} /> : null}</Fill>

      <Group transform={starsLayer}>
        {STARS.map((star, index) => (
          <FigmaStar key={index} index={index} star={star} {...props} />
        ))}
        <Cassiopeia {...props} />
      </Group>

      <Heartbeat {...props} cx={cx} cy={cy} />
      <Flare {...props} cx={cx} cy={cy} />
      <AmbientMeteor {...props} />
      <TapMeteor {...props} />
      <Warp {...props} cx={cx} cy={cy} />
    </Canvas>
  );
}

type Star = (typeof STARS)[number];

/** Un dels 42 estels del Figma: s'encén quan hi arriba l'ona i parpelleja al seu ritme. */
function FigmaStar({
  star,
  index,
  box,
  t,
  clock,
  still,
}: SkyCanvasProps & { star: Star; index: number }) {
  const distance = Math.hypot(star.x - TOWER_STAR_CENTER.x, star.y - TOWER_STAR_CENTER.y) / 420;
  const opacity = useDerivedValue(() => {
    const reveal = beat(t.get(), TL.open + distance * TL.openFor * 0.8, 500, curve.power2Out);
    const twinkle = still
      ? 1
      : 0.6 + 0.4 * Math.sin((clock.get() / 1000) * (0.6 + noise(index, 2) * 1.4) + index);
    return star.o * reveal * twinkle;
  });
  const x = box.left + star.x * box.scale;
  const y = box.top + star.y * box.scale;
  const r = star.r * box.scale;
  return (
    <Group opacity={opacity}>
      <Circle cx={x} cy={y} r={r * 3} color={colors.lluna} opacity={0.35}>
        <BlurMask blur={r * 2} style="normal" />
      </Circle>
      <Circle cx={x} cy={y} r={r} color={colors.lluna} />
    </Group>
  );
}

/** Cassiopea: els estels hi són des del principi; les línies es dibuixen quan hi passa el feix. */
function Cassiopeia({ box, t }: SkyCanvasProps) {
  const points = CASSIOPEIA.map((star) => ({
    x: box.left + star.x * box.scale,
    y: box.top + star.y * box.scale,
  }));
  const path = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const drawn = useDerivedValue(() =>
    beat(t.get(), TL.constellation, TL.constellationFor, curve.sineInOut),
  );
  const starOpacity = useDerivedValue(
    () => beat(t.get(), TL.open + 300, 600, curve.power2Out) * (0.55 + 0.45 * drawn.get()),
  );
  const r = 1.7 * box.scale;
  return (
    <Group>
      <Path
        path={path}
        style="stroke"
        strokeWidth={3 * box.scale}
        color={colors.lluna}
        opacity={0.18}
        end={drawn}
      >
        <BlurMask blur={3} style="normal" />
      </Path>
      <Path
        path={path}
        style="stroke"
        strokeWidth={0.9 * box.scale}
        color={colors.lluna}
        opacity={0.55}
        end={drawn}
      />
      <Group opacity={starOpacity}>
        {points.map((point) => (
          <Group key={`${point.x}-${point.y}`}>
            <Circle cx={point.x} cy={point.y} r={r * 3.5} color={colors.lluna} opacity={0.4}>
              <BlurMask blur={r * 2.5} style="normal" />
            </Circle>
            <Circle cx={point.x} cy={point.y} r={r} color={colors.lluna} />
          </Group>
        ))}
      </Group>
    </Group>
  );
}

/** Abans de res, un sol estel batega on després hi haurà l'estel de la torre. */
function Heartbeat({ t, box, cx, cy }: SkyCanvasProps & { cx: number; cy: number }) {
  const opacity = useDerivedValue(() => {
    const now = t.get();
    const pulse = now < 700 ? 0.35 + 0.65 * Math.abs(Math.sin((Math.PI * now) / 350)) : 0.8;
    return pulse * (1 - beat(now, TL.ignite, 250));
  });
  return (
    <Group opacity={opacity}>
      <Circle cx={cx} cy={cy} r={9 * box.scale} color={colors.far} opacity={0.35}>
        <BlurMask blur={8 * box.scale} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={2.2 * box.scale} color={colors.lluna} />
    </Group>
  );
}

/** Esclat de lent quan s'encén l'estel de la torre, que després queda com un resplendor viu. */
function Flare({
  t,
  clock,
  exit,
  box,
  still,
  cx,
  cy,
}: SkyCanvasProps & { cx: number; cy: number }) {
  const intensity = useDerivedValue(() => {
    const breath = still ? 0 : 0.08 * Math.sin((clock.get() / 2800) * Math.PI * 2);
    return (
      Math.max(WARM, flare(t.get()) + breath * beat(t.get(), TL.end - 400, 400)) + exit.get() * 1.4
    );
  });
  const rays = useDerivedValue(() => [{ scale: 0.5 + 0.5 * Math.min(2, intensity.get()) }]);
  const glow = 70 * box.scale;
  const ray = 150 * box.scale;
  const thin = 1.6 * box.scale;
  return (
    <Group blendMode="plus" opacity={intensity}>
      <Circle cx={cx} cy={cy} r={glow}>
        <RadialGradient
          c={vec(cx, cy)}
          r={glow}
          colors={[`${colors.far}CC`, `${colors.far}33`, transparent]}
        />
      </Circle>
      <Group transform={rays} origin={vec(cx, cy)}>
        <Rect x={cx - ray} y={cy - thin / 2} width={ray * 2} height={thin}>
          <LinearGradient
            start={vec(cx - ray, cy)}
            end={vec(cx + ray, cy)}
            colors={[transparent, colors.lluna, transparent]}
          />
        </Rect>
        <Rect x={cx - thin / 2} y={cy - ray * 0.7} width={thin} height={ray * 1.4}>
          <LinearGradient
            start={vec(cx, cy - ray * 0.7)}
            end={vec(cx, cy + ray * 0.7)}
            colors={[transparent, colors.lluna, transparent]}
          />
        </Rect>
      </Group>
    </Group>
  );
}

type Streak = { tail: { x: number; y: number }; head: { x: number; y: number }; alpha: number };

/** Un estel fugaç: un cap brillant amb una cua que s'esvaeix. */
function Trail({ streak }: { streak: SharedValue<Streak | null> }) {
  const p1 = useDerivedValue(() => {
    const s = streak.get();
    return vec(s?.tail.x ?? 0, s?.tail.y ?? 0);
  });
  const p2 = useDerivedValue(() => {
    const s = streak.get();
    return vec(s?.head.x ?? 0, s?.head.y ?? 0);
  });
  const alpha = useDerivedValue(() => Math.max(WARM, streak.get()?.alpha ?? 0));
  return (
    <Group opacity={alpha} blendMode="plus">
      <Line p1={p1} p2={p2} strokeWidth={1.6} strokeCap="round">
        <LinearGradient start={p1} end={p2} colors={[transparent, colors.lluna]} />
      </Line>
      <Circle c={p2} r={2.4} color={colors.lluna}>
        <BlurMask blur={3} style="normal" />
      </Circle>
    </Group>
  );
}

function streakFrom(x: number, y: number, angle: number, length: number, progress: number): Streak {
  'worklet';
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const head = { x: x + dx * length * progress, y: y + dy * length * progress };
  const tailLength = length * 0.7 * Math.min(1, progress * 2);
  return {
    head,
    tail: { x: head.x - dx * tailLength, y: head.y - dy * tailLength },
    alpha: Math.pow(Math.sin(Math.PI * Math.min(1, progress)), 0.7),
  };
}

function AmbientMeteor({ clock, box, meteorsSince, still }: SkyCanvasProps) {
  const streak = useDerivedValue(() => {
    if (still) return null;
    const meteor = meteorAt(clock.get(), meteorsSince);
    if (!meteor) return null;
    return streakFrom(
      box.left + meteor.x * box.scale,
      box.top + meteor.y * box.scale,
      meteor.angle,
      METEOR.length * box.scale,
      meteor.progress,
    );
  });
  return <Trail streak={streak} />;
}

function TapMeteor({ clock, tap, box }: SkyCanvasProps) {
  const streak = useDerivedValue(() => {
    const touch = tap.get();
    if (!touch) return null;
    const progress = (clock.get() - touch.at) / METEOR.duration;
    if (progress < 0 || progress > 1) return null;
    return streakFrom(touch.x, touch.y, 150, METEOR.length * box.scale, progress);
  });
  return <Trail streak={streak} />;
}

/** Salt a la velocitat de la llum: els estels s'estiren des de l'estel de la torre i un flaix. */
function Warp({ exit, box, width, height, cx, cy }: SkyCanvasProps & { cx: number; cy: number }) {
  // Abans de sortir (e = 0), els raigs fan zero de llarg: no es veuen, però escalfen el pipeline.
  const rays = useDerivedValue(() => {
    const e = exit.get();
    const builder = Skia.PathBuilder.Make();
    for (const ray of WARP_RAYS) {
      const inner = ray.radius * box.scale * (1 + 2.2 * e * e);
      const outer = inner + ray.length * e * 260 * box.scale;
      const dx = Math.cos(ray.angle);
      const dy = Math.sin(ray.angle);
      builder.moveTo(cx + dx * inner, cy + dy * inner);
      builder.lineTo(cx + dx * outer, cy + dy * outer);
    }
    return builder.build();
  });
  const raysOpacity = useDerivedValue(() => {
    const e = exit.get();
    return Math.max(WARM, Math.min(1, e * 2.5) * (1 - beat(e, 0.85, 0.15)));
  });
  const flash = useDerivedValue(() => {
    const e = exit.get();
    return Math.max(WARM, 0.5 * beat(e, 0.55, 0.3) * (1 - beat(e, 0.85, 0.15)));
  });
  return (
    <Group>
      <Path
        path={rays}
        style="stroke"
        strokeWidth={1.3}
        strokeCap="round"
        color={colors.lluna}
        opacity={raysOpacity}
        blendMode="plus"
      />
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        color={colors.far}
        opacity={flash}
        blendMode="plus"
      />
    </Group>
  );
}
