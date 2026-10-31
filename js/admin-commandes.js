// Liste des commandes (admin) : recherche, filtre par statut et par jour de livraison.
// Les 500 commandes les plus récentes sont chargées et filtrées dans la page.
const ORDERS_LIMIT = 500;
let orders = [];
const body = document.getElementById('orders-body');
const searchInput = document.getElementById('order-search');
const statusSelect = document.getElementById('order-status');
const dayInput = document.getElementById('order-day');

function renderOrders() {
  const q = searchInput.value.trim().toLowerCase();
  const status = statusSelect.value;
  const day = dayInput.value;

  const rows = orders.filter(
    (o) =>
      (!q || `${formatOrderNumber(o.number)} ${o.customer_name} ${o.customer_email}`.toLowerCase().includes(q)) &&
      (!status || o.status === status) &&
      (!day || o.delivery_date === day)
  );

  if (rows.length === 0) {
    body.innerHTML = `<tr><td class="empty" colspan="7">${orders.length ? 'Aucune commande ne correspond aux filtres.' : 'Aucune commande pour le moment.'}</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map(
      (o) => `
      <tr>
        <td>${formatOrderNumber(o.number)}</td>
        <td>${formatDate(o.created_at)}</td>
        <td>${escapeHtml(o.customer_name)}<br><small>${escapeHtml(o.customer_email)}</small></td>
        <td>${escapeHtml(formatDay(o.delivery_date))}<br><small>${formatSlot(o.slot_start, o.slot_end)}</small></td>
        <td>${orderStatusBadge(o.status)}</td>
        <td class="num">${formatPrice(o.total)}</td>
        <td><a class="btn btn-ghost btn-sm" href="commande.html?id=${encodeURIComponent(o.id)}">Ouvrir</a></td>
      </tr>`
    )
    .join('');
}

[searchInput, statusSelect, dayInput].forEach((el) => el.addEventListener('input', renderOrders));

adminReady.then(async () => {
  // Le tableau de bord renvoie ici avec ?status=… pour filtrer d'emblée.
  const wanted = new URLSearchParams(window.location.search).get('status');
  if (wanted && ORDER_STATUSES[wanted]) statusSelect.value = wanted;

  const { data, error } = await supabaseClient
    .from('orders')
    .select('id, number, created_at, customer_name, customer_email, delivery_date, slot_start, slot_end, status, total')
    .order('created_at', { ascending: false })
    .limit(ORDERS_LIMIT);

  if (error) {
    console.error('Chargement des commandes :', error);
    body.innerHTML = '<tr><td class="empty" colspan="7">Impossible de charger les commandes.</td></tr>';
    return;
  }
  orders = data;
  renderOrders();
  if (orders.length === ORDERS_LIMIT) {
    setNotice(`Seules les ${ORDERS_LIMIT} commandes les plus récentes sont affichées.`);
  }
});
