// Modèles des emails de commande (texte + HTML).
// Tout ce que saisit un client (nom, adresse, instructions, noms de produits) est échappé avant d'entrer dans le HTML,
// et nettoyé des retours à la ligne avant d'entrer dans un objet d'email.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Une seule ligne : pas de retour à la ligne ni de tabulation (objet de l'email, noms). */
export function oneLine(value) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
}

export function formatEuros(value) {
  return `${Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function formatOrderNumber(number) {
  return `CF-${String(number).padStart(5, '0')}`;
}

/** '2026-11-02' → 'lundi 2 novembre' (sans décalage de fuseau). */
export function formatDay(isoDay) {
  const [year, month, day] = String(isoDay).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** '09:00:00' → '9h00'. */
export function formatTime(time) {
  const [hours, minutes] = String(time).split(':');
  return `${Number(hours)}h${minutes}`;
}

function formatAddress(order) {
  return [order.address_line1, order.address_line2, `${order.postal_code} ${order.city}`].filter(Boolean).join(', ');
}

const PAYMENT_LABELS = { unpaid: 'à régler', paid: 'payée', refunded: 'remboursée' };

/** Adresse du site (sans « / » final), ou '' si elle n'est pas renseignée ou n'est pas en http(s). */
function cleanSiteUrl(siteUrl) {
  const url = String(siteUrl ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s"'<>]+$/.test(url) ? url : '';
}

// Mêmes couleurs que le site (voir css/style.css) : corail sur fond crème.
const BRAND = '#D2441A';

function itemsHtml(order) {
  const rows = (order.order_items ?? [])
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #EDE0D3">${escapeHtml(item.product_name)}<br><span style="color:#75625A;font-size:13px">${escapeHtml(formatEuros(item.unit_price))} / ${escapeHtml(item.unit)} × ${Number(item.quantity)}</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #EDE0D3;text-align:right;white-space:nowrap">${escapeHtml(formatEuros(item.line_total))}</td>
        </tr>`
    )
    .join('');

  const fee = Number(order.delivery_fee) > 0 ? formatEuros(order.delivery_fee) : 'Offerte';
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px">
        ${rows}
        <tr><td style="padding:8px 0;color:#75625A">Sous-total</td><td style="padding:8px 0;text-align:right">${escapeHtml(formatEuros(order.subtotal))}</td></tr>
        <tr><td style="padding:8px 0;color:#75625A">Livraison</td><td style="padding:8px 0;text-align:right">${escapeHtml(fee)}</td></tr>
        <tr><td style="padding:10px 0;font-weight:bold;font-size:17px">Total</td><td style="padding:10px 0;text-align:right;font-weight:bold;font-size:17px">${escapeHtml(formatEuros(order.total))}</td></tr>
      </table>`;
}

function itemsText(order) {
  const lines = (order.order_items ?? []).map(
    (item) => `- ${oneLine(item.product_name)} : ${Number(item.quantity)} × ${formatEuros(item.unit_price)} / ${oneLine(item.unit)} = ${formatEuros(item.line_total)}`
  );
  const fee = Number(order.delivery_fee) > 0 ? formatEuros(order.delivery_fee) : 'offerte';
  return [...lines, '', `Sous-total : ${formatEuros(order.subtotal)}`, `Livraison : ${fee}`, `Total : ${formatEuros(order.total)}`].join('\n');
}

function layout({ title, intro, bodyHtml, linkUrl, linkLabel, footer }) {
  const button = linkUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(linkUrl)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:3px;font-weight:bold">${escapeHtml(linkLabel)}</a></p>`
    : '';
  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#FFFBF7;font-family:Arial,Helvetica,sans-serif;color:#2B1D16">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-top:4px solid ${BRAND}">
      <tr><td style="padding:28px 28px 8px">
        <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${BRAND};font-weight:bold">CroqFruit</div>
        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25">${escapeHtml(title)}</h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.5">${intro}</p>
      </td></tr>
      <tr><td style="padding:8px 28px 28px">${bodyHtml}${button}</td></tr>
      <tr><td style="padding:16px 28px;background:#F8EFE6;font-size:12px;color:#75625A;line-height:1.5">${escapeHtml(footer)}</td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

function deliveryHtml(order) {
  const notes = order.delivery_notes
    ? `<br><span style="color:#75625A">Instructions : ${escapeHtml(order.delivery_notes)}</span>`
    : '';
  return `
      <h2 style="margin:20px 0 6px;font-size:16px">Livraison</h2>
      <p style="margin:0;font-size:15px;line-height:1.5">${escapeHtml(formatDay(order.delivery_date))}, de ${escapeHtml(formatTime(order.slot_start))} à ${escapeHtml(formatTime(order.slot_end))}<br>${escapeHtml(formatAddress(order))}${notes}</p>
      <h2 style="margin:20px 0 6px;font-size:16px">Votre commande</h2>`;
}

function deliveryText(order) {
  const lines = [
    `Livraison : ${formatDay(order.delivery_date)}, de ${formatTime(order.slot_start)} à ${formatTime(order.slot_end)}`,
    `Adresse : ${formatAddress(order)}`,
  ];
  if (order.delivery_notes) lines.push(`Instructions : ${oneLine(order.delivery_notes)}`);
  return lines.join('\n');
}

/**
 * Email envoyé au client quand sa commande est enregistrée.
 * @param {object} order commande avec ses lignes (order_items)
 * @param {{ siteUrl?: string }} [options]
 */
export function renderOrderConfirmation(order, { siteUrl } = {}) {
  const base = cleanSiteUrl(siteUrl);
  const number = formatOrderNumber(order.number);
  const name = oneLine(order.customer_name);
  const link = base ? `${base}/compte-commande.html?id=${encodeURIComponent(order.id)}` : '';

  const html = layout({
    title: 'Merci pour votre commande',
    intro: `Bonjour ${escapeHtml(name)}, votre commande <strong>${escapeHtml(number)}</strong> est bien enregistrée.`,
    bodyHtml: deliveryHtml(order) + itemsHtml(order),
    linkUrl: link,
    linkLabel: 'Suivre ma commande',
    footer: 'Cet email vous a été envoyé automatiquement suite à votre commande sur CroqFruit.',
  });

  const text = [
    `Bonjour ${name},`,
    '',
    `Votre commande ${number} est bien enregistrée.`,
    '',
    deliveryText(order),
    '',
    'Votre commande :',
    itemsText(order),
    ...(link ? ['', `Suivre ma commande : ${link}`] : []),
    '',
    'Cet email vous a été envoyé automatiquement suite à votre commande sur CroqFruit.',
  ].join('\n');

  return { subject: `Confirmation de votre commande ${number}`, html, text };
}

/**
 * Email envoyé aux administrateurs à chaque nouvelle commande.
 * @param {object} order commande avec ses lignes (order_items)
 * @param {{ siteUrl?: string }} [options]
 */
export function renderOrderAlert(order, { siteUrl } = {}) {
  const base = cleanSiteUrl(siteUrl);
  const number = formatOrderNumber(order.number);
  const name = oneLine(order.customer_name);
  const payment = PAYMENT_LABELS[order.payment_status] ?? order.payment_status;
  const link = base ? `${base}/admin/commande.html?id=${encodeURIComponent(order.id)}` : '';

  const customerHtml = `
      <h2 style="margin:20px 0 6px;font-size:16px">Client</h2>
      <p style="margin:0;font-size:15px;line-height:1.5">${escapeHtml(name)}<br>${escapeHtml(oneLine(order.customer_email))}<br>${escapeHtml(oneLine(order.customer_phone))}</p>`;

  const html = layout({
    title: `Nouvelle commande ${number}`,
    intro: `Une commande de <strong>${escapeHtml(formatEuros(order.total))}</strong> vient d'être passée (règlement : ${escapeHtml(payment)}).`,
    bodyHtml: customerHtml + deliveryHtml(order) + itemsHtml(order),
    linkUrl: link,
    linkLabel: 'Ouvrir la commande',
    footer: 'Alerte automatique de CroqFruit, envoyée aux comptes administrateur.',
  });

  const text = [
    `Nouvelle commande ${number} : ${formatEuros(order.total)} (règlement : ${payment})`,
    '',
    `Client : ${name}`,
    `Email : ${oneLine(order.customer_email)}`,
    `Téléphone : ${oneLine(order.customer_phone)}`,
    '',
    deliveryText(order),
    '',
    'Commande :',
    itemsText(order),
    ...(link ? ['', `Ouvrir la commande : ${link}`] : []),
  ].join('\n');

  return { subject: `Nouvelle commande ${number} · ${name} · ${formatEuros(order.total)}`, html, text };
}
