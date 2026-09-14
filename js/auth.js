// État de connexion, partagé entre toutes les pages.
// `currentUser` vaut `undefined` tant que l'état initial n'est pas connu
// (on évite ainsi d'afficher "déconnecté" une fraction de seconde avant
// de savoir qu'une session existe déjà), puis `null` (déconnecté) ou l'objet
// utilisateur Supabase (connecté).
let currentUser = undefined;
const authListeners = [];

function notifyAuthListeners() {
  authListeners.forEach((listen) => listen(currentUser));
}

async function initAuth() {
  if (!supabaseClient) {
    currentUser = null;
    notifyAuthListeners();
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session?.user ?? null;
  notifyAuthListeners();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    notifyAuthListeners();
  });
}

const Auth = {
  getUser() {
    return currentUser;
  },
  subscribe(listen) {
    authListeners.push(listen);
    if (currentUser !== undefined) listen(currentUser);
  },
  async signUp(email, password, fullName) {
    return supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
  },
  async signIn(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
  },
  async signOut() {
    return supabaseClient.auth.signOut();
  },
};

function renderAuthLinks(user) {
  document.querySelectorAll('[data-auth-link]').forEach((el) => {
    el.textContent = user ? 'Mon compte' : 'Se connecter';
  });
}

Auth.subscribe(renderAuthLinks);

const AUTH_ERROR_MESSAGES = {
  'Invalid login credentials': 'Email ou mot de passe incorrect.',
  'User already registered': 'Un compte existe déjà avec cette adresse email.',
  'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
  'Email not confirmed': 'Merci de confirmer votre adresse email avant de vous connecter (vérifiez vos emails).',
  'Unable to validate email address: invalid format': 'Adresse email invalide.',
};

function translateAuthError(error) {
  if (!error) return '';
  const known = AUTH_ERROR_MESSAGES[error.message];
  if (!known) console.error('Erreur Supabase Auth :', error.message);
  return known || 'Une erreur est survenue. Merci de réessayer.';
}

initAuth();
