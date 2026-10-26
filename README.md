# LostLink

> **Lost, found, back to you.**
> A campus lost-and-found web app for Chitkara University, Rajpura Campus.

Evaluation 2 version: the original HTML/CSS/JS frontend now talks to a **Node.js + Express** API backed by **MongoDB**.

## Run it locally

Full walkthrough with troubleshooting: [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

Requires Node.js 18 or newer and MongoDB (local or MongoDB Atlas).

```bash
npm install
cp .env.example .env     # optional - configure MONGODB_URI
npm start
```

Open <http://localhost:3000>.

On first start the app initializes collections in MongoDB, an admin account, and demo reports.

| Account | Email | Password |
| --- | --- | --- |
| Admin | `admin@chitkara.edu` | `admin123` (change via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`) |
| Student | any `@chitkara.edu` or `@chitkara.edu.in` email | the sign-in page creates the account on first use |

To try the full workflow with two people, use two browsers (or one normal and one private window):
student A reports a **found** item, student B reports a **lost** item at the same location, then B claims it and the admin approves it.

## What was added

- **Express API** (`server/`): auth, items, claims, matches, notifications, map and admin routes.
- **MongoDB** (`mongoose`): users, items, claims, matches and notifications schemas and models.
- **Authentication**: Firebase Authentication (Google Sign-In + Email/Password) bridged with local MongoDB session cookies.
- **Validation** of every submitted field on the server.
- **Rule-based matching** (no AI) in `server/matching.js`. A lost and a found report are scored out of 100:
  category 25, campus zone 25, colour 15, date proximity 15, description keywords 20.
  Scores of 50+ are stored as possible matches; 70+ also notify both owners. Thresholds and weights are easy to tune.
- **Email notifications** (Nodemailer) for strong matches, claim approvals and rejections. Without SMTP settings, emails are printed to the server console.
- **Live map**: Leaflet + OpenStreetMap Humanitarian, with zone-level markers (never exact positions). Zone coordinates are approximate and live in `server/config.js`.
- **Privacy**: private ownership details are never returned by public endpoints; only the report owner and admins can see them.

## Workflow

Sign in → submit lost/found report → Express validates and saves it in MongoDB → matching service compares it with opposite reports → matches are shown (and emailed if strong) → a user submits a claim on a found item → an admin reviews it → the database is updated and the claimant is emailed.

## Configuration (`.env`)

See `.env.example`. Secrets stay in `.env`, which is git-ignored. Set `MONGODB_URI` to connect to MongoDB, `JWT_SECRET` to keep users signed in across restarts, and `SMTP_*` values to send real email.

## Project layout

```
public/            frontend (HTML, CSS, JS) served by Express
server/
  index.js         app setup and routing
  config.js        env + campus zones, categories, colours
  db.js            MongoDB Mongoose models and connection
  matching.js      rule-based matching
  mailer.js        Nodemailer wrapper
  notify.js        in-app notification + email
  routes/          auth, items, claims (+ admin), misc (meta, map, notifications, matches)
```

## API summary

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register`, `/login`, `/logout`, `/firebase-login` · GET `/me` | cookie session |
| GET | `/api/items` | public active reports (`type`, `category`, `zone`, `q`) |
| POST | `/api/items` | sign-in required; returns the saved report and its matches |
| GET | `/api/items/:id`, `/:id/image`, `/:id/matches` | matches: owner or admin only |
| GET | `/api/items/mine`, `/api/items/returned` | |
| POST | `/api/items/:id/claims` | sign-in required |
| GET | `/api/notifications`, `/api/matches/mine`, `/api/map`, `/api/meta` | |
| GET/POST/DELETE | `/api/admin/overview`, `/claims`, `/claims/:id/decision`, `/items`, `/items/:id` | admin only |
