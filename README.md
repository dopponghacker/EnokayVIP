# EnokayTips

A paid-only football prediction landing page and authenticated admin dashboard,
built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and replace every placeholder value.
   `AUTH_SECRET` must be at least 32 characters. Generate a long, random value
   for production rather than reusing the example.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`. The admin dashboard is available at `/admin`
   and redirects unauthenticated visitors to `/login`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `AUTH_SECRET` | Signs eight-hour, HTTP-only admin session cookies |

The application refuses admin logins when any variable is missing or when
`AUTH_SECRET` is shorter than 32 characters.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Data storage

Prediction records, booking codes, and admin credentials use Netlify Database
through Drizzle ORM. The schema lives in `db/schema.ts`, and migrations in
`netlify/database/migrations/` are applied automatically during deploys.

The initial admin credential is created from `ADMIN_USERNAME` and
`ADMIN_PASSWORD` on the first login attempt. Later changes made in the admin
dashboard remain stored in the database.
