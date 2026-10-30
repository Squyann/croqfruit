// Passer commande exige un compte : on renvoie vers la connexion, puis on revient ici.
// Préremplit le nom et l'email du client connecté.
Auth.subscribe((user) => {
  if (!user) {
    window.location.replace('connexion.html?redirect=commande.html');
    return;
  }

  document.querySelectorAll('[data-user-email]').forEach((el) => {
    el.value = user.email;
  });
  document.querySelectorAll('[data-user-fullname-input]').forEach((el) => {
    el.value = user.user_metadata?.full_name || '';
  });
  document.body.classList.remove('is-checking');
});
