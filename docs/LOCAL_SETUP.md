# LostLink – Local Setup Guide

How to run LostLink (Express + SQLite backend and the HTML/CSS/JS frontend) on your own machine.

## 1. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | 18 or newer (20/22 LTS recommended) | `node -v` |
| npm | comes with Node | `npm -v` |
| Git | any recent | `git --version` |
| Internet | needed for `npm install`, map tiles and fonts | |

No separate database install is needed. SQLite runs inside the app.

## 2. Get the code

```bash
git clone git@github.com:garvitexe101/LL.git
cd LL
git checkout feature/express-sqlite-backend   # until it is merged into main
```

## 3. Install dependencies

```bash
npm install
```

`better-sqlite3` downloads a prebuilt binary for your OS. If it has to compile instead, install build tools first:
- **macOS:** `xcode-select --install`
- **Windows:** install "Desktop development with C++" (Visual Studio Build Tools) and Python
- **Linux:** `sudo apt install build-essential python3`

## 4. Configure (optional)

The defaults work with no configuration. To customise:

```bash
cp .env.example .env      # Windows: copy .env.example .env
```

Then edit `.env`. The settings you are most likely to change:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | Signs login cookies. Set any long random string so users stay signed in after restarts | random each start |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin account created on first start | `admin@chitkara.edu` / `admin123` |
| `SEED_DEMO_DATA` | Add a few demo reports to an empty database | `true` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Real email delivery | empty (emails print to the console) |
| `MATCH_MIN_SCORE` / `MATCH_STRONG_SCORE` | Match thresholds | `50` / `70` |

The admin account is created only the first time. If you change `ADMIN_PASSWORD` later, delete `data/lostlink.db` to recreate it.

### Using Gmail for emails (optional)

1. Turn on 2-step verification for the Google account and create an **App password**.
2. Set in `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=you@gmail.com
   SMTP_PASS=<app password>
   MAIL_FROM=LostLink <you@gmail.com>
   ```

## 5. Start the app

```bash
npm start          # normal
npm run dev        # auto-restart on code changes (Node 18.11+)
```

You should see:

```
Seeded demo reports.
LostLink running at http://localhost:3000
```

Open <http://localhost:3000>. Stop the server with `Ctrl + C`.

## 6. Try the full workflow

Use two browser sessions (a normal window and a private window) so you can act as two users.

1. **Student A** (window 1): go to *Sign in*, enter a name, a `@chitkara.edu` email and a password (6+ characters). The account is created on first use.
2. A: open **Report found item**, e.g. *Black Wallet*, category *Bags*, colour *Black*, location *Square One*, add a private detail, and submit.
3. **Student B** (window 2): sign in with a different email and **Report lost item** with similar details (same category and location, a similar date).
4. B's profile now shows a **Possible match**. A strong match (70+) also sends emails; check the terminal if SMTP is not set up.
5. B opens the found item from *Browse* or the *Campus map* and submits the ownership claim form.
6. **Admin**: open <http://localhost:3000/admin.html>, sign in with `admin@chitkara.edu` / `admin123`, then review the claim and **Approve** or **Reject**.
7. B's profile shows the decision (and an email is sent or printed). An approved item moves to *Recently returned* on the home page.

Demo reports from the seed belong to a demo user, so a single account can already see matches for items like the AirPods case or the keys.

## 7. Reset the data

Stop the server, then:

```bash
rm -rf data        # Windows: rmdir /s /q data
npm start
```

A fresh database, admin account and demo reports are created.

## 8. Troubleshooting

| Problem | Fix |
| --- | --- |
| `Cannot find module ...` | Run `npm install` in the project root. |
| `better-sqlite3` install or build error | Use Node 18, 20 or 22 LTS and install the build tools from step 3, then `rm -rf node_modules && npm install`. |
| `EADDRINUSE: address already in use :::3000` | Another process uses the port. Stop it or set `PORT=3001` in `.env`. |
| Signed out after every restart | Set a fixed `JWT_SECRET` in `.env`. |
| "No account found for this email" | The sign-in page creates an account when you also fill in your full name. |
| "Use your Chitkara University email" | Only `@chitkara.edu` and `@chitkara.edu.in` addresses are accepted. |
| Map is blank | The map needs internet for Leaflet and OpenStreetMap tiles. The report list below it still works. |
| No emails arrive | Without `SMTP_*` settings they are printed in the terminal running the server. |
| `403`/"Administrator access required" on admin pages | Sign in with the admin account, not a student account. |

## 9. Useful files

| Path | What it is |
| --- | --- |
| `server/index.js` | Server entry point |
| `server/config.js` | Zones, categories, colours, environment settings |
| `server/matching.js` | Match scoring weights |
| `server/routes/` | API endpoints |
| `public/` | Frontend pages |
| `data/lostlink.db` | SQLite database (created on first run, git-ignored) |
