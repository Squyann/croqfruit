// Fonctions utilitaires partagées (affichage de données venant de la base).

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function productInitial(name) {
  return escapeHtml((name || '?').trim().charAt(0).toUpperCase());
}

function renderMedia(product, sizeClass) {
  if (product.image_url) {
    return `<img src="${escapeHtml(product.image_url)}" alt="" loading="lazy">`;
  }
  return `<span class="product-placeholder ${sizeClass || ''}">${productInitial(product.name)}</span>`;
}
