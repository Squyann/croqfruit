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

// Profil (nom, email, téléphone, rôle) de l'utilisateur connecté, lu une seule fois par page.
let profileCache = { userId: null, promise: null };

const Auth = {
  getUser() {
    return currentUser;
  },
  getProfile() {
    if (!currentUser || !supabaseClient) return Promise.resolve(null);
    if (profileCache.userId !== currentUser.id) {
      profileCache = {
        userId: currentUser.id,
        promise: supabaseClient
          .from('profiles')
          .select('full_name, email, phone, role')
          .eq('id', currentUser.id)
          .maybeSingle()
          .then(({ data }) => data ?? null, () => null),
      };
    }
    return profileCache.promise;
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
  async updatePassword(password) {
    return supabaseClient.auth.updateUser({ password });
  },
  // Enregistre le nom et le téléphone. Le nom est aussi copié dans les métadonnées du compte,
  // d'où les pages le lisent pour afficher « Bonjour … » ; renvoie { error } comme les autres méthodes.
  async updateProfile({ fullName, phone }) {
    const { data, error } = await supabaseClient
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', currentUser.id)
      .select('id');
    if (error || !data?.length) return { error: error ?? new Error('Aucune ligne modifiée') };

    profileCache = { userId: null, promise: null };
    return supabaseClient.auth.updateUser({ data: { full_name: fullName } });
  },
  // Envoie par email un lien vers reinitialiser-mot-de-passe.html. Cette adresse doit être autorisée dans
  // Supabase (Authentication > URL Configuration > Redirect URLs), sinon le lien ne ramène pas sur le site.
  async requestPasswordReset(email) {
    const redirectTo = new URL('reinitialiser-mot-de-passe.html', window.location.href).href;
    return supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
  },
  // Déconnecte les autres appareils (utile après une réinitialisation de mot de passe).
  async signOutOtherSessions() {
    return supabaseClient.auth.signOut({ scope: 'others' });
  },
};

// Page courante, à passer en `?redirect=` de la page de connexion. On conserve
// `?id=…` (fiches commande, édition de produit) ; tout autre paramètre est abandonné.
// Le motif accepté ici doit rester identique à celui de redirectTarget() (js/connexion.js).
function pageForRedirect(prefix = '') {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const id = /^\?id=[0-9a-f-]{36}$/i.test(window.location.search) ? window.location.search : '';
  return `${prefix}${page}${id}`;
}

// Lien "Se connecter" / "Mon compte" de l'en-tête.
function renderAuthLinks(user) {
  document.querySelectorAll('[data-auth-link]').forEach((el) => {
    el.textContent = user ? 'Mon compte' : 'Se connecter';
    el.setAttribute('href', `${ROOT}${user ? 'compte.html' : 'connexion.html'}`);
  });
}

Auth.subscribe(renderAuthLinks);

// Lien "Administration" de l'en-tête : visible uniquement pour un compte admin.
// (Simple confort : la vraie protection est dans les règles RLS de la base.)
Auth.subscribe(async (user) => {
  const profile = user ? await Auth.getProfile() : null;
  document.querySelectorAll('[data-admin-link]').forEach((el) => {
    el.hidden = profile?.role !== 'admin';
  });
});

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
  'New password should be different from the old password.': 'Le nouveau mot de passe doit être différent de l’ancien.',
  'email rate limit exceeded': 'Trop de demandes d’emails en peu de temps. Merci de réessayer dans un moment.',
  'Auth session missing!': 'Ce lien n’est plus valable. Demandez-en un nouveau.',
};

function translateAuthError(error) {
  if (!error) return '';
  // Supabase refuse une nouvelle demande d'email trop rapprochée : « … only request this after 52 seconds ».
  const wait = /after (\d+) seconds?/.exec(error.message ?? '');
  if (wait) return `Pour votre sécurité, merci de patienter ${wait[1]} secondes avant de refaire une demande.`;
  // Sans service d'envoi d'emails (SMTP) configuré, Supabase n'écrit qu'aux membres de l'équipe du projet.
  if (error.code === 'email_address_not_authorized') {
    return 'L’envoi d’emails n’est pas encore ouvert à cette adresse. Merci de nous contacter.';
  }
  const known = AUTH_ERROR_MESSAGES[error.message];
  if (!known) console.error('Erreur Supabase Auth :', error.message);
  return known || 'Une erreur est survenue. Merci de réessayer.';
}

initAuth();
