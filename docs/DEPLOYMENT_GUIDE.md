# LostLink – Backend Deployment & Viva Guide (Evaluation 2)

Step-by-step guide to deploying your backend, testing APIs in Postman/Thunder Client, and answering viva questions.

---

## 1. Cloud Database Setup (MongoDB Atlas)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and sign in (or create a free account).
2. Create a **Free Shared Cluster (M0)**.
3. Under **Security -> Database Access**, create a database user:
   - Username: e.g. `lostlink_admin`
   - Password: e.g. `YourPassword123`
4. Under **Security -> Network Access**, click **Add IP Address**:
   - Select **Allow Access from Anywhere** (`0.0.0.0/0`) so your cloud deployment server can connect.
5. In your Cluster dashboard, click **Connect -> Drivers -> Node.js**:
   - Copy the connection string:
     ```
     mongodb+srv://lostlink_admin:<password>@cluster0.xxxxx.mongodb.net/lostlink?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your database user password.

---

## 2. Deploy Backend to Render (Free & Fast)

1. Go to [render.com](https://render.com) and sign in with your GitHub account (`garvitexe101`).
2. Click **New + -> Web Service**.
3. Select your repository: **`LL-eval2`** (or connect your GitHub repository).
4. Fill in the settings:
   - **Name:** `lostlink-backend`
   - **Region:** Singapore / Oregon (or closest)
   - **Branch:** `main`
   - **Root Directory:** leave empty (or set to project root)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Click **Advanced -> Add Environment Variable** and add:
   - `MONGODB_URI` = *your MongoDB Atlas connection string from Step 1*
   - `JWT_SECRET` = *any 32-character random string*
   - `ADMIN_EMAIL` = `admin@chitkara.edu`
   - `ADMIN_PASSWORD` = `admin123`
   - `SEED_DEMO_DATA` = `true`
   - `COOKIE_SECURE` = `true`
   - `FIREBASE_API_KEY` = *your Firebase API key*
   - `FIREBASE_PROJECT_ID` = `lostlink-2d44a`
   - `FIREBASE_AUTH_DOMAIN` = `lostlink-2d44a.firebaseapp.com`
   - `FIREBASE_STORAGE_BUCKET` = `lostlink-2d44a.firebasestorage.app`
   - `FIREBASE_MESSAGING_SENDER_ID` = `353433324211`
   - `FIREBASE_APP_ID` = `1:353433324211:web:2f8d889b2047dbf3acbec6`
   - *(Optional for Gmail emails)*:
     - `SMTP_HOST` = `smtp.gmail.com`
     - `SMTP_PORT` = `587`
     - `SMTP_USER` = `your_email@gmail.com`
     - `SMTP_PASS` = `your_gmail_app_password`
6. Click **Create Web Service**.
7. Render will build and deploy your app. When finished, you will receive your live URL:
   `https://lostlink-backend.onrender.com`

---

## 3. Frontend Integration (Requirement 5)

Once deployed, open [`frontend/js/config.js`](../frontend/js/config.js) and set your live URL:
```javascript
window.API_BASE_URL = 'https://lostlink-backend.onrender.com';
```
Now your frontend will send all API calls to your deployed cloud backend!

---

## 4. API Testing Demonstration (Requirement 4)

Your project includes a complete collection file: **`LostLink_API_Collection.json`**.

### Using VS Code Thunder Client:
1. Open VS Code and install the **Thunder Client** extension.
2. In the Thunder Client tab on the left, click **Collections -> Import**.
3. Select `LostLink_API_Collection.json` from the root of your project folder.
4. Set the `baseUrl` variable to your deployed URL (or `http://localhost:3000` for local testing).
5. Click **Send** on requests to demonstrate:
   - `POST /api/auth/login` (Admin Authentication)
   - `GET /api/items` (Active Reports List)
   - `POST /api/items` (Reporting Lost/Found Items)
   - `GET /api/items/:id/matches` (Rule-Based Matching Algorithm)
   - `GET /api/admin/overview` (Dashboard Metrics)

### Using Postman:
1. Open Postman.
2. Click **Import** (top left).
3. Drag and drop `LostLink_API_Collection.json`.
4. In the collection variables, set `baseUrl` to your deployed URL.
5. Execute requests sequentially during your viva presentation.

---

## 5. Viva Preparation: Questions & Answers

### Q1: Explain the MVC architecture implemented in your backend.
**Answer:**
- **Model (`backend/models/`):** Defined using Mongoose schemas for `User`, `Item`, `Claim`, `Match`, and `Notification`. Models encapsulate data validation, types, and database interaction.
- **View (`frontend/`):** The client-side user interface (HTML/CSS/JavaScript with Leaflet maps) that renders data received from the backend API.
- **Controller (`backend/controllers/`):** `authController`, `itemController`, `claimController`, and `miscController`. These process incoming HTTP requests, validate input, interact with models, and return appropriate JSON responses or status codes.
- **Routes (`backend/routes/`):** Map RESTful URL endpoints to their respective controller methods and attach authentication middleware.

### Q2: What is Middleware in Express, and how did you use it?
**Answer:**
Middleware functions in Express execute during the request-response lifecycle before reaching route handlers. In LostLink:
1. **`express.json({ limit: '4mb' })`**: Parses incoming JSON request payloads.
2. **`cookieParser()`**: Reads incoming HTTP-only cookies.
3. **`loadUser` (custom middleware)**: Verifies the JWT session token in `ll_token` cookie and attaches `req.user` to the request object.
4. **`requireAuth`**: Rejects unauthenticated requests with HTTP 401.
5. **`requireAdmin`**: Enforces role-based access control, ensuring only users with `role: 'admin'` can access administrative endpoints.
6. **CORS & Security Middleware**: Adds headers to protect against clickjacking, MIME sniffing, and allows cross-origin requests from the deployed frontend.

### Q3: How does your Rule-Based Matching Algorithm work?
**Answer:**
Located in `backend/services/matchingService.js` (and `backend/matching.js`):
Whenever a new lost or found item is submitted, it is scored against all active reports of the opposite type out of **100 points**:
- **Category Match:** 25 points
- **Campus Zone Match:** 25 points
- **Colour Match:** 15 points (supports smart free-text keywords)
- **Date Proximity:** 15 points (same day = 15, <=3 days = 10, <=7 days = 5)
- **Description Keywords:** 20 points (tokenizes name and description, excludes stop words, and scores shared keywords)

**Thresholds:**
- Scores **50+**: Stored as a "Possible match" in MongoDB and displayed on the user's dashboard.
- Scores **70+**: Flags a strong match and triggers an automated mutual HTML email (via Nodemailer) connecting both owners with report details.

### Q4: Why switch from SQLite to MongoDB?
**Answer:**
MongoDB is a scalable, document-oriented NoSQL database that natively stores structured JSON-like documents (BSON). It allows dynamic schemas, fast indexing, native geospatial queries, and clean integration with cloud-native deployments like MongoDB Atlas.
