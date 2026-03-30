import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { jsonHeaders } from '../../utils/headers.js';

type RecommendationRequest = {
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type LambdaProxyLikeResponse = {
  statusCode?: number;
  body?: string;
};

type WeatherMetadataEnvelope = {
  data?: {
    psi?: { data?: { psiTwentyFourHourly?: number } };
    uv?: { data?: { value?: number } };
  };
  psi?: { data?: { psiTwentyFourHourly?: number } };
  uv?: { data?: { value?: number } };
};

const getLambdaClient = (event: APIGatewayProxyEvent): LambdaClient => {
  const host = (event.headers.host ?? event.headers.Host ?? '').toLowerCase();
  const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');

  if (isLocalHost) {
    return new LambdaClient({
      region: 'localhost',
      endpoint: 'http://localhost:3003',
      credentials: {
        accessKeyId: 'MockAccessKeyId',
        secretAccessKey: 'MockSecretAccessKey',
      },
    });
  }

  return new LambdaClient({
    region: process.env.AWS_REGION ?? 'ap-southeast-1',
  });
};

const WEATHER_METADATA_FUNCTION_NAME =
  process.env.WEATHER_METADATA_FUNCTION_NAME ?? '';
const WEATHER_2HR_FUNCTION_NAME = process.env.WEATHER_2HR_FUNCTION_NAME ?? '';
const CARPARK_FUNCTION_NAME = process.env.CARPARK_FUNCTION_NAME ?? '';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

const decodePayload = (payload: Uint8Array | undefined): string => {
  if (!payload) {
    return '{}';
  }
  return new TextDecoder().decode(payload);
};

const invokeLambda = async (
  lambdaClient: LambdaClient,
  functionName: string,
  payload: Record<string, unknown>,
): Promise<unknown> => {
  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );

  if (response.FunctionError) {
    throw new Error(
      `Invocation failed for ${functionName}: ${response.FunctionError}`,
    );
  }

  const parsed = JSON.parse(
    decodePayload(response.Payload),
  ) as LambdaProxyLikeResponse;
  const statusCode = parsed.statusCode ?? 500;

  if (statusCode >= 400) {
    throw new Error(
      `Invocation returned ${statusCode} for ${functionName}: ${parsed.body ?? ''}`,
    );
  }

  return parsed.body ? (JSON.parse(parsed.body) as unknown) : {};
};

const getCoordinatesFromPostalCode = async (
  postalCode: string,
): Promise<Coordinates | null> => {
  if (!GOOGLE_MAPS_API_KEY) {
    return null;
  }

  const endpoint = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  endpoint.searchParams.set('address', postalCode);
  endpoint.searchParams.set('region', 'sg');
  endpoint.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Geocode API returned ${response.status}`);
  }

  const body = (await response.json()) as {
    results?: Array<{
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
    status?: string;
  };

  const first = body.results?.[0]?.geometry?.location;
  if (!first?.lat || !first?.lng) {
    return null;
  }

  return { latitude: first.lat, longitude: first.lng };
};

const scoreWeather = (forecastText: string): number => {
  const text = forecastText.toLowerCase();

  if (text.includes('thunder') || text.includes('storm')) return 0.1;
  if (text.includes('rain') || text.includes('showers')) return 0.35;
  if (text.includes('cloudy') || text.includes('overcast')) return 0.8;
  if (text.includes('fair') || text.includes('sunny')) return 0.9;

  return 0.55;
};

const scorePsi = (psi: number | undefined): number => {
  if (psi == null) {
    return 0.55;
  }

  if (psi <= 50) return 0.95;
  if (psi <= 100) return 0.75;
  if (psi <= 200) return 0.4;
  if (psi <= 300) return 0.2;
  return 0.1;
};

const scoreUv = (uv: number | undefined): number => {
  if (uv == null) {
    return 0.55;
  }

  if (uv <= 2) return 0.95;
  if (uv <= 5) return 0.8;
  if (uv <= 7) return 0.6;
  if (uv <= 10) return 0.35;
  return 0.15;
};

const scoreParking = (
  parking: Array<{ total_lots?: number; lots_available?: number }>,
): {
  score: number;
  occupancyScore: number;
  emptyLotsAbsolute: number;
  emptyLotsScore: number;
} => {
  if (parking.length === 0) {
    return {
      score: 0.2,
      occupancyScore: 0.2,
      emptyLotsAbsolute: 0,
      emptyLotsScore: 0.2,
    };
  }

  const totals = parking.reduce(
    (acc, item) => {
      const totalLots = Math.max(0, item.total_lots ?? 0);
      const availableLots = Math.max(0, item.lots_available ?? 0);

      return {
        totalLots: acc.totalLots + totalLots,
        availableLots: acc.availableLots + availableLots,
      };
    },
    { totalLots: 0, availableLots: 0 },
  );

  if (totals.totalLots <= 0) {
    return {
      score: 0.2,
      occupancyScore: 0.2,
      emptyLotsAbsolute: totals.availableLots,
      emptyLotsScore: 0.2,
    };
  }

  const occupancyScore = Math.min(1, totals.availableLots / totals.totalLots);
  const emptyLotsAbsolute = totals.availableLots;
  const emptyLotsScore = emptyLotsAbsolute / (emptyLotsAbsolute + 100);

  return {
    score: occupancyScore * 0.7 + emptyLotsScore * 0.3,
    occupancyScore,
    emptyLotsAbsolute,
    emptyLotsScore,
  };
};

const toRecommendation = (score: number): 'GO' | 'MAYBE' | 'NO_GO' => {
  if (score >= 0.67) {
    return 'GO';
  }
  if (score >= 0.45) {
    return 'MAYBE';
  }
  return 'NO_GO';
};

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const lambdaClient = getLambdaClient(event);

    const body = event.body
      ? (JSON.parse(event.body) as RecommendationRequest)
      : ({} as RecommendationRequest);

    let latitude = body.latitude;
    let longitude = body.longitude;

    if ((latitude == null || longitude == null) && body.postalCode) {
      const coordinates = await getCoordinatesFromPostalCode(body.postalCode);
      if (coordinates) {
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
      }
    }

    if (latitude == null || longitude == null) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({
          error: 'Provide latitude/longitude or a geocodable postal code',
        }),
      };
    }

    const lambdaEvent = {
      queryStringParameters: {
        latitude: String(latitude),
        longitude: String(longitude),
      },
    };

    const [weatherMetadataRaw, twoHrRaw, parkingRaw] = await Promise.all([
      invokeLambda(lambdaClient, WEATHER_METADATA_FUNCTION_NAME, lambdaEvent),
      invokeLambda(lambdaClient, WEATHER_2HR_FUNCTION_NAME, lambdaEvent),
      invokeLambda(lambdaClient, CARPARK_FUNCTION_NAME, lambdaEvent),
    ]);

    const weatherMetadata = weatherMetadataRaw as WeatherMetadataEnvelope;

    const twoHr = twoHrRaw as {
      data: {
        forecast?: string;
        area?: string;
        timestamp?: string;
      };
    };
    const parking = parkingRaw as {
      parking?: Array<{ total_lots?: number; lots_available?: number }>;
    };

    const weatherScore = scoreWeather(twoHr.data.forecast ?? '');
    const {
      score: parkingScore,
      occupancyScore: parkingOccupancyScore,
      emptyLotsAbsolute: parkingEmptyLotsAbsolute,
      emptyLotsScore: parkingEmptyLotsScore,
    } = scoreParking(parking.parking ?? []);
    const psiValue =
      weatherMetadata.psi?.data?.psiTwentyFourHourly ??
      weatherMetadata.data?.psi?.data?.psiTwentyFourHourly;
    const uvValue =
      weatherMetadata.uv?.data?.value ?? weatherMetadata.data?.uv?.data?.value;
    const psiScore = scorePsi(psiValue);
    const uvScore = scoreUv(uvValue);

    const weights = {
      weather: 0.3,
      parking: 0.4,
      psi: 0.25,
      uv: 0.05,
    };

    const weightTotal =
      weights.weather + weights.parking + weights.psi + weights.uv;

    const rawCompositeScore =
      weatherScore * weights.weather +
      parkingScore * weights.parking +
      psiScore * weights.psi +
      uvScore * weights.uv;

    const normalizedCompositeScore =
      weightTotal > 0 ? rawCompositeScore / weightTotal : 0;

    const compositeScore = Math.max(0, Math.min(1, normalizedCompositeScore));
    const recommendation = toRecommendation(compositeScore);

    const summary =
      recommendation === 'GO'
        ? 'Conditions are acceptable overall. It is a good time to go.'
        : recommendation === 'MAYBE'
          ? 'Conditions are mixed. You may want to go with caution.'
          : 'Current conditions are not favorable. Consider postponing your trip.';

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        location: {
          postalCode: body.postalCode,
          latitude,
          longitude,
        },
        score: Number(compositeScore.toFixed(3)),
        recommendation,
        summary,
        weights,
        factors: {
          weatherScore,
          parkingScore,
          parkingOccupancyScore,
          parkingEmptyLotsAbsolute,
          parkingEmptyLotsScore,
          psiScore,
          uvScore,
          psiValue,
          uvValue,
        },
        details: {
          weatherMetadata,
          weather2hr: twoHr,
          parking,
        },
      }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Failed to derive recommendation',
        message,
      }),
    };
  }
};
