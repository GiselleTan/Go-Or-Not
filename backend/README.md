# Go or Not backend

## Setup

**Prerequisites:** Docker installed and running

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Navigate to `http://localhost:3001/health`. You should see "Lambda is
   running"

This automatically:

- Starts DynamoDB Local (Docker)
- Creates tables from `serverless.yml`
- Starts API with hot reload on `http://localhost:3001`

## Infrastructure as Code Architecture

This backend is provisioned through `serverless.yml` and deploys a fully
serverless, event-driven flow on AWS:

- API Gateway + Lambda handlers for user-triggered requests
- Specialized Lambdas:
  - `getTemperature`
  - `getWeatherMetadata`
  - `get2hrWeather`
  - `getTrafficImages`
  - `getParking`
- Orchestrator Lambda:
  - `getRecommendation`
  - Invokes the specialized Lambdas and computes weighted `GO/NO_GO`
- Notification flow:
  - `subscribeNotification` stores pending subscriptions in DynamoDB and sends
    verification email via SES
  - `verifyNotification` activates subscription (double opt-in)
  - `checker` is invoked by EventBridge Scheduler every 15 minutes, evaluates
    due subscriptions, invokes orchestrator, and sends email updates via SES

### DynamoDB Tables

- `weather-metadata-cache-{stage}` (TTL)
- `weather-2hr-cache-{stage}` (TTL)
- `carpark-metadata-{stage}`
- `carpark-availability-cache-{stage}` (TTL)
- `notifications-{stage}` with GSI `status-nextCheckAt-index`

### API Endpoints

- `GET /health`
- `GET /temperature?latitude={lat}&longitude={lon}`
- `GET /weather-metadata?latitude={lat}&longitude={lon}&region={region?}`
- `GET /weather?latitude={lat}&longitude={lon}`
- `GET /traffic-images?latitude={lat}&longitude={lon}&radiusKm={radius?}`
- `GET /parking?latitude={lat}&longitude={lon}&radiusKm={radius?}`
- `POST /recommendation`
  - Body: `{ "postalCode?": "...", "latitude?": 1.3, "longitude?": 103.8 }`
- `POST /notifications/subscribe`
  - Body: `{ "email": "...", "postalCode": "...", "latitude": 1.3, "longitude": 103.8, "notifyAfterHours": 1|2|4|8|24 }`
- `GET /notifications/verify?subscriptionKey={key}&token={token}`

### Required Environment Variables for Cloud Deploy

- `SENDER_EMAIL`: Verified SES identity used to send verification/update emails
- `APP_BASE_URL`: Public frontend or API base URL used in verification links
- `GOOGLE_MAPS_API_KEY`: Optional, for postal code geocoding in orchestrator

## Adding a New Lambda Function

1. **Create handler file** in `src/handlers/`

2. **Add function to `serverless.yml`**

3. **Restart dev server** - Changes auto-reload!

## Adding a New DynamoDB Table

1. **Add table to `serverless.yml`** under `resources`

```yaml
resources:
  Resources:
    UsersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: users-${self:provider.stage}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - AttributeName: userId
            AttributeType: S
        KeySchema:
          - AttributeName: userId
            KeyType: HASH
```

2. **Add environment variable** in `provider.environment`

```yaml
environment:
  USERS_TABLE: users-${self:provider.stage}
```

3. **Restart dev server** - Table is auto-created locally
