import { withCache } from '../../utils/cache.js';
import { API_URLS } from '../../config/api.js';
import type { ServiceResult } from '../../types/index.js';
import type {
  TemperatureReading,
  GeneralApiResponse,
  HumidityReading,
  WindReading,
} from './types.js';

const CACHE_TTL_MINUTES = 15;
const CACHE_PK = 'TEMPERATURE';

const toRadians = (value: number): number => (value * Math.PI) / 180;

const calculateDistanceKm = (
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number => {
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fetchValueFromStation = async (
  url: string,
  longitude: number,
  latitude: number,
) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const apiData = (await response.json()) as GeneralApiResponse;
  if (apiData.code !== 0) {
    throw new Error(`API error: ${apiData.errorMsg}`);
  }

  const latestReading = apiData.data.readings[0];
  if (!latestReading) {
    throw new Error('No readings available from API');
  }

  type Station = GeneralApiResponse['data']['stations'][number];
  type ReadingData =
    GeneralApiResponse['data']['readings'][number]['data'][number];

  const station = apiData.data.stations.reduce<Station | null>((closest, current) => {
    if (!closest) {
      return current;
    }

    const currentDistance = calculateDistanceKm(
      latitude,
      longitude,
      current.location.latitude,
      current.location.longitude,
    );
    const closestDistance = calculateDistanceKm(
      latitude,
      longitude,
      closest.location.latitude,
      closest.location.longitude,
    );

    return currentDistance < closestDistance ? current : closest;
  }, null);

  if (!station) {
    throw new StationNotFoundError(latitude, longitude);
  }

  const stationReading = latestReading.data.find(
    (r: ReadingData) => r.stationId === station.id,
  );
  return { station, stationReading, readingUnit: apiData.data.readingUnit };
};

export const getTemperatureByLocation = async (
  latitude: number,
  longitude: number,
): Promise<ServiceResult<TemperatureReading>> => {
  return withCache({
    pk: CACHE_PK,
    sk: `${latitude}#${longitude}`,
    ttlMinutes: CACHE_TTL_MINUTES,
    label: `temperature (${latitude}, ${longitude})`,
    fetch: async () => {
      const { station, stationReading, readingUnit } =
        await fetchValueFromStation(
          API_URLS.airTemperature,
          longitude,
          latitude,
        );
      if (!stationReading) {
        throw new Error(
          `No temperature reading found for station ${station.id}`,
        );
      }

      return {
        stationId: station.id,
        name: station.name,
        latitude: station.location.latitude,
        longitude: station.location.longitude,
        temperature: stationReading.value,
        readingUnit: readingUnit,
      };
    },
  });
};

export const getHumidityByLocation = async (
  latitude: number,
  longitude: number,
): Promise<ServiceResult<HumidityReading>> => {
  return withCache({
    pk: CACHE_PK,
    sk: `${latitude}#${longitude}`,
    ttlMinutes: CACHE_TTL_MINUTES,
    label: `humidity (${latitude}, ${longitude})`,
    fetch: async () => {
      const { station, stationReading, readingUnit } =
        await fetchValueFromStation(API_URLS.airHumidity, longitude, latitude);
      if (!stationReading) {
        throw new Error(`No humidity reading found for station ${station.id}`);
      }

      return {
        stationId: station.id,
        name: station.name,
        latitude: station.location.latitude,
        longitude: station.location.longitude,
        humidity: stationReading.value,
        readingUnit: readingUnit,
      };
    },
  });
};

export const getWindByLocation = async (
  latitude: number,
  longitude: number,
): Promise<ServiceResult<WindReading>> => {
  return withCache({
    pk: CACHE_PK,
    sk: `${latitude}#${longitude}`,
    ttlMinutes: CACHE_TTL_MINUTES,
    label: `wind (${latitude}, ${longitude})`,
    fetch: async () => {
      const { station, stationReading, readingUnit } =
        await fetchValueFromStation(API_URLS.windSpeed, longitude, latitude);
      if (!stationReading) {
        throw new Error(
          `No wind speed reading found for station ${station.id}`,
        );
      }

      return {
        stationId: station.id,
        name: station.name,
        latitude: station.location.latitude,
        longitude: station.location.longitude,
        windSpeed: stationReading.value,
        readingUnit: readingUnit,
      };
    },
  });
};

export class StationNotFoundError extends Error {
  constructor(latitude: number, longitude: number) {
    super(`No station found at coordinates (${latitude}, ${longitude})`);
    this.name = 'StationNotFoundError';
  }
}
