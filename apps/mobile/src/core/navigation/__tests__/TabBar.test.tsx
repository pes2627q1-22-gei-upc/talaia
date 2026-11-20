import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { type ThemeName, ThemeProvider } from '@/core/theme/theme';
import { colors, colorsVermell } from '@/core/theme/tokens';

import { TabBar } from '../TabBar';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
  isUsingSystemBrightnessAsync: jest.fn().mockResolvedValue(true),
  restoreSystemBrightnessAsync: jest.fn().mockResolvedValue(undefined),
}));

const routes = [
  { key: 'explora-1', name: '(explora)', title: 'Explora' },
  { key: 'calendari-1', name: 'calendari', title: 'Calendari' },
  { key: 'alertes-1', name: '(alertes)', title: 'Alertes' },
  { key: 'perfil-1', name: 'perfil', title: 'Perfil' },
];

async function renderBar(theme: ThemeName = 'normal', defaultPrevented = false) {
  const emit = jest.fn().mockReturnValue({ defaultPrevented });
  const navigateToTab = jest.fn();
  const props = {
    state: { index: 1, routes: routes.map(({ key, name }) => ({ key, name })) },
    descriptors: Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.title } }])),
    emitter: { emit },
    navigateToTab,
    insets: { top: 0, right: 0, bottom: 34, left: 0 },
  } as unknown as BottomTabBarProps;
  await render(
    <ThemeProvider name={theme}>
      <TabBar {...props} />
    </ThemeProvider>,
  );
  return { emit, navigateToTab };
}

describe('TabBar', () => {
  it('les quatre pestanyes són pestanyes accessibles, i només la del calendari està triada', async () => {
    await renderBar();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Calendari' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Explora' })).not.toBeSelected();
  });

  it('tocar una altra pestanya hi va, i tornar a tocar la triada només avisa la pila', async () => {
    const { emit, navigateToTab } = await renderBar();
    await fireEvent.press(screen.getByRole('tab', { name: 'Alertes' }));
    expect(navigateToTab).toHaveBeenCalledWith('alertes-1');

    await fireEvent.press(screen.getByRole('tab', { name: 'Calendari' }));
    expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ target: 'calendari-1' }));
    expect(navigateToTab).toHaveBeenCalledTimes(1);
  });

  it('si la pantalla atura el tabPress, no hi va', async () => {
    const { navigateToTab } = await renderBar('normal', true);
    await fireEvent.press(screen.getByRole('tab', { name: 'Perfil' }));
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it.each([
    ['normal', colors],
    ['vermell', colorsVermell],
  ] as const)(
    'en el tema %s, textos i icones van amb la paleta del tema',
    async (theme, palette) => {
      await renderBar(theme);
      // En mode nit, la triada s'inverteix (negre sobre vermell): si no, no es distingiria.
      const selected = theme === 'vermell' ? palette.nit : palette.far;
      expect(screen.getByText('Calendari')).toHaveStyle({ color: selected });
      expect(screen.getByRole('tab', { name: 'Calendari' })).toHaveStyle({
        backgroundColor: theme === 'vermell' ? palette.far : palette.crep,
      });
      expect(screen.getByText('Perfil')).toHaveStyle({ color: palette.boira });
      const tree = JSON.stringify(screen.toJSON());
      // Cap color que no sigui del tema: en mode nit, res que no sigui vermell.
      const hex = [...tree.matchAll(/"#[0-9A-Fa-f]{6}"/g)].map((m) =>
        m[0].slice(1, -1).toUpperCase(),
      );
      const allowed = new Set(Object.values(palette).map((c) => c.toUpperCase()));
      expect(hex.filter((c) => !allowed.has(c))).toEqual([]);
    },
  );
});
