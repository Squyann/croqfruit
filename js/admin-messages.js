// Boîte de réception des messages du formulaire de contact (admin).
// Ouvrir un message nouveau le marque comme lu ; la réponse part de la messagerie de l'admin (lien mailto).
const MESSAGES_LIMIT = 200;
let messages = [];
const openIds = new Set();

const listEl = document.getElementById('message-list');
const searchInput = document.getElementById('message-search');
const statusSelect = document.getElementById('message-status');

function renderMessage(m) {
  const subject = CONTACT_SUBJECTS[m.subject] ?? m.subject;
  const status = MESSAGE_STATUSES[m.status] ?? { label: m.status, badge: '' };
  const reply = `mailto:${escapeHtml(m.email)}?subject=${encodeURIComponent(`Re : ${subject}`)}`;

  return `
    <li>
      <details class="message${m.status === 'new' ? ' is-new' : ''}" data-id="${escapeHtml(m.id)}"${openIds.has(m.id) ? ' open' : ''}>
        <summary>
          <span class="message-from"><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(m.email)}</small></span>
          <span class="message-subject">${escapeHtml(subject)}</span>
          <span class="message-date">${formatDateTime(m.created_at)}</span>
          <span class="badge ${status.badge}">${status.label}</span>
        </summary>
        <div class="message-body">
          <p class="message-text">${escapeHtml(m.message)}</p>
          <div class="row-actions">
            <a class="btn btn-primary btn-sm" href="${reply}">Répondre par email</a>
            ${m.status === 'done' ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-action="status" data-status="done">Marquer comme traité</button>'}
            ${m.status === 'new' ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-action="status" data-status="new">Marquer comme non lu</button>'}
            <button type="button" class="btn btn-ghost btn-sm" data-action="delete">Supprimer</button>
          </div>
        </div>
      </details>
    </li>`;
}

function renderMessages() {
  const q = searchInput.value.trim().toLowerCase();
  const status = statusSelect.value;
  // Un message ouvert reste affiché même si son changement de statut ne correspond plus au filtre
  // (sinon un message « nouveau » disparaîtrait dès qu'on l'ouvre, car il est alors marqué lu).
  const rows = messages.filter(
    (m) =>
      (!status || m.status === status || openIds.has(m.id)) &&
      (!q || `${m.name} ${m.email} ${m.message}`.toLowerCase().includes(q))
  );

  if (rows.length === 0) {
    listEl.innerHTML = `<li class="state-message" style="padding-block:1.5rem">${
      messages.length ? 'Aucun message ne correspond aux filtres.' : 'Aucun message pour le moment.'
    }</li>`;
    return;
  }
  listEl.innerHTML = rows.map(renderMessage).join('');
}

async function setStatus(message, status) {
  setNotice('');
  const { data, error } = await supabaseClient.from('contact_messages').update({ status }).eq('id', message.id).select('id');
  if (error || !data?.length) {
    console.error('Mise à jour du message :', error);
    setNotice('La modification a échoué. Réessayez.', true);
    return false;
  }
  message.status = status;
  renderMessages();
  return true;
}

[searchInput, statusSelect].forEach((el) => el.addEventListener('input', renderMessages));

// Ouvrir un message nouveau le marque comme lu. (`toggle` ne remonte pas : écoute en phase de capture.)
listEl.addEventListener(
  'toggle',
  (event) => {
    const details = event.target;
    if (!details.matches?.('details.message')) return;
    const message = messages.find((m) => m.id === details.dataset.id);
    if (details.open) {
      // Un message déjà ouvert que l'on réaffiche (changement de statut) ne doit pas être re-marqué comme lu.
      const alreadyOpen = openIds.has(details.dataset.id);
      openIds.add(details.dataset.id);
      if (!alreadyOpen && message?.status === 'new') setStatus(message, 'read');
    } else {
      openIds.delete(details.dataset.id);
    }
  },
  true
);

listEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  const message = messages.find((m) => m.id === button?.closest('details')?.dataset.id);
  if (!message) return;

  button.disabled = true;
  if (button.dataset.action === 'status') {
    await setStatus(message, button.dataset.status);
    return;
  }

  if (!window.confirm(`Supprimer définitivement le message de ${message.name} ? Cette action est irréversible.`)) {
    button.disabled = false;
    return;
  }
  const { data, error } = await supabaseClient.from('contact_messages').delete().eq('id', message.id).select('id');
  if (error || !data?.length) {
    console.error('Suppression du message :', error);
    button.disabled = false;
    return setNotice('La suppression a échoué. Réessayez.', true);
  }
  messages = messages.filter((m) => m.id !== message.id);
  openIds.delete(message.id);
  renderMessages();
  setNotice('Message supprimé.');
});

adminReady.then(async () => {
  // Le tableau de bord renvoie ici avec ?status=new pour afficher d'emblée les nouveaux messages.
  const wanted = new URLSearchParams(window.location.search).get('status');
  if (wanted && MESSAGE_STATUSES[wanted]) statusSelect.value = wanted;

  const { data, error } = await supabaseClient
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MESSAGES_LIMIT);

  if (error) {
    console.error('Chargement des messages :', error);
    listEl.innerHTML = '<li class="state-message" style="padding-block:1.5rem">Impossible de charger les messages.</li>';
    return;
  }
  messages = data;
  renderMessages();
  if (messages.length === MESSAGES_LIMIT) {
    setNotice(`Seuls les ${MESSAGES_LIMIT} messages les plus récents sont affichés.`);
  }
});
