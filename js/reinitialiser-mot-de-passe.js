// Choix d'un nouveau mot de passe (reinitialiser-mot-de-passe.html), page ouverte depuis le lien reçu par email.
//
// Le lien ramène ici avec un jeton dans l'adresse (#access_token=…&type=recovery) que supabase-js transforme
// en session, puis efface de l'adresse. On lit donc l'adresse d'arrivée mémorisée par la page (window.recoveryUrl)
// plutôt que l'événement PASSWORD_RECOVERY, qui peut être émis avant que ce script soit chargé.
const resetForm = document.getElementById('reset-form');
const resetError = resetForm.querySelector('[data-error]');
const stateEls = document.querySelectorAll('[data-state]');

function showState(name) {
  stateEls.forEach((el) => {
    el.hidden = el.dataset.state !== name;
  });
}

async function start() {
  const params = new URLSearchParams((window.recoveryUrl?.hash ?? '').replace(/^#/, ''));
  const isRecoveryLink = params.get('type') === 'recovery' && params.has('access_token');
  if (!supabaseClient || !isRecoveryLink) {
    showState('invalid');
    return;
  }

  try {
    // Attend la fin de l'initialisation de supabase-js : le jeton du lien est alors devenu une session.
    const { data } = await supabaseClient.auth.getSession();
    showState(data.session ? 'form' : 'invalid');
  } catch (error) {
    console.error('Lecture de la session :', error);
    showState('invalid');
  }
}

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  resetError.hidden = true;

  const { password, confirmPassword } = resetForm.elements;
  if (password.value !== confirmPassword.value) {
    resetError.textContent = 'Les mots de passe ne correspondent pas.';
    resetError.hidden = false;
    return;
  }

  const submitBtn = resetForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const { error } = await Auth.updatePassword(password.value);
  submitBtn.disabled = false;

  if (error) {
    resetError.textContent = translateAuthError(error);
    resetError.hidden = false;
    return;
  }

  // Après une réinitialisation, on déconnecte les autres appareils au cas où le compte aurait été compromis.
  await Auth.signOutOtherSessions();
  resetForm.reset();
  showState('done');
});

start();
