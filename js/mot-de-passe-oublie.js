// Demande d'un lien de réinitialisation du mot de passe (mot-de-passe-oublie.html).
// Le message affiché est le même que le compte existe ou non : on ne révèle pas quelles adresses ont un compte.
const forgotForm = document.getElementById('forgot-form');
const forgotError = forgotForm.querySelector('[data-error]');
const forgotSent = document.querySelector('[data-sent]');

forgotForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  forgotError.hidden = true;

  const submitBtn = forgotForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const { error } = await Auth.requestPasswordReset(forgotForm.elements.email.value.trim());
  submitBtn.disabled = false;

  if (error) {
    forgotError.textContent = translateAuthError(error);
    forgotError.hidden = false;
    return;
  }
  forgotForm.hidden = true;
  forgotSent.hidden = false;
});
