// Ajout / modification d'un produit (admin) : /admin/produit-edition.html[?id=…]
const productId = new URLSearchParams(window.location.search).get('id');
const form = document.getElementById('product-form');
const loadingEl = document.getElementById('product-loading');
const submitBtn = form.querySelector('button[type="submit"]');
const deleteBtn = document.getElementById('delete-product');
const preview = document.getElementById('image-preview');
const removeImageRow = document.getElementById('remove-image-row');

let existing = null;

function showPreview(url) {
  preview.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Aperçu de la photo">` : '';
  preview.hidden = !url;
}

// Attention : `form.name` désignerait l'attribut name du <form>, pas le champ « name ».
const nameInput = form.elements.name;

function fillForm(p) {
  nameInput.value = p.name;
  form.description.value = p.description ?? '';
  form.price.value = p.price;
  form.unit.value = p.unit;
  form.category.value = p.category ?? '';
  form.in_stock.checked = p.in_stock;
  showPreview(p.image_url);
  removeImageRow.hidden = !p.image_url;
}

form.image.addEventListener('change', () => {
  const file = form.image.files[0];
  if (!file) {
    showPreview(existing?.image_url);
    return;
  }
  const problem = checkImageFile(file);
  if (problem) {
    setNotice(problem, true);
    form.image.value = '';
    showPreview(existing?.image_url);
    return;
  }
  setNotice('');
  showPreview(URL.createObjectURL(file));
  form.removeImage.checked = false;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setNotice('');

  const file = form.image.files[0];
  const price = Number(form.price.value);
  if (!nameInput.value.trim() || !form.unit.value.trim() || !(price >= 0)) {
    setNotice('Renseignez au minimum un nom, un prix et une unité.', true);
    return;
  }

  submitBtn.disabled = true;
  const previousUrl = existing?.image_url ?? null;
  let imageUrl = previousUrl;
  let uploadedUrl = null;

  try {
    if (form.removeImage.checked) imageUrl = null;
    if (file) {
      uploadedUrl = await uploadProductImage(file);
      imageUrl = uploadedUrl;
    }

    const payload = {
      name: nameInput.value.trim(),
      description: form.description.value.trim() || null,
      price,
      unit: form.unit.value.trim(),
      category: form.category.value.trim() || null,
      image_url: imageUrl,
      in_stock: form.in_stock.checked,
    };

    const query = productId
      ? supabaseClient.from('products').update(payload).eq('id', productId).select('id')
      : supabaseClient.from('products').insert(payload).select('id');
    const { data, error } = await query;
    if (error || !data?.length) throw error ?? new Error('Aucune ligne enregistrée');

    if (previousUrl && previousUrl !== imageUrl) await deleteProductImage(previousUrl);
    window.location.href = `produits.html?notice=${productId ? 'saved' : 'created'}`;
  } catch (error) {
    console.error('Enregistrement du produit :', error);
    if (uploadedUrl) await deleteProductImage(uploadedUrl);
    setNotice("L'enregistrement a échoué. Vérifiez les champs et réessayez.", true);
    submitBtn.disabled = false;
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!existing || !window.confirm(`Supprimer définitivement « ${existing.name} » ? Cette action est irréversible.`)) return;
  deleteBtn.disabled = true;
  const { data, error } = await supabaseClient.from('products').delete().eq('id', existing.id).select('id');
  if (error || !data?.length) {
    console.error('Suppression du produit :', error);
    setNotice('La suppression a échoué. Réessayez.', true);
    deleteBtn.disabled = false;
    return;
  }
  await deleteProductImage(existing.image_url);
  window.location.href = 'produits.html?notice=deleted';
});

adminReady.then(async () => {
  // Catégories déjà utilisées, proposées à la saisie (aucune liste fixe dans le code).
  const { data: all } = await supabaseClient.from('products').select('category');
  const categories = [...new Set((all ?? []).map((p) => p.category).filter(Boolean))].sort();
  document.getElementById('categories').innerHTML = categories
    .map((c) => `<option value="${escapeHtml(c)}">`)
    .join('');

  if (!productId) return;

  form.hidden = true;
  loadingEl.hidden = false;
  const { data, error } = await supabaseClient.from('products').select('*').eq('id', productId).maybeSingle();
  loadingEl.hidden = true;

  if (error || !data) {
    loadingEl.textContent = 'Produit introuvable.';
    loadingEl.hidden = false;
    return;
  }

  existing = data;
  document.title = `Modifier ${data.name} — Administration CroqFruit`;
  document.querySelector('[data-page-title]').textContent = 'Modifier le produit';
  document.querySelector('[data-page-crumb]').textContent = data.name;
  deleteBtn.hidden = false;
  fillForm(data);
  form.hidden = false;
});
