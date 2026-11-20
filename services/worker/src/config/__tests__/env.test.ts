import { loadEnv } from '../env';

describe('loadEnv', () => {
  it("fa servir l'API pública d'Open-Meteo per defecte", () => {
    expect(loadEnv({}).OPEN_METEO_BASE_URL).toBe('https://api.open-meteo.com/v1');
  });

  it('tracta una variable buida com a no definida', () => {
    expect(loadEnv({ OPEN_METEO_BASE_URL: '' }).OPEN_METEO_BASE_URL).toBe(
      'https://api.open-meteo.com/v1',
    );
  });

  it('accepta una URL pròpia (per exemple, una instància local)', () => {
    expect(loadEnv({ OPEN_METEO_BASE_URL: 'http://localhost:8080/v1' }).OPEN_METEO_BASE_URL).toBe(
      'http://localhost:8080/v1',
    );
  });

  it('no arrenca amb una URL invàlida', () => {
    expect(() => loadEnv({ OPEN_METEO_BASE_URL: 'no-es-una-url' })).toThrow('OPEN_METEO_BASE_URL');
  });

  it('ENVIA_PUSH: per defecte no envia; només amb «true»', () => {
    expect(loadEnv({}).ENVIA_PUSH).toBe(false);
    expect(loadEnv({ ENVIA_PUSH: '' }).ENVIA_PUSH).toBe(false);
    expect(loadEnv({ ENVIA_PUSH: 'false' }).ENVIA_PUSH).toBe(false);
    expect(loadEnv({ ENVIA_PUSH: 'true' }).ENVIA_PUSH).toBe(true);
    expect(() => loadEnv({ ENVIA_PUSH: 'si' })).toThrow('ENVIA_PUSH');
  });
});
