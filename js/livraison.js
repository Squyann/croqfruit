// Page « Livraison » : zones, jours, créneaux et frais lus dans la base (renseignés par
// l'administration) et vérification du code postal. Tant qu'une information n'est pas
// saisie en base, le texte « à compléter » de la page reste affiché.
const postalForm = document.getElementById('postal-form');
const postalResult = postalForm.querySelector('[data-postal-result]');
let zones = [];

function setInfo(name, html) {
  document.querySelector(`[data-info="${name}"]`).innerHTML = html;
}

function describeFee(zone) {
  const fee = zone.fee > 0 ? formatPrice(zone.fee) : 'gratuite';
  const free = zone.free_from !== null && zone.fee > 0 ? `, offerte dès ${formatPrice(zone.free_from)} d'achats` : '';
  return `${fee}${free}`;
}

function renderInfo(slots) {
  if (zones.length > 0) {
    setInfo('zones', zones.map((z) => `<strong>${escapeHtml(z.name)}</strong> : ${escapeHtml(z.postal_codes.join(', '))}`).join('<br>'));
    setInfo('fees', zones.map((z) => `${escapeHtml(z.name)} : ${describeFee(z)}`).join('<br>'));
    const withMinimum = zones.filter((z) => z.min_order > 0);
    setInfo(
      'minimum',
      withMinimum.length > 0
        ? withMinimum.map((z) => `${escapeHtml(z.name)} : ${formatPrice(z.min_order)}`).join('<br>')
        : 'Aucun minimum de commande.'
    );
  }

  if (slots.length > 0) {
    const byDay = new Map();
    slots.forEach((slot) => {
      if (!byDay.has(slot.weekday)) byDay.set(slot.weekday, []);
      byDay.get(slot.weekday).push(formatSlot(slot.start_time, slot.end_time));
    });
    setInfo('days', [...byDay.keys()].map((weekday) => WEEKDAY_NAMES[weekday]).join(', '));
    setInfo('slots', [...byDay].map(([weekday, ranges]) => `${WEEKDAY_NAMES[weekday]} : ${ranges.join(', ')}`).join('<br>'));
  }
}

postalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const postalCode = postalForm.elements.postalCode.value.trim();
  const zone = zones.find((z) => z.postal_codes.includes(postalCode));

  let message;
  let tone = '';
  if (zones.length === 0) {
    message = "Les zones de livraison ne sont pas encore renseignées. Revenez bientôt.";
  } else if (zone) {
    message = `Oui, nous livrons à ${zone.name}. Frais de livraison : ${describeFee(zone)}.`;
    if (zone.min_order > 0) message += ` Commande minimum : ${formatPrice(zone.min_order)}.`;
    tone = 'msg-ok';
  } else {
    message = 'Nous ne livrons pas encore ce code postal.';
    tone = 'msg-error';
  }
  postalResult.textContent = message;
  postalResult.className = `msg ${tone}`.trim();
  postalResult.hidden = false;
});

postalForm.elements.postalCode.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\D/g, '');
});

(async () => {
  const [zonesResult, slotsResult] = await Promise.all([
    supabaseClient.from('delivery_zones').select('*').order('created_at'),
    supabaseClient.from('delivery_slots').select('*').order('weekday').order('start_time'),
  ]);
  if (zonesResult.error) console.error('Chargement des zones :', zonesResult.error);
  if (slotsResult.error) console.error('Chargement des créneaux :', slotsResult.error);
  zones = zonesResult.data ?? [];
  renderInfo(slotsResult.data ?? []);
})();
