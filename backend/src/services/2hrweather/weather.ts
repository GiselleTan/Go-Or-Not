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
    area_metadata: AreaMetadata[];
    items: WeatherItem[];
  };
}
