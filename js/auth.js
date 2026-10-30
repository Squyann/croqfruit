// État de connexion, partagé entre toutes les pages.
// `currentUser` vaut `undefined` tant que l'état initial n'est pas connu
// (on évite ainsi d'afficher "déconnecté" une fraction de seconde avant
// de savoir qu'une session existe déjà), puis `null` (déconnecté) ou l'objet
// utilisateur Supabase (connecté).
// Dépend de `ROOT` (js/layout.js) et de `supabaseClient` (js/supabase-client.js).
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

  try {
    const { data } = await supabaseClient.auth.getSession();
    currentUser = data.session?.user ?? null;
  } catch (error) {
    console.error('Impossible de lire la session :', error);
    currentUser = null;
  }
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

// Lien "Se connecter" / "Mon compte" de l'en-tête.
function renderAuthLinks(user) {
  document.querySelectorAll('[data-auth-link]').forEach((el) => {
    el.textContent = user ? 'Mon compte' : 'Se connecter';
    el.setAttribute('href', `${ROOT}${user ? 'compte.html' : 'connexion.html'}`);
  });
}

Auth.subscribe(renderAuthLinks);

// Tout élément [data-logout] déconnecte l'utilisateur.
document.addEventListener('click', async (event) => {
  if (!event.target.closest('[data-logout]')) return;
  await Auth.signOut();
  window.location.href = `${ROOT}index.html`;
});

const AUTH_ERROR_MESSAGES = {
  'Invalid login credentials': 'Email ou mot de passe incorrect.',
  'User already registered': 'Un compte existe déjà avec cette adresse email.',
  'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
  'Email not confirmed': 'Merci de confirmer votre adresse email avant de vous connecter (vérifiez vos emails).',
  'Unable to validate email address: invalid format': 'Adresse email invalide.',
  'email rate limit exceeded': 'Trop de demandes d’emails en peu de temps. Merci de réessayer dans un moment.',
};

function translateAuthError(error) {
  if (!error) return '';
  const known = AUTH_ERROR_MESSAGES[error.message];
  if (!known) console.error('Erreur Supabase Auth :', error.message);
  return known || 'Une erreur est survenue. Merci de réessayer.';
}

initAuth();
