// Page « Mes informations » : coordonnées, mot de passe, export des données (RGPD) et suppression du compte.
// Dépend de auth.js, utils.js et compte.js (garde de la page).

function showMessage(form, kind, text) {
  const error = form.querySelector('[data-error]');
  const success = form.querySelector('[data-success]');
  if (error) error.hidden = true;
  if (success) success.hidden = true;
  const target = kind === 'error' ? error : success;
  if (target && text) {
    target.textContent = text;
    target.hidden = false;
  }
}

// ---------- coordonnées ----------
const profileForm = document.getElementById('profile-form');
let profileLoaded = false;

Auth.subscribe(async (user) => {
  if (!user || profileLoaded) return;
  profileLoaded = true;
  const profile = await Auth.getProfile();
  profileForm.elements.fullName.value = profile?.full_name ?? user.user_metadata?.full_name ?? '';
  profileForm.elements.phone.value = profile?.phone ?? '';
});

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(profileForm, 'none');

  const fullName = profileForm.elements.fullName.value.trim();
  const phone = profileForm.elements.phone.value.trim();
  if (fullName.length < 2) {
    showMessage(profileForm, 'error', 'Indiquez votre nom complet.');
    return;
  }

  const submitBtn = profileForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const { error } = await Auth.updateProfile({ fullName, phone: phone || null });
  submitBtn.disabled = false;

  if (error) {
    console.error('Enregistrement des coordonnées :', error);
    showMessage(profileForm, 'error', "Vos coordonnées n'ont pas pu être enregistrées. Vérifiez le téléphone (chiffres, espaces, + ( ) . -) et réessayez.");
    return;
  }
  showMessage(profileForm, 'success', 'Coordonnées enregistrées.');
});

// ---------- mot de passe ----------
const passwordForm = document.getElementById('password-form');

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(passwordForm, 'none');

  const { password, confirmPassword } = passwordForm.elements;
  if (password.value !== confirmPassword.value) {
    showMessage(passwordForm, 'error', 'Les mots de passe ne correspondent pas.');
    return;
  }

  const submitBtn = passwordForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const { error } = await Auth.updatePassword(password.value);
  submitBtn.disabled = false;

  if (error) {
    showMessage(passwordForm, 'error', translateAuthError(error));
    return;
  }
  passwordForm.reset();
  showMessage(passwordForm, 'success', 'Mot de passe modifié.');
});

// ---------- export des données ----------
const exportBtn = document.getElementById('export-btn');
const exportError = document.querySelector('[data-export-error]');

exportBtn.addEventListener('click', async () => {
  exportError.hidden = true;
  exportBtn.disabled = true;
  const { data, error } = await supabaseClient.rpc('export_my_data');
  exportBtn.disabled = false;

  if (error) {
    console.error("Export des données :", error);
    exportError.textContent = "L'export n'a pas pu être généré. Réessayez dans un instant.";
    exportError.hidden = false;
    return;
  }

  // Fichier JSON généré dans le navigateur : rien n'est stocké ailleurs.
  const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `croqfruit-mes-donnees-${toIsoDay(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

// ---------- suppression du compte ----------
const deleteForm = document.getElementById('delete-form');
const deleteIntro = document.querySelector('[data-delete-intro]');
const deleteDone = document.querySelector('[data-delete-done]');

function closeDeleteForm() {
  deleteForm.hidden = true;
  deleteForm.reset();
  showMessage(deleteForm, 'none');
  deleteIntro.hidden = false;
}

document.getElementById('delete-open').addEventListener('click', () => {
  deleteIntro.hidden = true;
  deleteForm.hidden = false;
  deleteForm.elements.password.focus();
});
document.getElementById('delete-cancel').addEventListener('click', closeDeleteForm);

deleteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(deleteForm, 'none');

  const submitBtn = deleteForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  // On redemande le mot de passe : une session laissée ouverte ne suffit pas à supprimer le compte.
  const { error: passwordError } = await Auth.signIn(Auth.getUser().email, deleteForm.elements.password.value);
  if (passwordError) {
    submitBtn.disabled = false;
    showMessage(
      deleteForm,
      'error',
      passwordError.message === 'Invalid login credentials' ? 'Mot de passe incorrect.' : translateAuthError(passwordError)
    );
    return;
  }

  const { error } = await supabaseClient.rpc('delete_my_account');
  if (error) {
    console.error('Suppression du compte :', error);
    submitBtn.disabled = false;
    // P0001 = refus volontaire de la base (commande en cours…), dont le message est destiné au client.
    showMessage(
      deleteForm,
      'error',
      error.code === 'P0001' ? error.message : "Le compte n'a pas pu être supprimé. Réessayez dans un instant."
    );
    return;
  }

  // Le compte n'existe plus : on ferme la session locale. compte.js ne doit pas rediriger vers la connexion.
  window.accountDeleted = true;
  await Auth.signOut();
  deleteForm.hidden = true;
  deleteDone.hidden = false;
});
