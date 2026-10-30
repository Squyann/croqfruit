const signupForm = document.getElementById('signup-form');
const signupError = document.querySelector('[data-error]');
const signupSuccess = document.querySelector('[data-success]');

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  signupError.hidden = true;
  signupSuccess.hidden = true;

  const submitBtn = signupForm.querySelector('button[type="submit"]');
  const fullName = signupForm.fullName.value.trim();
  const email = signupForm.email.value.trim();
  const password = signupForm.password.value;

  if (password !== signupForm.confirmPassword.value) {
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
});

// Une session est retournée tout de suite (ou l'utilisateur était déjà connecté).
Auth.subscribe((user) => {
  if (user) window.location.replace('compte.html');
});
