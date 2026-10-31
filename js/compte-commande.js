// Détail d'une commande du client connecté (?id=…).
let orderDetailLoaded = false;

function setText(selector, text) {
  document.querySelector(selector).textContent = text;
}

Auth.subscribe(async (user) => {
  if (!user || orderDetailLoaded) return;
  orderDetailLoaded = true;

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    window.location.replace('compte-commandes.html');
    return;
  }

  // `user_id` : un administrateur ne doit voir ici que ses propres commandes.
  const { data: order, error } = await supabaseClient
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) console.error('Chargement de la commande :', error);

  if (!order) {
    document.querySelector('[data-order-missing]').hidden = false;
    return;
  }

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

  setText('[data-order-address]', formatAddress(order));
  setText('[data-order-slot]', `${formatDay(order.delivery_date)}, ${formatSlot(order.slot_start, order.slot_end)}`);
  setText('[data-order-notes]', order.delivery_notes || '—');
  setText('[data-order-subtotal]', formatPrice(order.subtotal));
  setText('[data-order-fee]', order.delivery_fee > 0 ? formatPrice(order.delivery_fee) : 'Offerte');
  setText('[data-order-total]', formatPrice(order.total));
  setText('[data-order-payment]', PAYMENT_STATUSES[order.payment_status] ?? order.payment_status);

  document.querySelector('[data-order-content]').hidden = false;
});
