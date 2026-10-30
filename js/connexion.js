const loginForm = document.getElementById('login-form');
const loginError = document.querySelector('[data-error]');

// Page où renvoyer l'utilisateur après connexion (?redirect=commande.html).
// Seuls les noms de pages à la racine du site sont acceptés (jamais d'URL externe).
function redirectTarget() {
  const target = new URLSearchParams(window.location.search).get('redirect');
  return target && /^[\w-]+\.html$/.test(target) ? target : 'compte.html';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const { error } = await Auth.signIn(loginForm.email.value.trim(), loginForm.password.value);
  submitBtn.disabled = false;

  if (error) {
    loginError.textContent = translateAuthError(error);
    loginError.hidden = false;
  }
});

// Déjà connecté (ou connexion réussie) : on quitte la page.
Auth.subscribe((user) => {
  if (user) window.location.replace(redirectTarget());
});
