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
});
