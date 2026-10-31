// Récapitulatif affiché juste après la validation d'une commande (?id=…).
let confirmationShown = false;

Auth.subscribe(async (user) => {
  if (!user) {
    window.location.replace(`connexion.html?redirect=${encodeURIComponent(pageForRedirect())}`);
    return;
  }
  if (confirmationShown) return;
  confirmationShown = true;

  const id = new URLSearchParams(window.location.search).get('id');
  const { data: order, error } = id
    ? await supabaseClient
        .from('orders')
        .select('number, delivery_date, slot_start, slot_end, address_line1, address_line2, postal_code, city, total')
        .eq('id', id)
        .maybeSingle()
    : { data: null, error: null };
  if (error) console.error('Chargement de la commande :', error);

  document.body.classList.remove('is-checking');
  if (!order) {
    document.querySelector('[data-order-missing]').hidden = false;
    return;
  }

  document.querySelector('[data-order-number]').textContent = formatOrderNumber(order.number);
  document.querySelector('[data-order-delivery]').textContent =
    `${formatDay(order.delivery_date)}, ${formatSlot(order.slot_start, order.slot_end)}`;
  document.querySelector('[data-order-address]').textContent = formatAddress(order);
  document.querySelector('[data-order-total]').textContent = formatPrice(order.total);
  document.querySelector('[data-order-content]').hidden = false;
});
