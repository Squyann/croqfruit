// Liste des produits (admin) : recherche, filtres, mise en vente / masquage, suppression.
let products = [];
const body = document.getElementById('products-body');
const searchInput = document.getElementById('product-search');
const categorySelect = document.getElementById('product-category');
const stockSelect = document.getElementById('product-stock');

const NOTICES = {
  created: 'Produit ajouté.',
  saved: 'Modifications enregistrées.',
  deleted: 'Produit supprimé.',
};

function renderRow(p) {
  const id = escapeHtml(p.id);
  return `
    <tr data-id="${id}">
      <td><div class="thumb">${renderMedia(p)}</div></td>
      <td><a href="produit-edition.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a></td>
      <td>${escapeHtml(p.category || '—')}</td>
      <td class="num">${formatPrice(p.price)}</td>
      <td>${escapeHtml(p.unit)}</td>
      <td><span class="badge ${p.in_stock ? 'badge-ok' : ''}">${p.in_stock ? 'En vente' : 'Masqué'}</span></td>
      <td>
        <div class="row-actions">
          <a class="btn btn-ghost btn-sm" href="produit-edition.html?id=${encodeURIComponent(p.id)}">Modifier</a>
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle">${p.in_stock ? 'Masquer' : 'Mettre en vente'}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="delete">Supprimer</button>
        </div>
      </td>
    </tr>`;
}

function renderProducts() {
  const q = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;
  const stock = stockSelect.value;

  const rows = products.filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q)) &&
      (!category || p.category === category) &&
      (!stock || (stock === 'in' ? p.in_stock : !p.in_stock))
  );

  if (rows.length === 0) {
    body.innerHTML = products.length
      ? '<tr><td class="empty" colspan="7">Aucun produit ne correspond aux filtres.</td></tr>'
      : '<tr><td class="empty" colspan="7">Aucun produit pour le moment. <a href="produit-edition.html">Ajouter le premier produit</a></td></tr>';
    return;
  }
  body.innerHTML = rows.map(renderRow).join('');
}

function refreshCategories() {
  const current = categorySelect.value;
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  categorySelect.innerHTML =
    '<option value="">Toutes</option>' +
    categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  categorySelect.value = categories.includes(current) ? current : '';
}

[searchInput, categorySelect, stockSelect].forEach((el) => el.addEventListener('input', renderProducts));

body.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  const row = button?.closest('tr[data-id]');
  if (!row) return;

  const product = products.find((p) => String(p.id) === row.dataset.id);
  if (!product) return;

  button.disabled = true;
  setNotice('');

  if (button.dataset.action === 'toggle') {
    const { data, error } = await supabaseClient
      .from('products')
      .update({ in_stock: !product.in_stock })
      .eq('id', product.id)
      .select('id');
    if (error || !data?.length) {
      console.error('Mise à jour du produit :', error);
      setNotice('La modification a échoué. Réessayez.', true);
    } else {
      product.in_stock = !product.in_stock;
      renderProducts();
    }
  }

  if (button.dataset.action === 'delete') {
    if (!window.confirm(`Supprimer définitivement « ${product.name} » ? Cette action est irréversible.`)) {
      button.disabled = false;
      return;
    }
    const { data, error } = await supabaseClient.from('products').delete().eq('id', product.id).select('id');
    if (error || !data?.length) {
      console.error('Suppression du produit :', error);
      setNotice('La suppression a échoué. Réessayez.', true);
    } else {
      await deleteProductImage(product.image_url);
      products = products.filter((p) => p.id !== product.id);
      refreshCategories();
      renderProducts();
      setNotice(NOTICES.deleted);
    }
  }

  button.disabled = false;
});

adminReady.then(async () => {
  const notice = NOTICES[new URLSearchParams(window.location.search).get('notice')];
  if (notice) setNotice(notice);

  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('category', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Chargement des produits :', error);
    body.innerHTML = '<tr><td class="empty" colspan="7">Impossible de charger les produits.</td></tr>';
    return;
  }
  products = data;
  refreshCategories();
  renderProducts();
});
