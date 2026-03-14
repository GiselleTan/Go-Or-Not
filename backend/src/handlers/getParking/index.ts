import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { jsonHeaders } from '../../utils/headers.js';
import { CarparkService } from '../../services/carpark/index.js';

const carparkService = new CarparkService();
const isOffline = process.env.IS_OFFLINE === 'true';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { latitude, longitude, radiusKm } = event.queryStringParameters ?? {};

  const lat = parseFloat(latitude!);
  const lon = parseFloat(longitude!);
  const radius = radiusKm ? parseFloat(radiusKm) : 1.0;

  if (isNaN(lat) || isNaN(lon)) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Missing or invalid latitude/longitude' }),
    };
  }

  try {
    const parking = await carparkService.getNearbyParking(lat, lon, radius);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ parking }),
    };
  } catch (err: any) {
    console.error('Error in getParking handler:', err);
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
