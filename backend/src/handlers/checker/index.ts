import type { APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { dynamoDb } from '../../utils/dynamodb.js';
import { jsonHeaders } from '../../utils/headers.js';

type SubscriptionItem = {
  subscriptionKey: string;
  email: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  notifyAfterHours: 1 | 2 | 4 | 8 | 24;
  nextCheckAt: number;
};

const notificationsTable = process.env.NOTIFICATIONS_TABLE ?? '';
const senderEmail = process.env.SENDER_EMAIL ?? '';
const orchestratorFunctionName = process.env.ORCHESTRATOR_FUNCTION_NAME ?? '';

const sesClient = new SESClient({});
const lambdaClient = new LambdaClient({});

const decodePayload = (payload: Uint8Array | undefined): string => {
  if (!payload) {
    return '{}';
  }
  return new TextDecoder().decode(payload);
};

const invokeOrchestrator = async (item: SubscriptionItem): Promise<{
  recommendation?: string;
  summary?: string;
  score?: number;
}> => {
  const invokePayload = {
    body: JSON.stringify({
      postalCode: item.postalCode,
      latitude: item.latitude,
      longitude: item.longitude,
    }),
  };

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: orchestratorFunctionName,
      InvocationType: 'RequestResponse',
      Payload: new TextEncoder().encode(JSON.stringify(invokePayload)),
    }),
  );

  if (response.FunctionError) {
    throw new Error(`Orchestrator invocation failed: ${response.FunctionError}`);
  }

  const body = JSON.parse(decodePayload(response.Payload)) as {
    statusCode?: number;
    body?: string;
  };

  if ((body.statusCode ?? 500) >= 400) {
    throw new Error(`Orchestrator returned status ${body.statusCode ?? 500}`);
  }

  return body.body
    ? (JSON.parse(body.body) as {
        recommendation?: string;
        summary?: string;
        score?: number;
      })
    : {};
};

export const handler = async (): Promise<APIGatewayProxyResult> => {
  const nowEpoch = Math.floor(Date.now() / 1000);

  try {
    const dueResponse = await dynamoDb.send(
      new QueryCommand({
        TableName: notificationsTable,
        IndexName: 'status-nextCheckAt-index',
        KeyConditionExpression: '#status = :active AND nextCheckAt <= :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':active': 'ACTIVE',
          ':now': nowEpoch,
        },
      }),
    );

    const dueItems = (dueResponse.Items ?? []) as SubscriptionItem[];

    let notified = 0;
    const errors: Array<{ subscriptionKey: string; reason: string }> = [];

    for (const item of dueItems) {
      try {
        const latest = await invokeOrchestrator(item);

        if (senderEmail) {
          await sesClient.send(
            new SendEmailCommand({
              Source: senderEmail,
              Destination: { ToAddresses: [item.email] },
              Message: {
                Subject: { Data: 'Go-Or-Not update for your destination' },
                Body: {
                  Text: {
                    Data:
                      `Recommendation: ${latest.recommendation ?? 'N/A'}\n` +
                      `Score: ${latest.score ?? 'N/A'}\n` +
                      `Summary: ${latest.summary ?? 'N/A'}\n`,
                  },
                },
              },
            }),
          );
        }

        await dynamoDb.send(
          new UpdateCommand({
            TableName: notificationsTable,
            Key: { subscriptionKey: item.subscriptionKey },
            UpdateExpression:
              'SET #status = :status, updatedAt = :updatedAt REMOVE verificationToken',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'NOTIFIED',
              ':updatedAt': nowEpoch,
            },
          }),
        );

        notified += 1;
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ subscriptionKey: item.subscriptionKey, reason });
      }
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        processed: dueItems.length,
        notified,
        failed: errors.length,
        errors,
      }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Checker run failed', message }),
    };
  }
};
