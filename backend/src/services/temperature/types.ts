export interface TemperatureReading {
  stationId: string;
  name: string;
  latitude: number;
  longitude: number;
  temperature: number;
  readingUnit: string;
}

export interface HumidityReading {
  stationId: string;
  name: string;
  latitude: number;
  longitude: number;
  humidity: number;
  readingUnit: string;
}

export interface WindReading {
  stationId: string;
  name: string;
  latitude: number;
  longitude: number;
  windSpeed: number;
  readingUnit: string;
}

export interface GeneralApiResponse {
  code: number;
  errorMsg: string;
  data: {
    readingUnit: string;
    stations: Array<{
      id: string;
      name: string;
      location: {
        latitude: number;
        longitude: number;
      };
    }>;
    readings: Array<{
      timestamp: string;
      data: Array<{
        stationId: string;
        value: number;
      }>;
    }>;
  };
}
