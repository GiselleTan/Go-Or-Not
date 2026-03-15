import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb } from '../../utils/dynamodb.js';
import { jsonHeaders } from '../../utils/headers.js';

const notificationsTable = process.env.NOTIFICATIONS_TABLE ?? '';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const subscriptionKey = event.queryStringParameters?.subscriptionKey;
  const token = event.queryStringParameters?.token;

  if (!subscriptionKey || !token) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'subscriptionKey and token are required',
      }),
    };
  }

  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: notificationsTable,
        Key: { subscriptionKey },
      }),
    );

    const item = result.Item as
      | {
          verificationToken?: string;
          status?: string;
        }
      | undefined;

    if (!item) {
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Subscription not found' }),
      };
    }

    if (item.verificationToken !== token) {
      return {
        statusCode: 403,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Invalid verification token' }),
      };
    }

    if (item.status !== 'ACTIVE') {
      await dynamoDb.send(
        new UpdateCommand({
          TableName: notificationsTable,
          Key: { subscriptionKey },
          UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'ACTIVE',
            ':updatedAt': Math.floor(Date.now() / 1000),
          },
        }),
      );
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        subscriptionKey,
        status: 'ACTIVE',
        message: 'Subscription verified successfully',
      }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Failed to verify subscription', message }),
    };
  }
};
