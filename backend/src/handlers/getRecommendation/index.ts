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

const lambdaClient = new LambdaClient({});

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
  if (text.includes('cloudy') || text.includes('overcast')) return 0.6;
  if (text.includes('fair') || text.includes('sunny')) return 0.9;

  return 0.55;
};

const scoreParking = (
  parking: Array<{ total_lots?: number; lots_available?: number }>,
): number => {
  if (parking.length === 0) {
    return 0.2;
  }

  const ratios = parking
    .map((item) => {
      const total = item.total_lots ?? 0;
      const available = item.lots_available ?? 0;
      if (total <= 0) {
        return 0;
      }
      return Math.min(1, available / total);
    })
    .sort((a, b) => b - a)
    .slice(0, 5);

  if (ratios.length === 0) {
    return 0.2;
  }

  const sum = ratios.reduce((acc, current) => acc + current, 0);
  return sum / ratios.length;
};

const toRecommendation = (score: number): 'GO' | 'NO_GO' =>
  score >= 0.6 ? 'GO' : 'NO_GO';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
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
      invokeLambda(WEATHER_METADATA_FUNCTION_NAME, lambdaEvent),
      invokeLambda(WEATHER_2HR_FUNCTION_NAME, lambdaEvent),
      invokeLambda(CARPARK_FUNCTION_NAME, lambdaEvent),
    ]);

    const weatherMetadata = weatherMetadataRaw as {
      temperature?: unknown;
      psi?: unknown;
      uv?: unknown;
    };

    const twoHr = twoHrRaw as {
      forecast?: string;
      area?: string;
      timestamp?: string;
    };
    const parking = parkingRaw as {
      parking?: Array<{ total_lots?: number; lots_available?: number }>;
    };

    const weatherScore = scoreWeather(twoHr.forecast ?? '');
    const parkingScore = scoreParking(parking.parking ?? []);

    const weights = {
      weather: 0.45,
      parking: 0.35,
      traffic: 0.2,
    };

    const compositeScore =
      weatherScore * weights.weather + parkingScore * weights.parking;

    const recommendation = toRecommendation(compositeScore);

    const summary =
      recommendation === 'GO'
        ? 'Conditions are acceptable overall. It is a good time to go.'
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
