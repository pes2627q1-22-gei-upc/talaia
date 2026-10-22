import { apiUrlFromHost } from '../env';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: {} } }));

it("dedueix l'API de l'ordinador d'on s'ha carregat l'app", () => {
  expect(apiUrlFromHost('192.168.1.50:8081')).toBe('http://192.168.1.50:3000/api/v1');
});

it("amb nip.io, la IP (l'ATS d'iOS no deixa fer HTTP a dominis)", () => {
  expect(apiUrlFromHost('192-168-1-50.nip.io:8081')).toBe('http://192.168.1.50:3000/api/v1');
  expect(apiUrlFromHost('metro.example.test:8081')).toBe('http://metro.example.test:3000/api/v1');
});

it('sense Metro (build de producció, tests) no en dedueix res', () => {
  expect(apiUrlFromHost(undefined)).toBeUndefined();
  expect(apiUrlFromHost(null)).toBeUndefined();
  expect(apiUrlFromHost('')).toBeUndefined();
});

describe('env.apiUrl', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = original;
    jest.resetModules();
  });

  function load(hostUri: string | undefined, apiUrl: string | undefined) {
    if (apiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = apiUrl;
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { hostUri } },
    }));
    let env!: typeof import('../env').env;
    jest.isolateModules(() => {
      env = jest.requireActual<typeof import('../env')>('../env').env;
    });
    return env.apiUrl;
  }

  it('fa servir EXPO_PUBLIC_API_URL si hi és', () => {
    expect(load('10-0-0-5.nip.io:8081', 'https://api.talaia.test/api/v1')).toBe(
      'https://api.talaia.test/api/v1',
    );
  });

  it('si no hi és (o és buida), la treu de Metro', () => {
    expect(load('10-0-0-5.nip.io:8081', undefined)).toBe('http://10.0.0.5:3000/api/v1');
    expect(load('10-0-0-5.nip.io:8081', '')).toBe('http://10.0.0.5:3000/api/v1');
  });

  it('sense Metro ni variable, localhost', () => {
    expect(load(undefined, undefined)).toBe('http://localhost:3000/api/v1');
  });
});
