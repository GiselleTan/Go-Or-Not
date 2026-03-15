import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { jsonHeaders } from '../../utils/headers.js';
import {
  getTemperatureByLocation,
  StationNotFoundError,
} from '../../services/temperature/index.js';

const isOffline = process.env.IS_OFFLINE === 'true';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { latitude, longitude } = event.queryStringParameters ?? {};

  const lat = parseFloat(latitude ?? '');
  const lon = parseFloat(longitude ?? '');

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Missing or invalid latitude/longitude' }),
    };
  }

  try {
    const temperature = await getTemperatureByLocation(lat, lon);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(temperature),
    };
  } catch (err: unknown) {
    if (err instanceof StationNotFoundError) {
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ error: err.message }),
      };
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: isOffline ? message : undefined,
      }),
    };
  }
};
