# Car Rental API (Express + Prisma + MySQL)

Run with modern stable stacks (Node 20+, MySQL 8.4 LTS).

## Quick start

1) Start MySQL (with Docker):

```bash
cd server
docker compose up -d
```

MySQL: localhost:3306 (user: `user`, password: `password`, db: `car_rental`).
Adminer UI: http://localhost:8080

2) Configure environment:

```bash
cp env.example .env
# (Edit .env if needed)
```

3) Install dependencies and prepare DB:

```bash
npm i
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```

4) Start API:

```bash
npm run dev
# API on http://localhost:5175
```

Now open the frontend at http://localhost:5174 — it will fetch `/api/cars` and post reservations to the API if available.

## Auth

- POST `/auth/login` with `{ email, password }` (seed user: `admin@demo.local` / `admin1234`) — returns JWT.
- For admin-only endpoints send `Authorization: Bearer <token>`.

## Key endpoints

- `GET /api/cars` / `GET /api/cars/:id` / `POST|PUT|DELETE /api/cars` (admin)
- `GET /api/params` / `POST|PUT|DELETE /api/params` (admin)
- `GET /api/reservations` (auth) / `POST /api/reservations` (public)
- `PATCH /api/reservations/:id/status` (auth)
- `POST /api/invoices/:reservationId/issue` (auth)
- `GET /api/dashboard/metrics` (auth)

## Logs

Write operations produce entries in the `Log` table (action + meta).


