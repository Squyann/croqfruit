// Chiffres et commandes récentes du tableau de bord.
function setStat(name, result) {
  const el = document.querySelector(`[data-stat="${name}"]`);
  if (el) el.textContent = result.error ? '—' : String(result.count ?? 0);
}

function renderRecentOrders({ data, error }) {
  const body = document.getElementById('recent-orders');
  if (error) {
    console.error('Chargement des commandes récentes :', error);
    body.innerHTML = '<tr><td class="empty" colspan="5">Impossible de charger les commandes.</td></tr>';
    return;
  }
  if (data.length === 0) {
    body.innerHTML = '<tr><td class="empty" colspan="5">Aucune commande pour le moment.</td></tr>';
    return;
  }
  body.innerHTML = data
    .map(
      (o) => `
      <tr>
        <td><a href="commande.html?id=${encodeURIComponent(o.id)}">${formatOrderNumber(o.number)}</a></td>
        <td>${formatDate(o.created_at)}</td>
        <td>${escapeHtml(o.customer_name)}</td>
        <td>${orderStatusBadge(o.status)}</td>
        <td class="num">${formatPrice(o.total)}</td>
      </tr>`
    )
    .join('');
}

adminReady.then(async () => {
  const count = (table) => supabaseClient.from(table).select('id', { count: 'exact', head: true });

  const [products, customers, toPrepare, upcoming, unread, recent] = await Promise.all([
    count('products').eq('in_stock', true),
    count('profiles').eq('role', 'customer'),
    count('orders').in('status', ['pending', 'preparing']),
    count('orders').gte('delivery_date', toIsoDay(new Date())).not('status', 'in', '(delivered,cancelled)'),
    count('contact_messages').eq('status', 'new'),
    supabaseClient
      .from('orders')
      .select('id, number, created_at, customer_name, status, total')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);
  setStat('products', products);
  setStat('customers', customers);
  setStat('toPrepare', toPrepare);
  setStat('upcoming', upcoming);
  setStat('unread', unread);
  renderRecentOrders(recent);
});
