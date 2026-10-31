// Pages de l'espace client : redirige vers la connexion si l'utilisateur n'est
// pas connecté, puis remplit les champs [data-user-name] et [data-user-email].
// (Simple confort d'affichage : la vraie protection des données vient des règles RLS.)
Auth.subscribe((user) => {
  if (!user) {
    window.location.replace(`connexion.html?redirect=${encodeURIComponent(pageForRedirect())}`);
    return;
  }

  const fullName = user.user_metadata?.full_name || '';
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = fullName;
  });
  document.querySelectorAll('[data-user-email]').forEach((el) => {
    if ('value' in el) el.value = user.email;
    else el.textContent = user.email;
  });
  document.querySelectorAll('[data-user-fullname-input]').forEach((el) => {
    el.value = fullName;
  });
  document.body.classList.remove('is-checking');

  // Éléments réservés aux comptes administrateur (ex. lien vers l'administration).
  Auth.getProfile().then((profile) => {
    document.querySelectorAll('[data-admin-only]').forEach((el) => {
      el.hidden = profile?.role !== 'admin';
    });
  });
});
