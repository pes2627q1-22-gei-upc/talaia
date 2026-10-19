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
});
