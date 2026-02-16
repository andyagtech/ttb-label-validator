# TTB Label Validator — Backend (Lambda Proxy)

AWS Lambda function that proxies requests to OpenRouter for vision-model OCR on label images.

## Architecture

```
Browser → Lambda Function URL → OpenRouter (vision model)
                                    ↓
                              Structured JSON fields
                              (brand, ABV, class/type, etc.)
```

The Lambda keeps the OpenRouter API key server-side. The frontend calls the Lambda directly via its Function URL (CORS-enabled).

## Routes

| Method | Path          | Description                                          |
|--------|---------------|------------------------------------------------------|
| GET    | `/health`     | Health check                                         |
| POST   | `/openrouter` | Generic OpenRouter proxy (model + messages)          |
| POST   | `/ocr`        | Label OCR — sends image to vision model, returns structured fields |

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Create the Lambda

```bash
aws lambda create-function \
  --function-name ttb-ocr-proxy \
  --runtime nodejs20.x \
  --handler dist/index.handler \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-basic-role \
  --timeout 30 \
  --memory-size 256 \
  --profile personal
```

### 3. Add a Function URL

```bash
aws lambda create-function-url-config \
  --function-name ttb-ocr-proxy \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["http://localhost:3000", "https://ttb-demo-pipeline.vercel.app"],
    "AllowMethods": ["POST", "GET", "OPTIONS"],
    "AllowHeaders": ["Content-Type"]
  }' \
  --profile personal
```

### 4. Set environment variables

```bash
aws lambda update-function-configuration \
  --function-name ttb-ocr-proxy \
  --environment 'Variables={OPENROUTER_API_KEY=sk-or-your-key-here,OPENROUTER_MODEL=anthropic/claude-3.5-sonnet}' \
  --profile personal
```

### 5. Build & deploy

```bash
npm run deploy
```

This runs `tsc`, zips the output, and updates the Lambda code using `--profile personal`.

### 6. Configure the frontend

Set `NEXT_PUBLIC_LAMBDA_URL` in the frontend's `.env.local` (or Vercel env vars) to the Lambda Function URL:

```
NEXT_PUBLIC_LAMBDA_URL=https://abc123.lambda-url.us-west-2.on.aws
```

## Local Development

For local dev without the Lambda, the frontend has a fallback Next.js API route at `/api/ocr`. Set these in `frontend/.env.local`:

```
OCR_ENABLED=true
OPENROUTER_API_KEY=sk-or-your-key
```
