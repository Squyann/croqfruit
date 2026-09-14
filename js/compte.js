const loadingEl = document.getElementById('account-loading');
const guestEl = document.getElementById('account-guest');
const dashboardEl = document.getElementById('account-dashboard');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginError = document.querySelector('[data-login-error]');
const signupError = document.querySelector('[data-signup-error]');
const signupSuccess = document.querySelector('[data-signup-success]');

// ---------- bascule connexion / inscription ----------
document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    const target = tab.dataset.tab;
    loginForm.hidden = target !== 'login';
    signupForm.hidden = target !== 'signup';
    loginError.hidden = true;
    signupError.hidden = true;
    signupSuccess.hidden = true;
  });
});

// ---------- connexion ----------
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  submitBtn.disabled = true;
  const { error } = await Auth.signIn(email, password);
  submitBtn.disabled = false;

  if (error) {
    loginError.textContent = translateAuthError(error);
    loginError.hidden = false;
  } else {
    loginForm.reset();
  }
});

// ---------- inscription ----------
signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  signupError.hidden = true;
  signupSuccess.hidden = true;

  const submitBtn = signupForm.querySelector('button[type="submit"]');
  const fullName = signupForm.fullName.value.trim();
  const email = signupForm.email.value.trim();
  const password = signupForm.password.value;
  const confirmPassword = signupForm.confirmPassword.value;

  if (password !== confirmPassword) {
    signupError.textContent = 'Les mots de passe ne correspondent pas.';
    signupError.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  const { data, error } = await Auth.signUp(email, password, fullName);
  submitBtn.disabled = false;

  if (error) {
    signupError.textContent = translateAuthError(error);
    signupError.hidden = false;
    return;
  }

  if (!data.session) {
    // Confirmation par email activée sur le projet : pas encore connecté.
    signupSuccess.textContent = 'Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.';
    signupSuccess.hidden = false;
    signupForm.reset();
  }
  // Si une session est retournée immédiatement, l'écran bascule tout seul
  // sur le tableau de bord via Auth.subscribe ci-dessous.
});

// ---------- déconnexion ----------
document.getElementById('logout-btn').addEventListener('click', () => {
  Auth.signOut();
});

// ---------- affichage selon l'état de connexion ----------
Auth.subscribe((user) => {
  loadingEl.hidden = true;

  if (user) {
    guestEl.hidden = true;
    dashboardEl.hidden = false;
    const name = user.user_metadata?.full_name;
    document.getElementById('account-name').textContent = name ? `, ${name}` : '';
    document.getElementById('account-email').textContent = user.email;
  } else {
    dashboardEl.hidden = true;
    guestEl.hidden = false;
  }
});
