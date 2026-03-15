const BASE_URL = 'https://api-open.data.gov.sg/v2/real-time/api';

export const API_URLS = {
  airTemperature: `${BASE_URL}/air-temperature`,
  psi: `${BASE_URL}/psi`,
  uv: `${BASE_URL}/uv`,
  twoHourForecast: `${BASE_URL}/two-hr-forecast`,
  trafficImages: `https://api.data.gov.sg/v1/transport/traffic-images`,
  carpark: `https://api.data.gov.sg/v1/transport/carpark-availability`,
} as const;
