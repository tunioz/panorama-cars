# Car Rental – Full Stack Demo

This repository contains a design-driven car rental app:

- Static frontend (HTML/CSS/JS) with admin UI
- Backend API (Express + Prisma)
- SQLite database for local development (committed for convenience)

## Quick start

Frontend:

```bash
# from project root
python3 -m http.server 5174
# open http://localhost:5174
```

Backend (SQLite):

```bash
cd server
npm i
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
# API on http://localhost:5175
```

Dev conveniences:

```bash
# start frontend (5174)
npm run dev:frontend
# start api (SQLite on 5175)
npm run dev:api
# backup to git with timestamp tag
npm run backup:git
```

## Features

- Search page with dynamic filters
- Booking wizard (steps)
- Admin Panel: Cars, Params, Settings (Locations), Company Info (for invoicing)
- REST API: cars, params, locations, reservations, invoices, dashboard

## Notes

- The SQLite database file `server/dev.db` is intentionally committed to preserve state.
- Environment: `server/.env` is minimal (no secrets) and can be changed if needed.


