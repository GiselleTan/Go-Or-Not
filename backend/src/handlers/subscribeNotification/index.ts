import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { createHash, randomUUID } from 'node:crypto';
import { dynamoDb } from '../../utils/dynamodb.js';
import { jsonHeaders } from '../../utils/headers.js';

type SubscribePayload = {
  email?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  notifyAfterHours?: 1 | 2 | 4 | 8 | 24;
};

const notificationsTable = process.env.NOTIFICATIONS_TABLE ?? '';
const senderEmail = process.env.SENDER_EMAIL ?? '';
const appBaseUrl = process.env.APP_BASE_URL ?? '';

const sesClient = new SESClient({});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedHours = new Set([1, 2, 4, 8, 24]);

const hashValue = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const payload = JSON.parse(event.body) as SubscribePayload;
    const email = payload.email?.trim().toLowerCase();
    const postalCode = payload.postalCode?.trim();
    const latitude = payload.latitude;
    const longitude = payload.longitude;
    const notifyAfterHours = payload.notifyAfterHours;

    if (!email || !emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'A valid email is required' }),
      };
    }

    if (latitude == null || longitude == null) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({
          error: 'latitude and longitude are required for subscriptions',
        }),
      };
    }

    if (!notifyAfterHours || !allowedHours.has(notifyAfterHours)) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'notifyAfterHours must be one of 1,2,4,8,24' }),
      };
    }

    const userAgent = event.headers['user-agent'] ?? 'anonymous';
    const locationKey = `${postalCode ?? ''}|${latitude}|${longitude}`;
    const locationHash = hashValue(locationKey).slice(0, 16);
    const subscriptionKey = hashValue(`${email}|${locationHash}|${userAgent}`);
    const verificationToken = randomUUID();

    const nowEpoch = Math.floor(Date.now() / 1000);
    const nextCheckAt = nowEpoch + notifyAfterHours * 3600;
    const ttl = nowEpoch + 30 * 24 * 3600;

    await dynamoDb.send(
      new PutCommand({
        TableName: notificationsTable,
        Item: {
          subscriptionKey,
          status: 'PENDING',
          verificationToken,
          email,
          postalCode,
          latitude,
          longitude,
          notifyAfterHours,
          nextCheckAt,
          createdAt: nowEpoch,
          updatedAt: nowEpoch,
          ttl,
        },
      }),
    );

    if (senderEmail && appBaseUrl) {
      const verifyUrl = new URL('/notifications/verify', appBaseUrl);
      verifyUrl.searchParams.set('subscriptionKey', subscriptionKey);
      verifyUrl.searchParams.set('token', verificationToken);

      await sesClient.send(
        new SendEmailCommand({
          Source: senderEmail,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: 'Confirm your Go-Or-Not notification subscription' },
            Body: {
              Text: {
                Data:
                  `Please verify your subscription by visiting: ${verifyUrl.toString()}\n\n` +
                  `If you did not request this, you can ignore this email.`,
              },
            },
          },
        }),
      );
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        subscriptionKey,
        status: 'PENDING',
        message:
          senderEmail && appBaseUrl
            ? 'Verification email sent. Please confirm to activate notifications.'
            : 'Subscription created in PENDING state. Configure SENDER_EMAIL and APP_BASE_URL to send verification links.',
      }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Failed to create subscription',
        message,
      }),
    };
  }
};
