// Formulaire de contact (contact.html) : enregistre le message en base ; l'administration
// le lit dans « Messages ». La base limite le volume (3 messages par email et par heure).
const contactForm = document.getElementById('contact-form');
const contactFields = contactForm.elements;
const contactError = contactForm.querySelector('[data-error]');
const contactDone = document.querySelector('[data-contact-done]');
let contactUserId = null;
let sending = false;

// Client connecté : nom et email préremplis, message rattaché à son compte.
Auth.subscribe((user) => {
  contactUserId = user?.id ?? null;
  if (!user) return;
  if (!contactFields.name.value) contactFields.name.value = user.user_metadata?.full_name || '';
  if (!contactFields.email.value) contactFields.email.value = user.email;
});

function showDone() {
  contactForm.hidden = true;
  contactDone.hidden = false;
  contactDone.scrollIntoView({ block: 'center' });
}

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending) return;
  contactError.hidden = true;

  // Seuls les robots remplissent le champ caché : on fait comme si tout allait bien, sans rien enregistrer.
  if (contactFields.website.value) return showDone();

  sending = true;
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const { error } = await supabaseClient.from('contact_messages').insert({
    user_id: contactUserId,
    name: contactFields.name.value.trim(),
    email: contactFields.email.value.trim(),
    subject: contactFields.subject.value,
    message: contactFields.message.value.trim(),
  });
  sending = false;
  submitBtn.disabled = false;

  if (error) {
    console.error("Envoi du message :", error);
    // P0001 = refus volontaire de la base (trop de messages), dont le texte est destiné au visiteur.
    contactError.textContent =
      error.code === 'P0001' ? error.message : "Le message n'a pas pu être envoyé. Réessayez dans un instant.";
    contactError.hidden = false;
    return;
  }
  contactForm.reset();
  showDone();
});
