import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getLatestForecast } from '../../services/2hrweather/weatherService.js';
import { jsonHeaders } from '../../utils/headers.js';

const isOffline = process.env.IS_OFFLINE === 'true';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { latitude, longitude } = event.queryStringParameters ?? {};

  const lat = parseFloat(latitude!);
  const lon = parseFloat(longitude!);

  if (isNaN(lat) || isNaN(lon)) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Missing or invalid latitude/longitude' }),
    };
  }

  try {
    const result = await getLatestForecast(lat, lon);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    console.error('Error in Weather handler:', err);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: isOffline ? err.message : undefined,
      }),
    };
  }
};
