# CarHorizon Backend

Node.js + Express + PostgreSQL backend for the CarHorizon app.

## Endpoints


Base URL (local): http://localhost:4000/api

- POST /auth/register  { email, password }
- POST /auth/login     { email, password }
- POST /auth/google    { accessToken }   ← Google OAuth
- GET  /auth/me        (Authorization: Bearer <token>)

- POST /cars           { plate, model? }  (auth)
- GET  /cars/my        (auth)
- GET  /cars/:id       (auth)

- GET  /news

- POST /chats/open          { carId }          (auth)
- GET  /chats/inbox                           (auth)
- GET  /chats/:chatId/messages                (auth)
- POST /chats/:chatId/messages { text }       (auth)

## Local setup

1. Create a PostgreSQL database
2. Run the schema + seed:

   psql "$DATABASE_URL" -f sql/schema.sql
   psql "$DATABASE_URL" -f sql/seed.sql

3. Copy .env.example to .env and set:

   - DATABASE_URL=...
   - JWT_SECRET=some_secret
   - CLIENT_ORIGIN=http://localhost:19006  (or your Expo dev URL)

4. Install dependencies:

   npm install

5. Start dev server:

   npm run dev

The frontend should point to http://YOUR_IP:4000/api (for example: http://192.168.1.165:4000/api).
