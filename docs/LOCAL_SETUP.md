# LostLink – Local Setup Guide

How to run LostLink (Express + MongoDB backend and the HTML/CSS/JS frontend) on your own machine.

## 1. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | 18 or newer (20/22 LTS recommended) | `node -v` |
| npm | comes with Node | `npm -v` |
| MongoDB | Local MongoDB Community Server OR MongoDB Atlas (free cloud) | `mongosh --version` |
| Git | any recent | `git --version` |
| Internet | needed for `npm install`, map tiles and fonts | |

## 2. Get the code

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_NEW_REPOSITORY.git
cd YOUR_NEW_REPOSITORY
```

## 3. Install dependencies

```bash
npm install
```

## 4. Configure

```bash
cp .env.example .env      # Windows: copy .env.example .env
```

Then edit `.env`. The settings you are most likely to change:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string (local or MongoDB Atlas) | `mongodb://127.0.0.1:27017/lostlink` |
| `JWT_SECRET` | Signs login cookies. Set any long random string so users stay signed in after restarts | random each start |
| ADMIN_EMAIL / ADMIN_PASSWORD | Admin email and a unique password; password is created or rotated from this setting | admin@chitkara.edu.in / set privately in .env |
| `SEED_DEMO_DATA` | Add demo reports when collection is empty | `true` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Real email delivery | empty (emails print to the console) |
| `MATCH_MIN_SCORE` / `MATCH_STRONG_SCORE` | Match thresholds | `50` / `70` |

### Setting up MongoDB

- **Option A (MongoDB Atlas - Recommended & Free):**
  1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
  2. Create a database user and allow your IP address in Network Access (`0.0.0.0/0` for development).
  3. Copy your connection string and set in `.env`:
     ```
     MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/lostlink?retryWrites=true&w=majority
     ```

- **Option B (Local MongoDB):**
  Install MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community) and start the `mongod` service:
  ```
  MONGODB_URI=mongodb://127.0.0.1:27017/lostlink
  ```

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
Connected to MongoDB at mongodb://127.0.0.1:27017/lostlink
Created admin account: admin@chitkara.edu.in
Seeded demo reports.
LostLink running at http://localhost:3000
```

Open <http://localhost:3000>. Stop the server with `Ctrl + C`.

## 6. Try the full workflow

Use two browser sessions (a normal window and a private window) so you can act as two users.

1. **Student A** (window 1): go to *Sign in*, enter a name, a `@chitkara.edu.in` email and a password (6+ characters). The account is created on first use.
2. A: open **Report found item**, e.g. *Black Wallet*, category *Bags*, colour *Black*, location *Square One*, add a private detail, and submit.
3. **Student B** (window 2): sign in with a different email and **Report lost item** with similar details (same category and location, a similar date).
4. B's profile now shows a **Possible match**. A strong match (70+) also sends emails; check the terminal if SMTP is not set up.
5. B opens the found item from *Browse* or the *Campus map* and submits the ownership claim form.
6. **Admin**: open <http://localhost:3000/admin.html>, sign in with the configured admin email and private password, then review the claim and **Approve** or **Reject**.
7. B's profile shows the decision (and an email is sent or printed). An approved item moves to *Recently returned* on the home page.
