# LostLink – Campus Lost & Found (Evaluation 2)

> **Lost, found, back to you.**
> A modern campus lost-and-found web application for Chitkara University, Rajpura Campus.

Evaluation 2 version follows the **MVC (Model-View-Controller)** pattern with a **Node.js + Express** backend, **MongoDB (Mongoose)** database, and an interactive **HTML/CSS/JS + Leaflet** frontend.

---

## Project Structure (Requirement 2 & 7)

```text
LostLink/
├── backend/                  <- Node.js & Express MVC Backend
│   ├── config/               <- Environment & MongoDB connection settings
│   │   ├── config.js
│   │   └── db.js
│   ├── models/               <- Mongoose Schemas & Models (Model in MVC)
│   │   ├── User.js
│   │   ├── Item.js
│   │   ├── Claim.js
│   │   ├── Match.js
│   │   └── Notification.js
│   ├── controllers/          <- Application Logic & Handlers (Controller in MVC)
│   │   ├── authController.js
│   │   ├── itemController.js
│   │   ├── claimController.js
│   │   └── miscController.js
│   ├── routes/               <- REST Endpoint Routing
│   │   ├── auth.js
│   │   ├── items.js
│   │   ├── claims.js
│   │   └── misc.js
│   ├── middleware/           <- JWT Auth & Security Middleware
│   ├── services/             <- Matching Engine & Nodemailer Service
│   ├── seed.js               <- Database Seeder (Admin & Demo Data)
│   └── server.js             <- Express Application Entry Point
├── frontend/                 <- Client-Side User Interface (View in MVC)
│   ├── css/                  <- Responsive Styles
│   ├── js/                   <- Frontend Logic & API Client
│   │   ├── config.js         <- Configurable Deployed API URL (Requirement 5)
│   │   ├── shared.js         <- Shared API Client & Session Helper
│   │   └── map.js            <- Leaflet Campus Map Controller
│   ├── vendor/               <- Local Leaflet Bundle (Offline-ready)
│   ├── index.html            <- Home Page
│   ├── browse.html           <- Browse Active Reports
│   ├── lost.html             <- Report Lost Item
│   ├── found.html            <- Report Found Item
│   ├── map.html              <- Campus Map
│   ├── item.html             <- Item Details & Claim Submission
│   ├── signin.html           <- Firebase & Local Authentication
│   ├── profile.html          <- My Reports & Matches
│   ├── admin.html            <- Admin Claim Review & Management
│   └── how-it-works.html     <- Student Workflow Guide
├── docs/
│   ├── DEPLOYMENT_GUIDE.md   <- Render & MongoDB Atlas Deployment + Viva Prep
│   └── LOCAL_SETUP.md        <- Local Development Guide
├── LostLink_API_Collection.json <- Postman & Thunder Client Collection (Requirement 4)
├── .env.example              <- Configuration Template (Secrets Ignored)
├── package.json              <- Dependencies & Scripts
└── README.md
```

---

## Quick Start (Local Setup)

Requires Node.js 18 or newer and MongoDB (local or MongoDB Atlas).

1. Install dependencies with npm install.
2. Copy .env.example to .env.
3. Set a unique ADMIN_PASSWORD and JWT_SECRET in .env before starting the server.
4. Keep .env private; it is excluded by .gitignore. For deployment, set secrets in your hosting provider instead.
5. Start the application with npm start.

Open http://localhost:3000 in your browser. The administrator email is configured by ADMIN_EMAIL; the password is the private value you set in ADMIN_PASSWORD. Students register with their own passwords.
## Evaluation 2 Requirements Checklist

| Requirement | Implementation Detail | Status |
| :--- | :--- | :---: |
| **1. Backend Development** | RESTful API built with Node.js and Express.js | **Complete** |
| **2. MVC Architecture** | Strict separation into `backend/models`, `backend/controllers`, `backend/routes`, and `frontend/` | **Complete** |
| **3. Backend Deployment** | Ready for 1-click deployment on Render.com ([Deployment Guide](docs/DEPLOYMENT_GUIDE.md)) | **Complete** |
| **4. API Testing** | Exported `LostLink_API_Collection.json` for Thunder Client & Postman | **Complete** |
| **5. Frontend Integration** | Configurable `window.API_BASE_URL` in `frontend/js/config.js` pointing to deployed backend | **Complete** |
| **6. GitHub Repository** | Publish only from a fresh sanitized repository without .env or old history | **Ready** |
| **7. Project Structure** | Both `frontend/` and `backend/` directories present in the same repository | **Complete** |

---

## API Testing (Requirement 4)

Import **`LostLink_API_Collection.json`** into Postman or VS Code Thunder Client:
- **`POST /api/auth/login`**: Sign in as administrator or student
- **`GET /api/items`**: Browse active lost and found reports with query filters
- **`POST /api/items`**: Submit a new lost/found report (triggers rule-based matching)
- **`GET /api/items/:id/matches`**: View potential matches (Category 25, Zone 25, Colour 15, Date 15, Text 20)
- **`POST /api/items/:id/claims`**: Submit an ownership claim on a found item
- **`GET /api/admin/overview`**: View dashboard metrics and pending claims
