// Fiche d'une commande (admin, ?id=…) : détail, statut, règlement et note interne.
let order = null;
const statusForm = document.getElementById('status-form');
const notesForm = document.getElementById('notes-form');

function setText(selector, text) {
  document.querySelector(selector).textContent = text;
}

function renderOrder() {
  setText('[data-order-title]', `Commande n° ${formatOrderNumber(order.number)}`);
  setText('[data-order-date]', `Passée le ${formatDate(order.created_at)}`);
  document.querySelector('[data-order-status]').innerHTML = orderStatusBadge(order.status);

  document.querySelector('[data-order-items]').innerHTML = order.order_items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.product_name)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatPrice(item.unit_price)} / ${escapeHtml(item.unit)}</td>
        <td class="num">${formatPrice(item.line_total)}</td>
      </tr>`
    )
    .join('');
  setText('[data-order-subtotal]', formatPrice(order.subtotal));
  setText('[data-order-fee]', order.delivery_fee > 0 ? formatPrice(order.delivery_fee) : 'Offerte');
  setText('[data-order-total]', formatPrice(order.total));

  setText('[data-order-customer]', order.customer_name);
  setText('[data-order-email]', order.customer_email);
  setText('[data-order-phone]', order.customer_phone);
  setText('[data-order-address]', formatAddress(order));
  setText('[data-order-slot]', `${formatDay(order.delivery_date)}, ${formatSlot(order.slot_start, order.slot_end)}`);
  setText('[data-order-instructions]', order.delivery_notes || '—');

  statusForm.elements.status.value = order.status;
  statusForm.elements.payment.value = order.payment_status;
}

// ---------- emails automatiques de cette commande ----------
const EMAIL_KINDS = { order_confirmation: 'Confirmation au client', order_alert: 'Alerte à l’administration' };
const EMAIL_STATUSES = {
  pending: { label: 'En attente', badge: 'badge-warn' },
  sent: { label: 'Envoyé', badge: 'badge-ok' },
  failed: { label: 'Échec', badge: 'badge-warn' },
};

async function loadEmails() {
  const list = document.querySelector('[data-order-emails]');
  const { data, error } = await supabaseClient
    .from('email_outbox')
    .select('kind, to_email, status, last_error, created_at, sent_at')
    .eq('order_id', order.id)
    .order('created_at');

  if (error) {
    console.error('Chargement des emails :', error);
    list.innerHTML = '<li class="msg">Impossible de charger les emails.</li>';
    return;
  }
  if (data.length === 0) {
    list.innerHTML = '<li class="msg">Aucun email pour cette commande.</li>';
    return;
  }

  list.innerHTML = data
    .map((email) => {
      const status = EMAIL_STATUSES[email.status] ?? { label: email.status, badge: '' };
      const when = email.sent_at ? `Envoyé le ${formatDateTime(email.sent_at)}` : `Créé le ${formatDateTime(email.created_at)}`;
      return `
        <li>
          <span><strong>${escapeHtml(EMAIL_KINDS[email.kind] ?? email.kind)}</strong><span class="badge ${status.badge}">${status.label}</span></span>
          <small>${escapeHtml(email.to_email)} · ${when}</small>
          ${email.last_error ? `<small class="email-error">${escapeHtml(email.last_error)}</small>` : ''}
        </li>`;
    })
    .join('');
  document.querySelector('[data-emails-note]').hidden = !data.some((email) => email.status === 'pending');
}

// Enregistre des champs de la commande ; renvoie true si la ligne a bien été modifiée.
async function saveOrder(changes, button) {
  setNotice('');
  button.disabled = true;
  const { data, error } = await supabaseClient.from('orders').update(changes).eq('id', order.id).select('id');
  button.disabled = false;
  if (error || !data?.length) {
    console.error('Mise à jour de la commande :', error);
    setNotice('La modification a échoué. Réessayez.', true);
    return false;
  }
  Object.assign(order, changes);
  return true;
}

statusForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const changes = { status: statusForm.elements.status.value, payment_status: statusForm.elements.payment.value };
  if (await saveOrder(changes, statusForm.querySelector('button[type="submit"]'))) {
    renderOrder();
    setNotice('Commande mise à jour.');
  }
});

notesForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const note = notesForm.elements.notes.value.trim();
  if (await saveOrder({ admin_notes: note || null }, notesForm.querySelector('button[type="submit"]'))) {
    setNotice('Note enregistrée.');
  }
});

adminReady.then(async () => {
  const id = new URLSearchParams(window.location.search).get('id');
  const { data, error } = id
    ? await supabaseClient.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle()
    : { data: null, error: null };
  if (error) console.error('Chargement de la commande :', error);

  if (!data) {
    document.querySelector('[data-order-missing]').hidden = false;
    return;
  }
  order = data;
  notesForm.elements.notes.value = order.admin_notes ?? '';
  renderOrder();
  document.querySelector('[data-order-content]').hidden = false;
  loadEmails();
});
