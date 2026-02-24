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
