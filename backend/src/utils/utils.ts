export const extractError = (
  result: PromiseSettledResult<unknown>,
): string | undefined => {
  if (result.status === 'fulfilled') return undefined;
  return result.reason instanceof Error
    ? result.reason.message
    : 'Unknown error';
};

const toRadians = (value: number): number => (value * Math.PI) / 180;

export const calculateDistanceKm = (
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
