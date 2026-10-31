// Historique des commandes du client connecté (la RLS ne renvoie que les siennes).
const ordersBody = document.getElementById('orders-body');
let ordersLoaded = false;

Auth.subscribe(async (user) => {
  if (!user || ordersLoaded) return;
  ordersLoaded = true;

  const { data, error } = await supabaseClient
    .from('orders')
    .select('id, number, created_at, delivery_date, slot_start, slot_end, status, total')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Chargement des commandes :', error);
    ordersBody.innerHTML = '<tr><td class="empty" colspan="6">Impossible de charger vos commandes.</td></tr>';
    return;
  }
  if (data.length === 0) {
    ordersBody.innerHTML =
      '<tr><td class="empty" colspan="6">Vous n\'avez pas encore passé de commande. <a href="boutique.html">Découvrir la boutique</a></td></tr>';
    return;
  }

  ordersBody.innerHTML = data
    .map(
      (order) => `
      <tr>
        <td>${formatOrderNumber(order.number)}</td>
        <td>${formatDate(order.created_at)}</td>
        <td>${escapeHtml(formatDay(order.delivery_date))}, ${formatSlot(order.slot_start, order.slot_end)}</td>
        <td>${orderStatusBadge(order.status)}</td>
        <td class="num">${formatPrice(order.total)}</td>
        <td><a class="btn btn-ghost btn-sm" href="compte-commande.html?id=${encodeURIComponent(order.id)}">Détail</a></td>
      </tr>`
    )
    .join('');
});
