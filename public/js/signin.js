/* Firebase + Local Authentication for LostLink */
const form = document.getElementById('studentLoginForm');
const nameInput = document.getElementById('studentName');
const emailInput = document.getElementById('studentEmail');
const passwordInput = document.getElementById('studentPassword');

const nameError = document.getElementById('nameError');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');

const togglePassword = document.getElementById('togglePassword');
const googleBtn = document.getElementById('googleSignInBtn');
const googleBtnText = document.getElementById('googleBtnText');

const tabSignIn = document.getElementById('tabSignIn');
const tabSignUp = document.getElementById('tabSignUp');
const submitBtn = form.querySelector('button[type="submit"]');

let authMode = 'signin'; // 'signin' or 'signup'
let firebaseApp = null;
let firebaseConfig = { enabled: false, restrictEmailDomain: false };

// Fetch Firebase client configuration from the server
const firebaseReady = (async function initFirebase() {
  try {
    firebaseConfig = await api('/auth/firebase-config');
    if (firebaseConfig.enabled && typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp({
          apiKey: firebaseConfig.apiKey,
          authDomain: firebaseConfig.authDomain,
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket,
          messagingSenderId: firebaseConfig.messagingSenderId,
          appId: firebaseConfig.appId,
        });
      } else {
        firebaseApp = firebase.app();
      }
    }
    return firebaseConfig;
  } catch (err) {
    console.warn('Firebase config could not be loaded:', err.message);
    return firebaseConfig;
  }
})();

function setMode(mode) {
  authMode = mode;
  if (mode === 'signup') {
    tabSignUp.classList.add('active');
    tabSignIn.classList.remove('active');
    submitBtn.innerHTML = 'Create account <b>→</b>';
  } else {
    tabSignIn.classList.add('active');
    tabSignUp.classList.remove('active');
    submitBtn.innerHTML = 'Sign in <b>→</b>';
  }
}

if (tabSignIn && tabSignUp) {
  tabSignIn.addEventListener('click', () => setMode('signin'));
  tabSignUp.addEventListener('click', () => setMode('signup'));
}

function showError(input, target, message) {
  input.classList.add('input-error');
  input.classList.remove('input-success');
  target.textContent = message;
  return false;
}

function showSuccess(input, target) {
  input.classList.remove('input-error');
  input.classList.add('input-success');
  target.textContent = '';
  return true;
}

function validateName() {
  const name = nameInput.value.trim();
  if (authMode === 'signin' && !name) {
    // In sign-in mode, name is optional
    return true;
  }

  if (!name) {
    return showError(nameInput, nameError, 'Please enter your full name.');
  }

  if (name.length < 3) {
    return showError(nameInput, nameError, 'Name must contain at least 3 characters.');
  }

  if (!/^[a-zA-Z ]+$/.test(name)) {
    return showError(nameInput, nameError, 'Name can contain letters and spaces only.');
  }

  return showSuccess(nameInput, nameError);
}

function validateEmail() {
  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    return showError(emailInput, emailError, 'Please enter your email.');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return showError(emailInput, emailError, 'Enter a valid email address.');
  }

  if (firebaseConfig.restrictEmailDomain) {
    const validUniversityEmail =
      email.endsWith('@chitkara.edu') || email.endsWith('@chitkara.edu.in');
    if (!validUniversityEmail) {
      return showError(emailInput, emailError, 'Use your Chitkara University email.');
    }
  }

  return showSuccess(emailInput, emailError);
}

function validatePassword() {
  const password = passwordInput.value;

  if (!password) {
    return showError(passwordInput, passwordError, 'Please enter your password.');
  }

  if (password.length < 6) {
    return showError(passwordInput, passwordError, 'Password must contain at least 6 characters.');
  }

  return showSuccess(passwordInput, passwordError);
}

if (togglePassword) {
  togglePassword.addEventListener('click', () => {
    const hidden = passwordInput.type === 'password';
    passwordInput.type = hidden ? 'text' : 'password';
    togglePassword.textContent = hidden ? 'Hide' : 'Show';
  });
}

nameInput.addEventListener('blur', validateName);
emailInput.addEventListener('blur', validateEmail);
passwordInput.addEventListener('blur', validatePassword);

nameInput.addEventListener('input', () => {
  if (nameError.textContent) validateName();
});
emailInput.addEventListener('input', () => {
  if (emailError.textContent) validateEmail();
});
passwordInput.addEventListener('input', () => {
  if (passwordError.textContent) validatePassword();
});

// Google Sign-In handler
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    await firebaseReady;
    if (!firebaseConfig.enabled || typeof firebase === 'undefined') {
      toast('Firebase is not yet configured in .env. Please set FIREBASE_API_KEY and FIREBASE_PROJECT_ID.');
      return;
    }

    googleBtn.disabled = true;
    const originalText = googleBtnText.textContent;
    googleBtnText.textContent = 'Signing in with Google...';

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;
      const idToken = await user.getIdToken(true);

      // Verify and register/session on Express backend
      const res = await api('/auth/firebase-login', {
        method: 'POST',
        body: {
          idToken,
          name: user.displayName || user.email.split('@')[0],
        },
      });

      toast(`Welcome, ${res.user.name}!`);
      setTimeout(() => {
        location.href = safeNext() || 'profile.html';
      }, 700);
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        toast('Sign-in popup was closed.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        toast('Sign-in cancelled.');
      } else {
        toast(err.message || 'Google sign-in failed. Please try again.');
      }
      googleBtn.disabled = false;
      googleBtnText.textContent = originalText;
    }
  });
}

// Form submit (Firebase Email/Password with fallback to database auth)
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  await firebaseReady;

  const validName = validateName();
  const validEmail = validateEmail();
  const validPassword = validatePassword();

  if (!validEmail || !validPassword || (authMode === 'signup' && !validName)) {
    return;
  }

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const name = nameInput.value.trim();

  submitBtn.disabled = true;

  try {
    // If Firebase is configured, use Firebase Email/Password Auth
    if (firebaseConfig.enabled && typeof firebase !== 'undefined') {
      let idToken = null;
      let displayName = name;

      if (authMode === 'signup') {
        try {
          const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
          if (name && cred.user.updateProfile) {
            await cred.user.updateProfile({ displayName: name });
          }
          idToken = await cred.user.getIdToken(true);
        } catch (fbErr) {
          if (fbErr.code === 'auth/email-already-in-use') {
            toast('Account already exists for this email. Switching to Sign in.');
            setMode('signin');
            submitBtn.disabled = false;
            return;
          }
          throw fbErr;
        }
      } else {
        // Sign in mode
        try {
          const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
          displayName = cred.user.displayName || displayName;
          idToken = await cred.user.getIdToken(true);
        } catch (fbErr) {
          if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/invalid-credential') {
            toast('No matching account found. Try switching to "Create account".');
            submitBtn.disabled = false;
            return;
          }
          if (fbErr.code === 'auth/wrong-password') {
            toast('Incorrect password. Please try again.');
            submitBtn.disabled = false;
            return;
          }
          throw fbErr;
        }
      }

      // Sync user session with MongoDB database
      const r = await api('/auth/firebase-login', {
        method: 'POST',
        body: { idToken, name: displayName },
      });

      toast(`Signed in as ${r.user.name}`);
      setTimeout(() => {
        location.href = safeNext() || 'profile.html';
      }, 700);
      return;
    }

    // Fallback: Local database authentication if Firebase keys are not in .env yet
    try {
      await api('/auth/login', { method: 'POST', body: { email, password } });
    } catch (err) {
      if (err.code !== 'no_account' && authMode !== 'signup') throw err;

      // First visit / signup mode
      if (!name) {
        toast('Enter your full name to create an account.');
        setMode('signup');
        submitBtn.disabled = false;
        return;
      }
      await api('/auth/register', {
        method: 'POST',
        body: { name, email, password },
      });
    }

    toast('Signed in successfully.');
    setTimeout(() => {
      location.href = safeNext() || 'profile.html';
    }, 700);
  } catch (err) {
    toast(err.message || 'Sign in failed.');
    submitBtn.disabled = false;
  }
});
