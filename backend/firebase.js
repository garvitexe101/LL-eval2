const fs = require('fs');
const path = require('path');
const https = require('https');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const config = require('./config');

let adminInitialized = false;
let googleCertsCache = null;
let googleCertsExpiry = 0;

function initFirebaseAdmin() {
  if (adminInitialized) return true;

  try {
    const { serviceAccountPath, clientEmail, privateKey, projectId } = config.firebase;

    // Option 1: Path to serviceAccount.json
    if (serviceAccountPath) {
      const fullPath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.join(__dirname, '..', serviceAccountPath);

      if (fs.existsSync(fullPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        });
        adminInitialized = true;
        console.log('Firebase Admin SDK initialized using service account file.');
        return true;
      }
    }

    // Option 2: Environment variables
    if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId || undefined,
          clientEmail,
          privateKey,
        }),
        projectId: projectId || undefined,
      });
      adminInitialized = true;
      console.log('Firebase Admin SDK initialized using credentials from .env.');
      return true;
    }

    // Option 3: Initialize with Project ID only (for environments where default credentials exist)
    if (projectId) {
      try {
        admin.initializeApp({ projectId });
        adminInitialized = true;
        console.log(`Firebase Admin initialized with projectId: ${projectId}`);
        return true;
      } catch (err) {
        // Will fall back to public key verification
      }
    }
  } catch (err) {
    console.warn('Firebase Admin SDK initialization note:', err.message);
  }

  return adminInitialized;
}

// Fetch Google public certificates for public key token verification
function fetchGooglePublicCerts() {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    if (googleCertsCache && now < googleCertsExpiry) {
      return resolve(googleCertsCache);
    }

    https
      .get('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const certs = JSON.parse(data);
            googleCertsCache = certs;
            // Parse Cache-Control header if present
            const cc = res.headers['cache-control'] || '';
            const match = cc.match(/max-age=(\d+)/);
            const maxAge = match ? parseInt(match[1], 10) : 3600;
            googleCertsExpiry = Date.now() + maxAge * 1000;
            resolve(certs);
          } catch (e) {
            reject(new Error('Failed to parse Google public certificates.'));
          }
        });
      })
      .on('error', reject);
  });
}

// Fallback verification using Google's public certs when service account file is not provided
async function verifyWithGoogleCerts(idToken) {
  const projectId = config.firebase.projectId;
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID is not configured in .env.');
  }

  const decodedHeader = jwt.decode(idToken, { complete: true });
  if (!decodedHeader || !decodedHeader.header || !decodedHeader.header.kid) {
    throw new Error('Invalid Firebase token header.');
  }

  const certs = await fetchGooglePublicCerts();
  const cert = certs[decodedHeader.header.kid];
  if (!cert) {
    throw new Error('Google signing certificate not found for token key id.');
  }

  const payload = jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  return {
    uid: payload.user_id || payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name || payload.display_name || (payload.email ? payload.email.split('@')[0] : 'Campus User'),
    picture: payload.picture,
  };
}

async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Firebase ID token is required.');
  }

  // Attempt using Firebase Admin SDK
  if (initFirebaseAdmin()) {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: decoded.email,
        email_verified: decoded.email_verified,
        name: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Campus User'),
        picture: decoded.picture,
      };
    } catch (err) {
      // If error is about service account not configured, try public certs verification
      if (!config.firebase.serviceAccountPath && !config.firebase.privateKey && config.firebase.projectId) {
        return await verifyWithGoogleCerts(idToken);
      }
      throw err;
    }
  }

  // Fallback to Google public certificates verification
  if (config.firebase.projectId) {
    return await verifyWithGoogleCerts(idToken);
  }

  throw new Error('Firebase is not configured on the server. Please set FIREBASE_PROJECT_ID in .env.');
}

function getClientConfig() {
  const fb = config.firebase;
  const isEnabled = Boolean(fb.apiKey && fb.projectId);
  return {
    enabled: isEnabled,
    apiKey: fb.apiKey,
    authDomain: fb.authDomain,
    projectId: fb.projectId,
    storageBucket: fb.storageBucket,
    messagingSenderId: fb.messagingSenderId,
    appId: fb.appId,
    restrictEmailDomain: Boolean(config.restrictEmailDomain),
  };
}

// Pre-attempt initialization
initFirebaseAdmin();

module.exports = {
  admin,
  verifyFirebaseIdToken,
  getClientConfig,
};
