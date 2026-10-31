// Fonctions utilitaires partagées (affichage de données venant de la base).

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function formatPrice(value) {
  return Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------- commandes et livraisons ----------

const ORDER_STATUSES = {
  pending: { label: 'En attente', badge: 'badge-warn' },
  preparing: { label: 'En préparation', badge: '' },
  out_for_delivery: { label: 'En livraison', badge: '' },
  delivered: { label: 'Livrée', badge: 'badge-ok' },
  cancelled: { label: 'Annulée', badge: '' },
};

const PAYMENT_STATUSES = { unpaid: 'À régler', paid: 'Payée', refunded: 'Remboursée' };

// Jours de la semaine, indexés comme `weekday` en base (1 = lundi … 7 = dimanche).
const WEEKDAY_NAMES = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function formatOrderNumber(number) {
  return `CF-${String(number).padStart(5, '0')}`;
}

function orderStatusBadge(status) {
  const known = ORDER_STATUSES[status] ?? { label: status, badge: '' };
  return `<span class="badge ${known.badge}">${escapeHtml(known.label)}</span>`;
}

// Date « jour seul » de la base (AAAA-MM-JJ) : on évite new Date('AAAA-MM-JJ'),
// interprétée en UTC, qui peut afficher la veille selon le fuseau.
function parseDay(isoDay) {
  const [year, month, day] = isoDay.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDay(isoDay) {
  return parseDay(isoDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Jour au format AAAA-MM-JJ à partir d'un objet Date (fuseau du navigateur).
function toIsoDay(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// '09:00:00' → '9h00'
function formatTime(time) {
  const [hours, minutes] = time.split(':');
  return `${Number(hours)}h${minutes}`;
}

function formatSlot(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatAddress(order) {
  return [order.address_line1, order.address_line2, `${order.postal_code} ${order.city}`]
    .filter(Boolean)
    .join(', ');
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
