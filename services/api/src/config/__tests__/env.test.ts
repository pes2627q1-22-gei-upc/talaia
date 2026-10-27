import { loadEnv } from '../env';

describe('loadEnv', () => {
  it('fa servir el port 3000 per defecte', () => {
    expect(loadEnv({}).API_PORT).toBe(3000);
  });

  it('converteix API_PORT a número', () => {
    expect(loadEnv({ API_PORT: '8080' }).API_PORT).toBe(8080);
  });

  it('no arrenca amb un port invàlid', () => {
    expect(() => loadEnv({ API_PORT: 'abc' })).toThrow('API_PORT');
  });

  it('DATABASE_URL és opcional, i buida compta com a absent', () => {
    expect(loadEnv({}).DATABASE_URL).toBeUndefined();
    expect(loadEnv({ DATABASE_URL: '' }).DATABASE_URL).toBeUndefined();
  });

  it('SUPABASE_URL usa el valor per defecte quan està buit', () => {
    expect(loadEnv({}).SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(loadEnv({ SUPABASE_URL: '' }).SUPABASE_URL).toBe('http://127.0.0.1:54321');
  });

  it('accepta una URL postgresql:// i rebutja la resta', () => {
    const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
    expect(loadEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
    expect(() => loadEnv({ DATABASE_URL: 'https://exemple.cat' })).toThrow('DATABASE_URL');
  });

  it('només accepta una clau d’Aprop prou llarga i no interpreta comentaris com a secret', () => {
    const key = '0123456789abcdef0123456789abcdef';
    expect(loadEnv({ APROP_API_KEY: '' }).APROP_API_KEY).toBeUndefined();
    expect(loadEnv({ APROP_API_KEY: key }).APROP_API_KEY).toBe(key);
    expect(() => loadEnv({ APROP_API_KEY: 'clau-curta' })).toThrow('APROP_API_KEY');
    expect(() =>
      loadEnv({ APROP_API_KEY: '# comentari que no es pot fer servir com a clau API' }),
    ).toThrow('APROP_API_KEY');
  });
});
