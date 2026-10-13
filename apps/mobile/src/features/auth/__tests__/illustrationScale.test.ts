import { ILLUSTRATION, illustrationScale } from '../WelcomeIllustration';

// Alçada aproximada del contingut en català: logotip, textos, tres botons, peu i zona segura.
const CONTENT = 460;

/** On queda la part de dalt de la torre, en punts des de dalt de la pantalla. */
function towerTop(screen: { width: number; height: number; topInset: number }) {
  const scale = illustrationScale(screen, CONTENT);
  const illustrationBottom = CONTENT - ILLUSTRATION.contentOverlap * scale;
  return screen.height - illustrationBottom - (ILLUSTRATION.height - ILLUSTRATION.towerTop) * scale;
}

describe('illustrationScale', () => {
  it("en una pantalla alta fa l'amplada de la pantalla, com al Figma", () => {
    expect(illustrationScale({ width: 393, height: 852, topInset: 59 }, CONTENT)).toBe(1);
    expect(illustrationScale({ width: 430, height: 932, topInset: 59 }, CONTENT)).toBeCloseTo(
      430 / 393,
    );
  });

  it.each([
    ['iPhone SE', { width: 375, height: 667, topInset: 20 }],
    ['Android petit', { width: 360, height: 640, topInset: 24 }],
  ])("a %s s'encongeix i la torre queda sencera sota la barra d'estat", (_nom, screen) => {
    expect(illustrationScale(screen, CONTENT)).toBeLessThan(screen.width / ILLUSTRATION.width);
    expect(towerTop(screen)).toBeGreaterThanOrEqual(screen.topInset - 0.001);
  });
});
