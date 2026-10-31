// Validation de la commande (commande.html).
// Exige un compte, préremplit le formulaire, propose zones et créneaux depuis la base,
// puis crée la commande par la fonction `place_order` : prix, frais et capacité des créneaux
// sont recalculés côté base : ce qu'affiche cette page n'est qu'une prévision.
// Dépend de cart.js, auth.js, utils.js et panier.js (affichage des lignes du panier).
const orderForm = document.getElementById('order-form');
const fields = orderForm.elements;
const errorEl = orderForm.querySelector('[data-error]');
const zoneMsgEl = orderForm.querySelector('[data-zone-msg]');
const submitBtn = document.querySelector('[data-submit]');
const noticeEl = document.querySelector('[data-cart-notice]');
const closedEl = document.querySelector('[data-shop-closed]');
const feeEl = document.querySelector('[data-delivery-fee]');
const totalEl = document.querySelector('[data-order-total]');

const savedWrap = orderForm.querySelector('[data-saved-addresses]');
const saveWrap = orderForm.querySelector('[data-save-address]');

let zones = [];
let availability = [];
let savedAddresses = [];
let userId = null;
let started = false;
let sending = false;

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

// ---------- adresses enregistrées ----------

function fillAddress(address) {
  fields.street.value = address.address_line1;
  fields.street2.value = address.address_line2 ?? '';
  fields.postalCode.value = address.postal_code;
  fields.city.value = address.city;
  fields.notes.value = address.delivery_notes ?? '';
}

function addressKey(address) {
  return [address.address_line1, address.address_line2, address.postal_code, address.city]
    .map((part) => (part ?? '').trim().toLowerCase())
    .join('|');
}

function renderSavedAddresses() {
  savedWrap.hidden = savedAddresses.length === 0;
  fields.savedAddress.innerHTML =
    '<option value="">Une autre adresse</option>' +
    savedAddresses
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label ? `${a.label} — ` : '')}${escapeHtml(formatAddress(a))}</option>`)
      .join('');
}

// Propose d'enregistrer l'adresse saisie, sauf si elle est incomplète, déjà dans le carnet,
// ou si le carnet est plein.
function updateSaveOption() {
  const typed = {
    address_line1: fields.street.value,
    address_line2: fields.street2.value,
    postal_code: fields.postalCode.value,
    city: fields.city.value,
  };
  const complete = typed.address_line1.trim() && /^\d{5}$/.test(typed.postal_code.trim()) && typed.city.trim();
  const known = savedAddresses.some((a) => addressKey(a) === addressKey(typed));
  const canSave = Boolean(complete) && !known && savedAddresses.length < MAX_ADDRESSES;
  saveWrap.hidden = !canSave;
  if (!canSave) fields.saveAddress.checked = false;
}

fields.savedAddress.addEventListener('change', () => {
  const chosen = savedAddresses.find((a) => a.id === fields.savedAddress.value);
  fillAddress(chosen ?? { address_line1: '', postal_code: '', city: '' });
  renderZone();
  updateSaveOption();
});
[fields.street, fields.street2, fields.postalCode, fields.city].forEach((input) =>
  input.addEventListener('input', updateSaveOption)
);

// ---------- zone, frais et totaux ----------

function findZone(postalCode) {
  return zones.find((zone) => zone.postal_codes.includes(postalCode)) ?? null;
}

function deliveryFee(zone, subtotal) {
  if (!zone) return null;
  return zone.free_from !== null && subtotal >= zone.free_from ? 0 : zone.fee;
}

function renderZone() {
  const postalCode = fields.postalCode.value.trim();
  const zone = /^\d{5}$/.test(postalCode) ? findZone(postalCode) : null;
  const subtotal = Cart.getSubtotal();
  const fee = deliveryFee(zone, subtotal);

  let message = 'Saisissez votre code postal pour connaître les frais de livraison.';
  let tone = '';
  if (/^\d{5}$/.test(postalCode) && zones.length > 0) {
    if (!zone) {
      message = 'Nous ne livrons pas encore ce code postal.';
      tone = 'msg-error';
    } else if (subtotal < zone.min_order) {
      message = `Le minimum de commande pour cette zone est de ${formatPrice(zone.min_order)}.`;
      tone = 'msg-error';
    } else {
      message = `Livraison à ${zone.name} : ${fee === 0 ? 'offerte' : formatPrice(fee)}.`;
      if (fee > 0 && zone.free_from !== null) message += ` Offerte dès ${formatPrice(zone.free_from)} d'achats.`;
      tone = 'msg-ok';
    }
  }
  zoneMsgEl.textContent = message;
  zoneMsgEl.className = `msg ${tone}`.trim();

  feeEl.textContent = fee === null ? 'Selon votre code postal' : fee === 0 ? 'Offerte' : formatPrice(fee);
  totalEl.textContent = formatPrice(subtotal + (fee ?? 0));
}

// ---------- jours et créneaux ----------

function renderDays() {
  const select = fields.day;
  const previous = select.value;
  const days = new Map();
  availability.forEach((slot) => {
    if (!days.has(slot.delivery_date)) days.set(slot.delivery_date, []);
    days.get(slot.delivery_date).push(slot);
  });

  if (days.size === 0) {
    select.innerHTML = '<option value="">Aucun jour disponible</option>';
    select.disabled = true;
    renderSlots();
    return;
  }

  select.innerHTML =
    '<option value="">Choisir un jour</option>' +
    [...days]
      .map(([day, slots]) => {
        const full = slots.every((slot) => slot.remaining <= 0);
        return `<option value="${escapeHtml(day)}"${full ? ' disabled' : ''}>${escapeHtml(capitalize(formatDay(day)))}${full ? ' (complet)' : ''}</option>`;
      })
      .join('');
  select.disabled = false;
  if (days.get(previous)?.some((slot) => slot.remaining > 0)) select.value = previous;
  renderSlots();
}

function renderSlots() {
  const select = fields.slot;
  const previous = select.value;
  const day = fields.day.value;

  if (!day) {
    select.innerHTML = '<option value="">Choisissez d’abord un jour</option>';
    select.disabled = true;
    return;
  }

  const slots = availability.filter((slot) => slot.delivery_date === day);
  select.innerHTML =
    '<option value="">Choisir un créneau</option>' +
    slots
      .map((slot) => {
        const full = slot.remaining <= 0;
        return `<option value="${escapeHtml(slot.slot_id)}"${full ? ' disabled' : ''}>${formatSlot(slot.start_time, slot.end_time)}${full ? ' (complet)' : ''}</option>`;
      })
      .join('');
  select.disabled = false;
  if (slots.some((slot) => slot.slot_id === previous && slot.remaining > 0)) select.value = previous;
}

async function loadAvailability() {
  const { data, error } = await supabaseClient.rpc('get_delivery_availability');
  if (error) {
    console.error('Chargement des créneaux :', error);
    return false;
  }
  availability = data;
  return true;
}

// ---------- chargement ----------

function showSyncNotice({ removed, repriced }) {
  const messages = [];
  if (removed.length) messages.push(`Retiré de votre panier, car plus disponible : ${removed.join(', ')}.`);
  if (repriced.length) messages.push(`Prix mis à jour : ${repriced.join(', ')}.`);
  noticeEl.textContent = messages.join(' ');
  noticeEl.hidden = messages.length === 0;
}

async function init(user) {
  const [syncResult, zonesResult, availabilityLoaded, lastOrder, addressesResult] = await Promise.all([
    Cart.syncWithCatalog(),
    supabaseClient.from('delivery_zones').select('*').order('created_at'),
    loadAvailability(),
    supabaseClient
      .from('orders')
      .select('customer_name, customer_phone, address_line1, address_line2, postal_code, city')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseClient.from('addresses').select('*').order('is_default', { ascending: false }).order('created_at'),
  ]);

  showSyncNotice(syncResult);

  if (addressesResult.error) console.error('Chargement des adresses :', addressesResult.error);
  savedAddresses = addressesResult.data ?? [];
  renderSavedAddresses();

  // Prérempli : nom et téléphone de la dernière commande ; adresse par défaut du carnet,
  // à défaut l'adresse de la dernière commande.
  const last = lastOrder.data;
  if (last) {
    fields.fullName.value = last.customer_name;
    fields.phone.value = last.customer_phone;
  }
  const preferred = savedAddresses.find((a) => a.is_default);
  if (preferred) {
    fields.savedAddress.value = preferred.id;
    fillAddress(preferred);
  } else if (last) {
    fillAddress(last);
  }
  updateSaveOption();

  if (zonesResult.error) console.error('Chargement des zones :', zonesResult.error);
  zones = zonesResult.data ?? [];

  const loadFailed = zonesResult.error || !availabilityLoaded;
  const open = !loadFailed && zones.length > 0 && availability.length > 0;
  if (!open) {
    closedEl.textContent = loadFailed
      ? 'Impossible de charger les informations de livraison. Rechargez la page dans un instant.'
      : "La prise de commande n'est pas encore ouverte : les zones et les créneaux de livraison ne sont pas encore définis.";
    closedEl.hidden = false;
  }
  submitBtn.disabled = !open;

  renderZone();
  renderDays();
}

// ---------- envoi ----------

fields.postalCode.addEventListener('input', () => {
  fields.postalCode.value = fields.postalCode.value.replace(/\D/g, '');
  renderZone();
});
fields.day.addEventListener('change', renderSlots);
Cart.subscribe(renderZone);

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending) return;
  showError('');

  // Contrôles de confort : la base refait les mêmes vérifications.
  const zone = findZone(fields.postalCode.value.trim());
  if (!zone) return showError('Nous ne livrons pas encore ce code postal.');
  if (Cart.getSubtotal() < zone.min_order) {
    return showError(`Le minimum de commande pour cette zone est de ${formatPrice(zone.min_order)}.`);
  }

  sending = true;
  submitBtn.disabled = true;
  const { data, error } = await supabaseClient.rpc('place_order', {
    p_items: Cart.getItems().map((item) => ({ product_id: item.id, quantity: item.qty })),
    p_full_name: fields.fullName.value,
    p_phone: fields.phone.value,
    p_address_line1: fields.street.value,
    p_address_line2: fields.street2.value,
    p_postal_code: fields.postalCode.value,
    p_city: fields.city.value,
    p_notes: fields.notes.value,
    p_delivery_date: fields.day.value,
    p_slot_id: fields.slot.value,
  });

  if (error) {
    console.error('Enregistrement de la commande :', error);
    // P0001 = refus volontaire de la base, dont le message est destiné au client.
    showError(error.code === 'P0001' ? error.message : "La commande n'a pas pu être enregistrée. Réessayez dans un instant.");
    sending = false;
    submitBtn.disabled = false;
    // Une place, un produit ou un prix a pu changer entre-temps : on recharge.
    if (error.code === 'P0001') {
      await Promise.all([loadAvailability(), Cart.syncWithCatalog().then(showSyncNotice)]);
      renderDays();
    }
    return;
  }

  // Enregistrement facultatif de l'adresse : un échec ne doit pas gêner une commande déjà passée.
  if (!saveWrap.hidden && fields.saveAddress.checked) {
    const { error: saveError } = await supabaseClient.from('addresses').insert({
      user_id: userId,
      address_line1: fields.street.value.trim(),
      address_line2: fields.street2.value.trim() || null,
      postal_code: fields.postalCode.value.trim(),
      city: fields.city.value.trim(),
      delivery_notes: fields.notes.value.trim() || null,
    });
    if (saveError) console.error("Enregistrement de l'adresse :", saveError);
  }

  document.body.classList.add('is-checking');
  Cart.clear();
  window.location.href = `commande-confirmee.html?id=${encodeURIComponent(data)}`;
});

// Passer commande exige un compte : on renvoie vers la connexion, puis on revient ici.
Auth.subscribe((user) => {
  if (!user) {
    window.location.replace('connexion.html?redirect=commande.html');
    return;
  }
  if (started) return;
  started = true;
  userId = user.id;

  fields.email.value = user.email;
  fields.fullName.value = user.user_metadata?.full_name || '';
  document.body.classList.remove('is-checking');
  init(user);
});
