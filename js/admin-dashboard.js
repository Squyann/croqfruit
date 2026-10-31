// Chiffres du tableau de bord. Commandes et livraisons arriveront avec leurs tables.
function setStat(name, result) {
  const el = document.querySelector(`[data-stat="${name}"]`);
  if (el) el.textContent = result.error ? '—' : String(result.count ?? 0);
}

adminReady.then(async () => {
  const [products, customers] = await Promise.all([
    supabaseClient.from('products').select('id', { count: 'exact', head: true }).eq('in_stock', true),
    supabaseClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
  ]);
  setStat('products', products);
  setStat('customers', customers);
});
