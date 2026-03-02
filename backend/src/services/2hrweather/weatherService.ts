import { API_URLS } from '../../config/api.js';
import { with2hrWeatherCache } from '../../utils/cache.js';

export interface WeatherForecast {
  area: string;
  forecast: string;
}

export interface WeatherItem {
  update_timestamp: string;
  timestamp: string;
  valid_period: {
    start: string;
    end: string;
    text: string;
  };
  forecasts: WeatherForecast[];
}

export interface AreaMetadata {
  name: string;
  label_location: {
    latitude: number;
    longitude: number;
  };
}

export interface WeatherResponse {
  code: number;
  errorMsg: string;
  data: {
    items: WeatherItem[];
    area_metadata: AreaMetadata[];
  };
}

const getDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getLatestForecast = async (lat: number, lon: number) => {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;

  return with2hrWeatherCache({
    pk: `WEATHER#${roundedLat}`,
    sk: `${roundedLon}`,
    ttlMinutes: 120,
    label: `2hr Weather at ${roundedLat}, ${roundedLon}`,
    fetch: async () => {
      const response = await fetch(API_URLS.twoHourForecast);

      if (!response.ok) {
        throw new Error(`NEA API Error: ${response.status}`);
      }

      const result = (await response.json()) as WeatherResponse;

      if (result.code !== 0) {
        throw new Error(
          `NEA API Error Code ${result.code}: ${result.errorMsg}`,
        );
      }

      const areaMetadata = result.data?.area_metadata ?? [];
      const items = result.data?.items ?? [];

      const latestItem = items[0];
      if (!latestItem) {
        throw new Error('NEA API returned 0 items.');
      }

      if (areaMetadata.length === 0) {
        throw new Error('No area metadata available.');
      }

      const nearestArea = areaMetadata.reduce((prev, curr) => {
        const prevDist = getDistance(
          lat,
          lon,
          prev.label_location.latitude,
          prev.label_location.longitude,
        );
        const currDist = getDistance(
          lat,
          lon,
          curr.label_location.latitude,
          curr.label_location.longitude,
        );
        return currDist < prevDist ? curr : prev;
      });

      const forecasts = latestItem.forecasts ?? [];
      const forecastObj = forecasts.find((f) => f.area === nearestArea.name);

      return {
        area: nearestArea.name,
        forecast: forecastObj?.forecast ?? 'No forecast available',
        validPeriod: latestItem.valid_period?.text ?? 'N/A',
        timestamp:
          latestItem.update_timestamp ||
          latestItem.timestamp ||
          new Date().toISOString(),
      };
    },
  });
};
