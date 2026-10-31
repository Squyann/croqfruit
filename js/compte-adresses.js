// Carnet d'adresses du client connecté (compte-adresses.html). La base garantit que chacun
// ne voit que les siennes, 10 adresses au maximum, une seule adresse par défaut (la première
// adresse enregistrée l'est d'office).
let addresses = [];
let editingId = null;
let userId = null;

const listEl = document.getElementById('address-list');
const form = document.getElementById('address-form');
const fields = form.elements;
const formTitle = document.querySelector('[data-form-title]');
const submitBtn = form.querySelector('button[type="submit"]');
const cancelBtn = form.querySelector('[data-cancel]');
const limitMsg = form.querySelector('[data-limit]');

function renderCard(address) {
  const isDefault = address.is_default;
  return `
    <li class="address-card${isDefault ? ' is-default' : ''}" data-id="${escapeHtml(address.id)}">
      <h3>${escapeHtml(address.label || 'Adresse')}${isDefault ? ' <span class="badge badge-ok">Par défaut</span>' : ''}</h3>
      <p>${escapeHtml(formatAddress(address))}</p>
      ${address.delivery_notes ? `<p>${escapeHtml(address.delivery_notes)}</p>` : ''}
      <div class="row-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit">Modifier</button>
        ${isDefault ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-action="default">Par défaut</button>'}
        <button type="button" class="btn btn-ghost btn-sm" data-action="delete">Supprimer</button>
      </div>
    </li>`;
}

function renderAddresses() {
  listEl.innerHTML =
    addresses.length === 0
      ? '<li class="state-message" style="padding-block:1.5rem;grid-column:1/-1"><strong>Aucune adresse enregistrée</strong>Ajoutez une adresse ci-dessous pour gagner du temps à la prochaine commande.</li>'
      : addresses.map(renderCard).join('');

  const full = addresses.length >= MAX_ADDRESSES && !editingId;
  limitMsg.hidden = !full;
  submitBtn.disabled = full;
}

async function loadAddresses() {
  const { data, error } = await supabaseClient
    .from('addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at');
  if (error) {
    console.error('Chargement des adresses :', error);
    listEl.innerHTML = '<li class="state-message" style="padding-block:1.5rem;grid-column:1/-1">Impossible de charger vos adresses.</li>';
    return;
  }
  addresses = data;
  renderAddresses();
}

// ---------- formulaire ----------

function resetForm() {
  editingId = null;
  form.reset();
  fields.isDefault.disabled = false;
  formTitle.textContent = 'Ajouter une adresse';
  submitBtn.textContent = "Ajouter l'adresse";
  cancelBtn.hidden = true;
  renderAddresses();
}

function startEdit(address) {
  editingId = address.id;
  fields.label.value = address.label ?? '';
  fields.street.value = address.address_line1;
  fields.street2.value = address.address_line2 ?? '';
  fields.postalCode.value = address.postal_code;
  fields.city.value = address.city;
  fields.notes.value = address.delivery_notes ?? '';
  // On ne retire pas le statut « par défaut » : il passe à une autre adresse quand on en choisit une.
  fields.isDefault.checked = address.is_default;
  fields.isDefault.disabled = address.is_default;
  formTitle.textContent = "Modifier l'adresse";
  submitBtn.textContent = 'Enregistrer';
  cancelBtn.hidden = false;
  renderAddresses();
  form.scrollIntoView({ block: 'center' });
  fields.label.focus();
}

fields.postalCode.addEventListener('input', () => {
  fields.postalCode.value = fields.postalCode.value.replace(/\D/g, '');
});
cancelBtn.addEventListener('click', resetForm);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setNotice('');

  const payload = {
    label: fields.label.value.trim() || null,
    address_line1: fields.street.value.trim(),
    address_line2: fields.street2.value.trim() || null,
    postal_code: fields.postalCode.value.trim(),
    city: fields.city.value.trim(),
    delivery_notes: fields.notes.value.trim() || null,
    is_default: fields.isDefault.checked,
  };

  submitBtn.disabled = true;
  const query = editingId
    ? supabaseClient.from('addresses').update(payload).eq('id', editingId)
    : supabaseClient.from('addresses').insert({ ...payload, user_id: userId });
  const { data, error } = await query.select('id');
  submitBtn.disabled = false;

  if (error || !data?.length) {
    console.error("Enregistrement de l'adresse :", error);
    // P0001 = refus volontaire de la base (limite de 10 adresses), message destiné au client.
    setNotice(error?.code === 'P0001' ? error.message : "L'adresse n'a pas pu être enregistrée. Réessayez.", true);
    return;
  }

  const wasEditing = Boolean(editingId);
  resetForm();
  await loadAddresses();
  setNotice(wasEditing ? 'Adresse modifiée.' : 'Adresse ajoutée.');
});

// ---------- actions sur les cartes ----------

listEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  const address = addresses.find((a) => a.id === button?.closest('[data-id]')?.dataset.id);
  if (!address) return;

  setNotice('');
  if (button.dataset.action === 'edit') {
    startEdit(address);
    return;
  }

  button.disabled = true;
  if (button.dataset.action === 'default') {
    const { data, error } = await supabaseClient.from('addresses').update({ is_default: true }).eq('id', address.id).select('id');
    if (error || !data?.length) {
      console.error("Changement d'adresse par défaut :", error);
      button.disabled = false;
      return setNotice('La modification a échoué. Réessayez.', true);
    }
    await loadAddresses();
    return setNotice('Adresse par défaut mise à jour.');
  }

  if (button.dataset.action === 'delete') {
    if (!window.confirm(`Supprimer l'adresse « ${address.label || address.address_line1} » ?`)) {
      button.disabled = false;
      return;
    }
    const { data, error } = await supabaseClient.from('addresses').delete().eq('id', address.id).select('id');
    if (error || !data?.length) {
      console.error("Suppression de l'adresse :", error);
      button.disabled = false;
      return setNotice('La suppression a échoué. Réessayez.', true);
    }
    if (editingId === address.id) resetForm();
    await loadAddresses();
    setNotice('Adresse supprimée.');
  }
});

Auth.subscribe((user) => {
  if (!user || userId) return;
  userId = user.id;
  loadAddresses();
});
