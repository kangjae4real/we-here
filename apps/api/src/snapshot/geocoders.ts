import { type LatLng, labelKey } from '../core/geo.js';

/** One reverse lookup. Null means "no name for this point"; a throw means the lookup failed. */
export interface ReverseGeocoder {
  reverse(p: LatLng, signal: AbortSignal): Promise<string | null>;
}

export interface GeocoderKeys {
  ncpClientId?: string;
  ncpClientSecret?: string;
}

const NAVER_URL = 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc';

interface NaverArea {
  name?: string;
}
interface NaverReply {
  status?: { code?: number };
  results?: { region?: Record<string, NaverArea> }[];
}

/** NCP Maps reverse geocoding: the dong (area3), else the gu (area2). */
function naverGeocoder(keys: GeocoderKeys): ReverseGeocoder {
  return {
    async reverse(p, signal) {
      const url = `${NAVER_URL}?coords=${p.lng},${p.lat}&orders=legalcode,admcode&output=json`;
      const res = await fetch(url, {
        signal,
        headers: {
          'x-ncp-apigw-api-key-id': keys.ncpClientId ?? '',
          'x-ncp-apigw-api-key': keys.ncpClientSecret ?? '',
        },
      });
      if (!res.ok) throw new Error(`naver reverse geocode ${res.status}`);
      const body = (await res.json()) as NaverReply;
      const region = body.results?.[0]?.region;
      return region?.area3?.name || region?.area2?.name || null;
    },
  };
}

/**
 * `GEOCODER` picks one. `none` (the default) names nothing, so a server
 * without keys never shows made-up names. `fake` gives a deterministic name
 * per cache key for local runs and tests.
 */
export const GEOCODERS = {
  none: () => ({ reverse: async () => null }),
  fake: () => ({ reverse: async (p: LatLng) => `가상동 ${labelKey(p)}` }),
  naver: naverGeocoder,
} satisfies Record<string, (keys: GeocoderKeys) => ReverseGeocoder>;

export type GeocoderName = keyof typeof GEOCODERS;
