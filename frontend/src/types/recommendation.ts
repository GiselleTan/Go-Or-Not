export type RecommendationTier = 'GO' | 'MAYBE' | 'NO_GO';

export type RecommendationResponse = {
  recommendation: RecommendationTier;
  summary: string;
  score: number;
  factors: {
    weatherConditionScore: number;
    weatherScore: number;
    temperatureValue?: number;
    temperatureBaseline: number;
    temperatureScore: number;
    singaporeHour: number;
    singaporeMonthIndex: number;
    parkingOccupancyScore: number;
    parkingEmptyLotsAbsolute: number;
    parkingEmptyLotsScore: number;
    parkingScore: number;
    psiValue?: number;
    psiScore: number;
    uvValue?: number;
    uvScore: number;
  };
  details: {
    parking: {
      total_lots: number;
      lots_available: number;
    }[];
    weatherMetadata: {
      data?: {
        temperature?: {
          data: { temperature: number };
        };
        psi?: {
          data: {
            psiTwentyFourHourly?: number;
            pm25TwentyFourHourly?: number;
          };
        };
        uv?: {
          data: {
            value: number;
          };
        };
      };
      temperature: {
        data: { temperature: number };
      };
      psi: {
        data: {
          psiTwentyFourHourly?: number;
          pm25TwentyFourHourly?: number;
        };
      };
      uv: {
        data: {
          value: number;
        };
      };
    };
  };
};
