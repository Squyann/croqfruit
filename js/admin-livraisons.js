// Livraisons (admin) : tournées à venir, zones desservies (codes postaux, frais, minimum)
// et créneaux par jour de la semaine. Ces données alimentent la page « Livraison »
// et le choix du créneau à la commande.
let zones = [];
let slots = [];
let editingZoneId = null;
let editingSlotId = null;

const upcomingBody = document.getElementById('upcoming-body');
const zonesBody = document.getElementById('zones-body');
const slotsBody = document.getElementById('slots-body');
const zoneForm = document.getElementById('zone-form');
const slotForm = document.getElementById('slot-form');

// ---------- affichage ----------

function renderUpcoming(orders) {
  if (orders.length === 0) {
    upcomingBody.innerHTML = '<tr><td class="empty" colspan="5">Aucune livraison planifiée.</td></tr>';
    return;
  }
  upcomingBody.innerHTML = orders
    .map(
      (o) => `
      <tr>
        <td>${escapeHtml(formatDay(o.delivery_date))}</td>
        <td>${formatSlot(o.slot_start, o.slot_end)}</td>
        <td><a href="commande.html?id=${encodeURIComponent(o.id)}">${escapeHtml(o.customer_name)}</a><br><small>${formatOrderNumber(o.number)}</small></td>
        <td>${escapeHtml(formatAddress(o))}</td>
        <td>${orderStatusBadge(o.status)}</td>
      </tr>`
    )
    .join('');
}

function renderZones() {
  if (zones.length === 0) {
    zonesBody.innerHTML = '<tr><td class="empty" colspan="5">Aucune zone définie : les clients ne peuvent pas encore commander.</td></tr>';
    return;
  }
  zonesBody.innerHTML = zones
    .map(
      (z) => `
      <tr data-id="${escapeHtml(z.id)}">
        <td>${escapeHtml(z.name)}</td>
        <td>${escapeHtml(z.postal_codes.join(', '))}</td>
        <td class="num">${formatPrice(z.fee)}${z.free_from !== null ? `<br><small>offerte dès ${formatPrice(z.free_from)}</small>` : ''}</td>
        <td class="num">${z.min_order > 0 ? formatPrice(z.min_order) : '—'}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-action="edit">Modifier</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="delete">Supprimer</button>
          </div>
        </td>
      </tr>`
    )
    .join('');
}

function renderSlots() {
  if (slots.length === 0) {
    slotsBody.innerHTML = '<tr><td class="empty" colspan="4">Aucun créneau défini : les clients ne peuvent pas encore commander.</td></tr>';
    return;
  }
  slotsBody.innerHTML = slots
    .map(
      (s) => `
      <tr data-id="${escapeHtml(s.id)}">
        <td>${WEEKDAY_NAMES[s.weekday]}</td>
        <td>${formatSlot(s.start_time, s.end_time)}</td>
        <td class="num">${s.capacity}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-action="edit">Modifier</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="delete">Supprimer</button>
          </div>
        </td>
      </tr>`
    )
    .join('');
}

// ---------- chargement ----------

async function loadZones() {
  const { data, error } = await supabaseClient.from('delivery_zones').select('*').order('created_at');
  if (error) {
    console.error('Chargement des zones :', error);
    zonesBody.innerHTML = '<tr><td class="empty" colspan="5">Impossible de charger les zones.</td></tr>';
    return;
  }
  zones = data;
  renderZones();
}

async function loadSlots() {
  const { data, error } = await supabaseClient
    .from('delivery_slots')
    .select('*')
    .order('weekday')
    .order('start_time');
  if (error) {
    console.error('Chargement des créneaux :', error);
    slotsBody.innerHTML = '<tr><td class="empty" colspan="4">Impossible de charger les créneaux.</td></tr>';
    return;
  }
  slots = data;
  renderSlots();
}

async function loadUpcoming() {
  const { data, error } = await supabaseClient
    .from('orders')
    .select('id, number, customer_name, address_line1, address_line2, postal_code, city, delivery_date, slot_start, slot_end, status')
    .gte('delivery_date', toIsoDay(new Date()))
    .not('status', 'in', '(delivered,cancelled)')
    .order('delivery_date')
    .order('slot_start')
    .limit(200);
  if (error) {
    console.error('Chargement des livraisons :', error);
    upcomingBody.innerHTML = '<tr><td class="empty" colspan="5">Impossible de charger les livraisons.</td></tr>';
    return;
  }
  renderUpcoming(data);
}

// ---------- enregistrement ----------

// Insère (id vide) ou met à jour une ligne ; renvoie l'erreur éventuelle.
async function saveRow(table, id, payload) {
  const query = id
    ? supabaseClient.from(table).update(payload).eq('id', id)
    : supabaseClient.from(table).insert(payload);
  const { data, error } = await query.select('id');
  if (error || !data?.length) {
    console.error(`Enregistrement (${table}) :`, error);
    return error ?? new Error('Aucune ligne modifiée');
  }
  return null;
}

async function deleteRow(table, id) {
  const { data, error } = await supabaseClient.from(table).delete().eq('id', id).select('id');
  if (error || !data?.length) {
    console.error(`Suppression (${table}) :`, error);
    return false;
  }
  return true;
}

function setEditMode(form, label, editing) {
  form.querySelector('button[type="submit"]').textContent = label;
  form.querySelector('[data-cancel]').hidden = !editing;
}

function resetZoneForm() {
  editingZoneId = null;
  zoneForm.reset();
  setEditMode(zoneForm, 'Ajouter la zone', false);
}

function resetSlotForm() {
  editingSlotId = null;
  slotForm.reset();
  setEditMode(slotForm, 'Ajouter le créneau', false);
}

zoneForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setNotice('');
  const f = zoneForm.elements;

  const codes = [...new Set(f.postalCodes.value.split(/[\s,;]+/).filter(Boolean))];
  const invalid = codes.filter((code) => !/^\d{5}$/.test(code));
  if (codes.length === 0 || invalid.length > 0) {
    return setNotice(
      `Codes postaux invalides${invalid.length ? ` : ${invalid.join(', ')}` : ''}. Saisissez des codes à 5 chiffres, séparés par des virgules.`,
      true
    );
  }
  // Un code postal ne doit appartenir qu'à une seule zone (sinon les frais seraient ambigus).
  const clash = zones
    .filter((zone) => zone.id !== editingZoneId)
    .flatMap((zone) => zone.postal_codes.filter((code) => codes.includes(code)).map((code) => ({ code, zone: zone.name })))[0];
  if (clash) return setNotice(`Le code postal ${clash.code} appartient déjà à la zone « ${clash.zone} ».`, true);

  const button = zoneForm.querySelector('button[type="submit"]');
  button.disabled = true;
  const failure = await saveRow('delivery_zones', editingZoneId, {
    name: f.zone.value.trim(),
    postal_codes: codes,
    fee: Number(f.fee.value),
    free_from: f.freeFrom.value === '' ? null : Number(f.freeFrom.value),
    min_order: Number(f.minimum.value || 0),
  });
  button.disabled = false;

  if (failure) return setNotice("L'enregistrement de la zone a échoué. Vérifiez les valeurs saisies.", true);
  const wasEditing = Boolean(editingZoneId);
  resetZoneForm();
  await loadZones();
  setNotice(wasEditing ? 'Zone modifiée.' : 'Zone ajoutée.');
});

slotForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setNotice('');
  const f = slotForm.elements;

  if (f.end.value <= f.start.value) return setNotice("L'heure de fin doit être après l'heure de début.", true);

  const button = slotForm.querySelector('button[type="submit"]');
  button.disabled = true;
  const failure = await saveRow('delivery_slots', editingSlotId, {
    weekday: Number(f.weekday.value),
    start_time: f.start.value,
    end_time: f.end.value,
    capacity: Number(f.capacity.value),
  });
  button.disabled = false;

  if (failure) {
    return setNotice(
      failure.code === '23505' ? 'Ce créneau existe déjà ce jour-là.' : "L'enregistrement du créneau a échoué. Vérifiez les valeurs saisies.",
      true
    );
  }
  const wasEditing = Boolean(editingSlotId);
  resetSlotForm();
  await loadSlots();
  setNotice(wasEditing ? 'Créneau modifié.' : 'Créneau ajouté.');
});

[zoneForm, slotForm].forEach((form) => {
  form.querySelector('[data-cancel]').addEventListener('click', form === zoneForm ? resetZoneForm : resetSlotForm);
});

// ---------- actions des tableaux ----------

zonesBody.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  const zone = zones.find((z) => z.id === button?.closest('tr[data-id]')?.dataset.id);
  if (!zone) return;

  if (button.dataset.action === 'edit') {
    const f = zoneForm.elements;
    editingZoneId = zone.id;
    f.zone.value = zone.name;
    f.postalCodes.value = zone.postal_codes.join(', ');
    f.fee.value = zone.fee;
    f.freeFrom.value = zone.free_from ?? '';
    f.minimum.value = zone.min_order || '';
    setEditMode(zoneForm, 'Enregistrer la zone', true);
    zoneForm.scrollIntoView({ block: 'center' });
    f.zone.focus();
    return;
  }

  if (!window.confirm(`Supprimer la zone « ${zone.name} » ? Les clients de ces codes postaux ne pourront plus commander.`)) return;
  button.disabled = true;
  if (await deleteRow('delivery_zones', zone.id)) {
    if (editingZoneId === zone.id) resetZoneForm();
    await loadZones();
    setNotice('Zone supprimée.');
  } else {
    button.disabled = false;
    setNotice('La suppression a échoué. Réessayez.', true);
  }
});

slotsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  const slot = slots.find((s) => s.id === button?.closest('tr[data-id]')?.dataset.id);
  if (!slot) return;

  if (button.dataset.action === 'edit') {
    const f = slotForm.elements;
    editingSlotId = slot.id;
    f.weekday.value = String(slot.weekday);
    f.start.value = slot.start_time.slice(0, 5);
    f.end.value = slot.end_time.slice(0, 5);
    f.capacity.value = slot.capacity;
    setEditMode(slotForm, 'Enregistrer le créneau', true);
    slotForm.scrollIntoView({ block: 'center' });
    f.start.focus();
    return;
  }

  const label = `${WEEKDAY_NAMES[slot.weekday]} ${formatSlot(slot.start_time, slot.end_time)}`;
  if (!window.confirm(`Supprimer le créneau « ${label} » ? Les commandes déjà passées gardent leur horaire.`)) return;
  button.disabled = true;
  if (await deleteRow('delivery_slots', slot.id)) {
    if (editingSlotId === slot.id) resetSlotForm();
    await loadSlots();
    await loadUpcoming();
    setNotice('Créneau supprimé.');
  } else {
    button.disabled = false;
    setNotice('La suppression a échoué. Réessayez.', true);
  }
});

adminReady.then(() => Promise.all([loadUpcoming(), loadZones(), loadSlots()]));
