import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { jsonHeaders } from '../../utils/headers.js';
import { getTrafficImages } from '../../services/trafficImages/index.js';
import { trafficCameraMapping } from '../../config/trafficCameraMapping.js';
import type { Highways } from '../../services/trafficImages/types.js';

const VALID_HIGHWAYS = Array.from(
  new Set(Object.values(trafficCameraMapping).map((info) => info.highway)),
) as readonly Highways[];

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { highway } = event.queryStringParameters ?? {};

  if (!highway) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Missing required query parameter: highway',
      }),
    };
  }

  const normalizedHighway = highway.toUpperCase() as Highways;

  if (!VALID_HIGHWAYS.includes(normalizedHighway)) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: `Invalid highway. Must be one of: ${VALID_HIGHWAYS.join(', ')}`,
      }),
    };
  }

  try {
    const trafficImages = await getTrafficImages(normalizedHighway);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ trafficImages }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
