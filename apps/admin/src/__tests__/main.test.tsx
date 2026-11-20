import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase, stubAdminApi } from './support/fakeAuth';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => createFakeSupabase().client }));

describe('Arrencada de la web', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('mostra la web d’administració a la pàgina', async () => {
    stubAdminApi(204);
    document.body.innerHTML = '<div id="root"></div>';

    await import('../main');

    expect(
      await screen.findByRole('heading', { name: 'Talaia · Administració' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Continua amb Google' })).toBeInTheDocument();
  });

  it('falla de manera explícita si l’HTML no té l’arrel', async () => {
    await expect(import('../main')).rejects.toThrow(
      "No s'ha trobat l'arrel de la web d'administració",
    );
  });
});
