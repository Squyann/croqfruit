// Aperçu du compte (compte.html) : résumé de la dernière commande du client connecté.
const lastOrderEl = document.querySelector('[data-last-order]');
let lastOrderLoaded = false;

function renderLastOrder(order) {
  if (!order) {
    lastOrderEl.innerHTML = `
      <p class="state-message" style="padding-block:1.5rem">
        <strong>Aucune commande pour le moment</strong>
        Votre première commande apparaîtra ici.<br>
        <a class="btn btn-primary" href="boutique.html">Voir la boutique</a>
      </p>`;
    return;
  }

  lastOrderEl.innerHTML = `
    <dl class="info-list">
      <div class="info-row"><dt>Commande</dt><dd>${formatOrderNumber(order.number)}</dd></div>
      <div class="info-row"><dt>Passée le</dt><dd>${formatDate(order.created_at)}</dd></div>
      <div class="info-row"><dt>Livraison</dt><dd>${escapeHtml(formatDay(order.delivery_date))}, ${formatSlot(order.slot_start, order.slot_end)}</dd></div>
      <div class="info-row"><dt>Statut</dt><dd>${orderStatusBadge(order.status)}</dd></div>
      <div class="info-row"><dt>Total</dt><dd>${formatPrice(order.total)}</dd></div>
    </dl>
    <div class="form-actions" style="margin-top:1rem">
      <a class="btn btn-primary" href="compte-commande.html?id=${encodeURIComponent(order.id)}">Voir le détail</a>
      <a class="btn btn-ghost" href="compte-commandes.html">Toutes mes commandes</a>
    </div>`;
}

Auth.subscribe(async (user) => {
  if (!user || lastOrderLoaded) return;
  lastOrderLoaded = true;

  // `user_id` : un administrateur ne doit voir ici que ses propres commandes.
  const { data, error } = await supabaseClient
    .from('orders')
    .select('id, number, created_at, delivery_date, slot_start, slot_end, status, total')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Chargement de la dernière commande :', error);
    lastOrderEl.innerHTML = '<p class="state-message" style="padding-block:1.5rem">Impossible de charger votre dernière commande.</p>';
    return;
  }
  renderLastOrder(data);
});
