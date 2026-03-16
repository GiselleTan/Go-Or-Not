import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// use managed DynamoDB endpoint in AWS Lambda, otherwise connect to local DynamoDB when running offline
const isRunningInAwsLambda = Boolean(process.env.LAMBDA_TASK_ROOT);
const isLocal = !isRunningInAwsLambda && process.env.IS_OFFLINE === 'true';

const client = new DynamoDBClient(
  isLocal
    ? {
        region: 'localhost',
        endpoint: 'http://localhost:8000',
        credentials: {
          accessKeyId: 'MockAccessKeyId',
          secretAccessKey: 'MockSecretAccessKey',
        },
      }
    : { region: process.env.AWS_REGION ?? 'ap-southeast-1' },
);

export const dynamoDb = DynamoDBDocumentClient.from(client);

export const TABLE_NAME = process.env.TABLE_NAME || 'go-or-not-dev';
export const CACHE_TABLE = process.env.CACHE_TABLE || 'cache-dev';
export const WEATHER_2HR_CACHE_TABLE = process.env.WEATHER_CACHE_TABLE!;
export const CARPARK_CACHE_TABLE = process.env.CARPARK_CACHE_TABLE!;
