import type { City, Country, MileageTarget } from '@truckermudgeon/map/types';

function mapOf<T extends { token: string }>(array: T[]): Map<string, T> {
  return new Map(array.map(x => [x.token, x]));
}

function mapOfCity(array: CityFixture[]): Map<string, City> {
  return new Map(
    array.map(city => [
      city.token,
      {
        areas: [],
        nameLocalized: undefined,
        ...city,
      },
    ]),
  );
}
type CityFixture = Omit<City, 'areas' | 'nameLocalized'>;

function mapOfCountry(array: CountryFixture[]): Map<string, Country> {
  return new Map(
    array.map(country => [
      country.token,
      {
        nameLocalized: undefined,
        truckSpeedLimits: {},
        ...country,
      },
    ]),
  );
}
type CountryFixture = Omit<Country, 'nameLocalized' | 'truckSpeedLimits'>;

export const ar_ftsmith_ = mapOf<MileageTarget>([
  {
    token: 'ar_ftsmith_',
    editorName: 'AR ftsmith',
    defaultName: 'FtSmith',
    nameVariants: ['Fort Smith'],
    distanceOffset: 0,
    x: 8367.73,
    y: 19871.79,
    searchRadius: 600,
  },
]);

export const az_ehrenberg = mapOf<MileageTarget>([
  {
    token: 'az_ehrenberg',
    editorName: 'AZ Ehrenberg',
    defaultName: 'Ehrenberg',
    nameVariants: [],
    distanceOffset: 0,
  },
]);

export const ca_janesvill = mapOf<MileageTarget>([
  {
    token: 'ca_janesvill',
    editorName: 'CA Janesville',
    defaultName: 'Janesville',
    nameVariants: [],
    distanceOffset: 0,
    x: -102591.2,
    y: -19511.5,
  },
]);

export const ca_napa = mapOf<MileageTarget>([
  {
    token: 'ca_napa',
    editorName: 'CA Napa',
    defaultName: 'Napa',
    nameVariants: [],
    distanceOffset: 12,
    x: -114034.29,
    y: -17489.92,
  },
]);

export const ca_nv_sl_ = mapOf<MileageTarget>([
  {
    token: 'ca_nv_sl_',
    editorName: 'CA NV Border S',
    defaultName: 'Nevada State Line',
    nameVariants: ['Topaz Lake'],
    distanceOffset: 0,
    x: -100480.69,
    y: -9469.72,
  },
]);

export const ca_sanjose1 = mapOf<MileageTarget>([
  {
    token: 'ca_sanjose1',
    editorName: 'CA San Jose 1',
    defaultName: 'San Jose',
    nameVariants: [],
    distanceOffset: 0,
    x: -113595.57,
    y: -6027.46,
    searchRadius: 20,
  },
]);

export const ca_us6x395 = mapOf<MileageTarget>([
  {
    token: 'ca_us6x395',
    editorName: 'CA US-6 x US-395',
    defaultName: 'Jct',
    nameVariants: [],
    distanceOffset: 0,
    x: -99037.74,
    y: -2585.33,
  },
]);

export const co_colospgs = mapOf<MileageTarget>([
  {
    token: 'co_colospgs',
    editorName: 'CO Colorado Springs',
    defaultName: 'Colo Spgs',
    nameVariants: [],
    distanceOffset: 2,
    searchRadius: 50,
    x: -38868.36,
    y: -1412.28,
  },
]);

export const co_steamboat = mapOf<MileageTarget>([
  {
    token: 'co_steamboat',
    editorName: 'CO Steamboat Spgs',
    defaultName: 'Steamboat Spgs',
    nameVariants: [],
    distanceOffset: 0,
    x: -46221.81,
    y: -11154.48,
  },
]);

export const mt_stregis = mapOf<MileageTarget>([
  {
    token: 'mt_stregis',
    editorName: 'MT St Regis',
    defaultName: 'St Regis',
    nameVariants: [],
    distanceOffset: 0,
    x: -71262.27,
    y: -53983.75,
  },
]);

export const mt_sidney200 = mapOf<MileageTarget>([
  {
    token: 'mt_sidney200',
    editorName: 'MT Sidney MT 200 N',
    defaultName: 'Sidney',
    nameVariants: [],
    distanceOffset: 73,
    x: -37445.5,
    y: -49478.42,
  },
]);

export const ne_sid = mapOf<MileageTarget>([
  {
    token: 'ne_sid',
    editorName: 'NE Sidney',
    defaultName: 'Sidney',
    nameVariants: [],
    distanceOffset: -3,
    x: -29919.76,
    y: -14341.6,
  },
]);

export const wa_ritzvill2 = mapOf<MileageTarget>([
  {
    token: 'wa_ritzvill2',
    editorName: 'WA Ritzville I-90E',
    defaultName: 'Ritzville',
    nameVariants: [],
    distanceOffset: 5,
    x: -86198.63,
    y: -56618.09,
  },
]);

export const wa_wallula = mapOf<MileageTarget>([
  {
    token: 'wa_wallula',
    editorName: 'WA Wallula Jct',
    defaultName: 'Wallula Jct',
    nameVariants: [],
    distanceOffset: 0,
    x: -87728.98,
    y: -50872.82,
  },
]);

export const unreleased_mo = mapOf<MileageTarget>([
  {
    token: 'mo_nevada',
    editorName: 'MO Nevada',
    defaultName: 'Nevada',
    nameVariants: [],
    distanceOffset: 0,
    x: 7263.34,
    y: 6710.21,
  },
]);

export const citiesAts = mapOfCity([
  {
    token: 'san_jose',
    name: 'San Jose',
    countryToken: 'california',
    population: 1600000,
    x: -114050.40625,
    y: -5960.40234375,
  },
  {
    token: 'fort_smith',
    name: 'Fort Smith',
    countryToken: 'arkansas',
    population: 89500,
    x: 7882.8828125,
    y: 19287.765625,
  },
  {
    token: 'colorado_spr',
    name: 'Colorado Springs',
    countryToken: 'colorado',
    population: 484000,
    x: -37949.51171875,
    y: -1475.4921875,
  },
  {
    token: 'sidney',
    name: 'Sidney',
    countryToken: 'montana',
    population: 6200,
    x: -32604.1328125,
    y: -51567.953125,
  },
  {
    token: 'steamboat_sp',
    name: 'Steamboat Springs',
    countryToken: 'colorado',
    population: 13000,
    x: -46989.02734375,
    y: -11796.0625,
  },
]);

export const countriesAts = mapOfCountry([
  {
    token: 'california',
    name: 'California',
    id: 1,
    x: -100000,
    y: 4000,
    code: 'CA',
  },
  {
    token: 'arizona',
    name: 'Arizona',
    id: 3,
    x: -72000,
    y: 22000,
    code: 'AZ',
  },
  {
    token: 'washington',
    name: 'Washington',
    id: 47,
    x: -93000,
    y: -62500,
    code: 'WA',
  },
  {
    token: 'colorado',
    name: 'Colorado',
    id: 7,
    x: -43000,
    y: -2000,
    code: 'CO',
  },
  {
    token: 'montana',
    name: 'Montana',
    id: 27,
    x: -52000,
    y: -48000,
    code: 'MT',
  },
  {
    token: 'nebraska',
    name: 'Nebraska',
    id: 18,
    x: -15000,
    y: -15000,
    code: 'NE',
  },
  {
    token: 'arkansas',
    name: 'Arkansas',
    id: 19,
    x: 17000,
    y: 20000,
    code: 'AR',
  },
]);

export const at_klagenf = mapOf<MileageTarget>([
  {
    defaultName: 'Klagenfurt',
    distanceOffset: 0,
    editorName: 'klagenfurt',
    nameVariants: [],
    x: 14400,
    y: 23630,
    token: 'at_klagenf',
  },
]);

export const ba_bihac_ = mapOf<MileageTarget>([
  {
    defaultName: 'бихаћ<br>bihać',
    distanceOffset: 0,
    editorName: 'bihac',
    nameVariants: [],
    searchRadius: 40,
    token: 'ba_bihac_',
    x: 20842.63,
    y: 32999.86,
  },
]);

export const cz_praha_ = mapOf<MileageTarget>([
  {
    defaultName: 'PRAHA',
    distanceOffset: 0,
    editorName: 'praha',
    nameVariants: ['Prag/Praha'],
    x: 14440,
    y: 4040,
    token: 'cz_praha_',
  },
]);

export const pt_border_a3 = mapOf<MileageTarget>([
  {
    defaultName: 'ESPANHA',
    distanceOffset: 0,
    editorName: 'pt_spain_a3',
    nameVariants: [],
    token: 'pt_border_a3',
    x: -83440.52,
    y: 34543.52,
  },
]);

export const fr_stquentin = mapOf<MileageTarget>([
  {
    defaultName: 'S<sup>T </sup>QUENTIN',
    distanceOffset: 0,
    editorName: 'st quentin',
    nameVariants: [],
    token: 'fr_stquentin',
  },
]);

export const uk_bristol = mapOf<MileageTarget>([
  {
    defaultName: 'Bristol',
    distanceOffset: 0,
    editorName: 'bristol',
    nameVariants: [],
    searchRadius: 500,
    token: 'uk_bristol',
    x: -50154.25,
    y: -13825.47,
  },
]);

export const unreleased_ru = mapOf<MileageTarget>([
  {
    defaultName: 'ЛУГА',
    distanceOffset: 0,
    editorName: 'luga',
    nameVariants: ['LUGA'],
    searchRadius: 60,
    token: 'ru_luga',
    x: 60718.08,
    y: -50019.1,
  },
]);

export const citiesEts2 = mapOfCity([
  {
    countryToken: 'czech',
    name: 'Praha',
    population: 1350000,
    token: 'prague',
    x: 14440,
    y: 4040,
  },
  {
    countryToken: 'austria',
    name: 'Klagenfurt am Wörthersee',
    population: 100000,
    token: 'klagenfurt',
    x: 14400,
    y: 23630,
  },
]);

export const countriesEts2 = mapOfCountry([
  {
    code: 'A',
    id: 1,
    name: 'Österreich',
    token: 'austria',
    x: 14940,
    y: 18780,
  },
  {
    code: 'CZ',
    id: 3,
    name: 'Česká Republika',
    token: 'czech',
    x: 18500,
    y: 6000,
  },
  {
    code: 'F',
    id: 4,
    name: 'France',
    token: 'france',
    x: -32380,
    y: 20210,
  },
  {
    code: 'GB',
    id: 10,
    name: 'United Kingdom',
    token: 'uk',
    x: -42290,
    y: -14150,
  },
]);
