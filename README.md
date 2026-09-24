Multi-Courier Integration Platform

A scalable backend platform that provides a unified REST API for integrating multiple courier partners.

The platform hides courier-specific API formats from consumers and provides a common interface for:

- Creating shipments
- Tracking shipments
- Cancelling shipments
- Bulk shipment creation
- Courier-specific request/response mapping
- Retry and error handling
- Shipment persistence
- Tracking history
- Asynchronous bulk processing

Technology Stack

- Node.js
- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- Redis
- BullMQ
- Axios
- Jest
- Docker / Docker Compose

Architecture

Client
  |
  v
REST API
  |
  v
Orders Service
  |
  v
Courier Registry
  |
  +----------------------+
  |                      |
  v                      v
UrbaneBolt Adapter    Mock Courier Adapter
  |
  +-- Mapper
  |
  +-- API Client
  |
  v
UrbaneBolt API

For bulk requests:

Client
  |
  v
POST /api/v1/orders/bulk
  |
  v
Create Batch
  |
  v
Redis / BullMQ
  |
  +---- Job 1 ----> Courier Adapter
  |
  +---- Job 2 ----> Courier Adapter
  |
  +---- Job 3 ----> Courier Adapter
  |
  ...
  |
  v
Batch Status

Features

1. Unified Courier API

Consumers send a common order format and specify the courier using:

{
  "courier_partner": "urbanebolt"
}

Consumers do not need to know the courier-specific API format.

2. Supported Couriers

Current integrations:

- "urbanebolt"
- "mock"

The mock courier is available for development and testing without calling an external courier service.

The architecture allows additional courier partners to be added independently.

3. Create Order

POST /api/v1/orders

Example:

{
  "order_id": "UB-DEMO-1003",
  "courier_partner": "urbanebolt",
  "pickup": {
    "name": "Demo Seller",
    "phone": "9876543210",
    "email": "seller@example.com",
    "address": "MG Road Bengaluru Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "country": "India",
    "pincode": "560001"
  },
  "delivery": {
    "name": "Demo Customer",
    "phone": "9876543211",
    "email": "customer@example.com",
    "address": "Indiranagar Bengaluru Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "country": "India",
    "pincode": "560038"
  },
  "package": {
    "weight": 1.5,
    "length": 10,
    "width": 10,
    "height": 10,
    "pieces": 1,
    "item_description": "Electronic Item"
  },
  "payment": {
    "type": "PREPAID",
    "amount": 1500
  },
  "invoice": {
    "number": "INV-1003",
    "date": "2026-09-24",
    "value": 1500
  }
}

Example response:

{
  "success": true,
  "data": {
    "order_id": "UB-DEMO-1003",
    "courier_partner": "urbanebolt",
    "courier_order_id": "UB-DEMO-1003",
    "awb_number": "200000007933",
    "status": "CREATED"
  },
  "request_id": "ub-test-003"
}

Track Order

GET /api/v1/orders/{order_id}/track

Example:

GET /api/v1/orders/UB-DEMO-1003/track

The platform:

1. Loads the order from PostgreSQL.
2. Identifies the courier partner.
3. Gets the courier adapter from the registry.
4. Calls the courier tracking API.
5. Normalizes the status.
6. Updates the current order status.
7. Adds a tracking history record.

Cancel Order

POST /api/v1/orders/{order_id}/cancel

The platform uses the stored courier shipment/AWB information and invokes the appropriate courier adapter.

Bulk Orders

POST /api/v1/orders/bulk

A maximum of 100 orders can be submitted in one request.

Example:

{
  "orders": [
    {
      "order_id": "BULK-001",
      "courier_partner": "mock",
      "pickup": {},
      "delivery": {},
      "package": {},
      "payment": {},
      "invoice": {}
    },
    {
      "order_id": "BULK-002",
      "courier_partner": "urbanebolt",
      "pickup": {},
      "delivery": {},
      "package": {},
      "payment": {},
      "invoice": {}
    }
  ]
}

Bulk processing uses:

POST /orders/bulk
        |
        v
Create Batch
        |
        v
BullMQ
        |
        +---- Job
        +---- Job
        +---- Job
        |
        v
Courier Adapter

Jobs are processed asynchronously with controlled concurrency.

Current worker concurrency:

5 concurrent jobs

This prevents a large bulk request from blocking the HTTP request or overwhelming the courier API.

Batch Status

GET /api/v1/batches/{batch_id}

The batch contains:

- Total orders
- Successful orders
- Failed orders
- Processing status
- Individual job status

Possible batch statuses:

PROCESSING
COMPLETED
PARTIALLY_COMPLETED
FAILED

Idempotency

"order_id" is unique in the database.

Order.orderId UNIQUE

If the same order is submitted again, the existing order can be returned instead of creating another courier shipment.

This protects against duplicate shipment creation caused by client retries.

Persistence

Order

The platform stores:

- Internal order ID
- Courier partner
- Courier order/shipment ID
- AWB number
- Current status
- Courier request payload
- Courier response payload
- Created timestamp
- Updated timestamp

Tracking History

Every tracking update is stored separately.

It contains:

- Order reference
- Status
- Raw courier payload
- Event timestamp
- Created timestamp

The tracking history provides an audit trail of shipment status changes.

Batch

Stores:

- Batch ID
- Batch status
- Total orders
- Successful orders
- Failed orders
- Timestamps

BatchJob

Stores:

- Batch ID
- Order ID
- Job status
- Error code
- Error message
- Timestamps

Shipment Status

The platform normalizes courier-specific statuses into:

CREATED
PICKED_UP
IN_TRANSIT
OUT_FOR_DELIVERY
DELIVERED
CANCELLED
FAILED

Courier-specific status values are mapped by the corresponding adapter.

Error Handling

The platform uses normalized courier errors.

Validation Error

Invalid requests are rejected with HTTP "400".

NestJS validation is configured using:

ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
})

Unknown Courier

If an unsupported courier is requested, the platform rejects the request and does not call an unknown integration.

Courier 4xx

Courier client errors are normalized and raw courier error details are not directly exposed to API consumers.

Courier 5xx

Temporary courier failures are classified as retryable.

Timeout

Courier requests use an HTTP timeout.

Timeouts are normalized into a courier timeout error.

Network Error

Connection failures are normalized into a network error.

Authentication Failure

If a courier API returns an authentication failure:

1. Existing token is invalidated.
2. Authentication is performed again.
3. The original request is retried once.

Retry

Retryable failures include:

SERVER_ERROR
TIMEOUT
NETWORK_ERROR

Exponential backoff is used for retryable failures.

Logging and Request Correlation

The API supports:

X-Request-Id

The request ID can be used to correlate API activity with logs and downstream operations.

Relevant operational information includes:

- Request ID
- Order ID
- Courier partner
- Error type
- Error details
- Stack trace where appropriate

Configuration

Environment-specific configuration is loaded from ".env".

Example:

PORT=3000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/courier_platform

REDIS_HOST=localhost
REDIS_PORT=6379

Courier credentials should be supplied through environment variables or a secret manager in production.

Do not commit real credentials to source control.

Database

PostgreSQL is used for transactional order data.

Main entities:

Order
TrackingHistory
Batch
BatchJob

Relationships:

Order
 |
 +---- TrackingHistory

Batch
 |
 +---- BatchJob

Local Setup

Prerequisites

Install:

- Node.js
- npm
- Docker
- Docker Compose

Install Dependencies

npm install

Start PostgreSQL and Redis

docker compose up -d

Verify:

docker ps

Configure Environment

Create:

.env

Example:

PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/courier_platform
REDIS_HOST=localhost
REDIS_PORT=6379

Configure courier credentials separately.

Generate Prisma Client

npx prisma generate

Run Database Migration

npx prisma migrate dev --name init

Start Application

Development:

npm run start:dev

Production:

npm run build
npm run start:prod

Application:

http://localhost:3000

API base path:

http://localhost:3000/api/v1

API Endpoints

Method| Endpoint| Description
POST| "/api/v1/orders"| Create shipment
GET| "/api/v1/orders/{order_id}"| Get order
GET| "/api/v1/orders/{order_id}/track"| Track shipment
POST| "/api/v1/orders/{order_id}/cancel"| Cancel shipment
POST| "/api/v1/orders/bulk"| Create bulk shipments
GET| "/api/v1/batches/{batch_id}"| Get batch status

Testing

Run unit tests:

npm test

Run tests in watch mode:

npm run test:watch

Run coverage:

npm run test:cov

Project Structure

multi-courier-platform/
├── src/
│   ├── common/
│   ├── config/
│   ├── couriers/
│   │   ├── courier.interface.ts
│   │   ├── courier.registry.ts
│   │   ├── courier.error.ts
│   │   ├── courier-retry.service.ts
│   │   ├── mock-courier.adapter.ts
│   │   └── urbanebolt/
│   │       ├── urbanebolt.client.ts
│   │       ├── urbanebolt.mapper.ts
│   │       └── urbanebolt.adapter.ts
│   ├── orders/
│   │   ├── dto/
│   │   ├── orders.controller.ts
│   │   ├── batch.controller.ts
│   │   ├── orders.service.ts
│   │   ├── orders.queue.ts
│   │   └── bulk-order.processor.ts
│   └── prisma/
│       ├── prisma.module.ts
│       └── prisma.service.ts
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── .env
├── .env.example
├── DESIGN.md
└── README.md

Adding a New Courier

A new courier can be integrated by implementing:

CourierAdapter

The adapter provides:

authenticate()
createShipment()
trackShipment()
cancelShipment()

The courier-specific implementation should contain:

- API client
- Authentication
- Request mapper
- Response mapper
- Courier-specific error handling

The existing Orders Controller, DTOs and business workflow do not need to know courier-specific details.

Design Principles

The implementation follows:

- Separation of concerns
- Dependency inversion
- Adapter pattern
- Registry pattern
- Courier abstraction
- Asynchronous processing
- Idempotency
- Transactional persistence
- Retry with backoff
- Configuration-driven integration
- Auditability

Assignment Requirements Coverage

Requirement| Implementation
Unified REST API| Orders Controller
Courier abstraction| "CourierAdapter"
Pluggable couriers| Courier Registry
UrbaneBolt integration| UrbaneBolt Adapter
Persistence| PostgreSQL + Prisma
Tracking history| "TrackingHistory"
Bulk up to 100| "BulkOrdersDto"
Async bulk processing| BullMQ
Concurrent processing| BullMQ worker concurrency
Idempotency| Unique "order_id"
Retry| Retry service / BullMQ retry
Auth retry| UrbaneBolt Client
Validation| NestJS ValidationPipe
Error normalization| "CourierError"
Config| Environment variables
Second courier| Mock Courier Adapter

Production Considerations

For production deployment, the following should be added or strengthened:

- Secret manager for courier credentials
- Structured logging
- Distributed tracing
- Metrics and monitoring
- Dead-letter queue
- Circuit breaker
- API authentication/authorization
- Rate limiting
- Database connection pooling
- Health/readiness endpoints
- Alerting
- Encryption and security hardening

License

This project is created as a technical assignment/demo implementation.
