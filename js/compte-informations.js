// Changement de mot de passe (compte-informations.html).
const passwordForm = document.getElementById('password-form');
const passwordError = passwordForm.querySelector('[data-error]');
const passwordSuccess = passwordForm.querySelector('[data-success]');

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  passwordError.hidden = true;
  passwordSuccess.hidden = true;

  const { password, confirmPassword } = passwordForm;
  if (password.value !== confirmPassword.value) {
    passwordError.textContent = 'Les mots de passe ne correspondent pas.';
    passwordError.hidden = false;
    return;
  }

  const submitBtn = passwordForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const { error } = await Auth.updatePassword(password.value);
  submitBtn.disabled = false;

  if (error) {
    passwordError.textContent = translateAuthError(error);
    passwordError.hidden = false;
    return;
  }
  passwordForm.reset();
  passwordSuccess.textContent = 'Mot de passe modifié.';
  passwordSuccess.hidden = false;
});
