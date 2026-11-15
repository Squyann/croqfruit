// Tests de la logique d'envoi d'emails (sans Brevo ni base de données : tout est simulé).
// Lancer avec : node supabase/functions/send-emails/test.mjs
import assert from 'node:assert/strict';
import { MAX_ATTEMPTS, SendError, processQueue, sendWithBrevo } from './sender.mjs';
import { escapeHtml, formatDay, formatTime, oneLine, renderOrderAlert, renderOrderConfirmation } from './templates.mjs';

let passed = 0;
async function test(name, run) {
  try {
    await run();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}\n${error.stack}`);
    process.exitCode = 1;
  }
}

const order = {
  id: '11111111-2222-3333-4444-555555555555',
  number: 12,
  customer_name: 'Claire Dupont',
  customer_email: 'claire@example.com',
  customer_phone: '06 12 34 56 78',
  address_line1: '12 rue des Halles',
  address_line2: 'Escalier B',
  postal_code: '75001',
  city: 'Paris',
  delivery_notes: 'Digicode 4521',
  delivery_date: '2026-11-02',
  slot_start: '09:00:00',
  slot_end: '12:00:00',
  subtotal: 19.5,
  delivery_fee: 4.9,
  total: 24.4,
  payment_status: 'unpaid',
  order_items: [
    { product_name: 'Pommes Gala', unit: 'kg', unit_price: 3.5, quantity: 5, line_total: 17.5 },
    { product_name: 'Poires', unit: 'kg', unit_price: 2, quantity: 1, line_total: 2 },
  ],
};

// Base simulée : une file de lignes et le journal des changements d'état.
function fakeRepo(rows, orders = { [order.id]: order }) {
  const log = [];
  return {
    log,
    async claim() { return rows; },
    async loadOrder(id) { return orders[id] ?? null; },
    async markSent(id) { log.push(['sent', id]); },
    async release(row, message, refund) { log.push(['release', row.id, message, refund]); },
    async markFailed(id, message) { log.push(['failed', id, message]); },
  };
}
const row = (overrides = {}) => ({ id: 'r1', kind: 'order_confirmation', order_id: order.id, to_email: 'claire@example.com', to_name: 'Claire Dupont', attempts: 1, ...overrides });
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

console.log('Modèles');

await test('confirmation : sujet, contenu et totaux', () => {
  const mail = renderOrderConfirmation(order);
  assert.equal(mail.subject, 'Confirmation de votre commande CF-00012');
  for (const expected of ['Claire Dupont', 'CF-00012', 'lundi 2 novembre', '9h00', '12h00', 'Pommes Gala', '24,40', 'Escalier B', 'Digicode 4521']) {
    assert.ok(mail.html.includes(expected), `HTML sans « ${expected} »`);
    assert.ok(mail.text.includes(expected), `texte sans « ${expected} »`);
  }
});

await test('alerte : client, téléphone, règlement et sujet', () => {
  const mail = renderOrderAlert(order);
  assert.equal(mail.subject, 'Nouvelle commande CF-00012 · Claire Dupont · 24,40 €');
  for (const expected of ['claire@example.com', '06 12 34 56 78', 'à régler']) {
    assert.ok(mail.html.includes(expected) && mail.text.includes(expected), expected);
  }
});

await test('livraison offerte et pas de lien sans SITE_URL', () => {
  const mail = renderOrderConfirmation({ ...order, delivery_fee: 0, total: 19.5 });
  assert.ok(mail.html.includes('Offerte') && mail.text.includes('offerte'));
  assert.ok(!mail.html.includes('compte-commande.html') && !mail.text.includes('compte-commande.html'));
});

await test('liens ajoutés avec SITE_URL valide, ignorés sinon', () => {
  const ok = renderOrderConfirmation(order, { siteUrl: 'https://croqfruit.example/' });
  assert.ok(ok.html.includes(`https://croqfruit.example/compte-commande.html?id=${order.id}`));
  assert.ok(renderOrderAlert(order, { siteUrl: 'https://croqfruit.example' }).text.includes(`https://croqfruit.example/admin/commande.html?id=${order.id}`));
  for (const bad of ['javascript:alert(1)', 'croqfruit.example', 'https://a.example/"><script>', '']) {
    const mail = renderOrderConfirmation(order, { siteUrl: bad });
    assert.ok(!mail.html.includes('compte-commande.html'), `lien accepté pour « ${bad} »`);
  }
});

await test('le HTML saisi par un client est échappé', () => {
  const hostile = {
    ...order,
    customer_name: '<script>alert(1)</script>',
    delivery_notes: '"><img src=x onerror=alert(2)>',
    address_line1: "Rue <b>X</b> & 'Y'",
    order_items: [{ product_name: '<i>Pomme</i> & "co"', unit: '<u>kg</u>', unit_price: 1, quantity: 1, line_total: 1 }],
  };
  for (const mail of [renderOrderConfirmation(hostile), renderOrderAlert(hostile)]) {
    assert.ok(!mail.html.includes('<script>'), 'balise <script> non échappée');
    assert.ok(!mail.html.includes('<img'), 'balise <img> non échappée');
    assert.ok(!/<b>X<\/b>|<i>Pomme|<u>kg/.test(mail.html), 'balise de mise en forme non échappée');
    assert.ok(mail.html.includes('&lt;script&gt;'));
  }
});

await test('pas de retour à la ligne dans l\'objet de l\'email', () => {
  const mail = renderOrderAlert({ ...order, customer_name: 'Pirate\r\nBcc: victime@example.com' });
  assert.ok(!/[\r\n]/.test(mail.subject), JSON.stringify(mail.subject));
  assert.equal(oneLine('a\r\nb\tc'), 'a b c');
});

await test('utilitaires de date et d\'heure', () => {
  assert.equal(formatDay('2026-11-02'), 'lundi 2 novembre');
  assert.equal(formatTime('14:30:00'), '14h30');
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

console.log('Brevo');

await test('requête envoyée à Brevo', async () => {
  let call;
  await sendWithBrevo(
    { apiKey: 'cle-de-test', from: { email: 'commandes@example.com', name: 'CroqFruit' }, to: { email: 'claire@example.com', name: 'Claire' }, subject: 'Sujet', html: '<p>Bonjour</p>', text: 'Bonjour' },
    async (url, init) => { call = { url, init }; return response(201, { messageId: 'x' }); }
  );
  assert.equal(call.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers['api-key'], 'cle-de-test');
  assert.deepEqual(JSON.parse(call.init.body), {
    sender: { name: 'CroqFruit', email: 'commandes@example.com' },
    to: [{ email: 'claire@example.com', name: 'Claire' }],
    subject: 'Sujet',
    htmlContent: '<p>Bonjour</p>',
    textContent: 'Bonjour',
  });
});

await test('classement des erreurs de Brevo', async () => {
  const kindFor = async (status, body) => {
    try {
      await sendWithBrevo({ apiKey: 'k', from: { email: 'a@b.c', name: 'x' }, to: { email: 'd@e.f' }, subject: 's', html: 'h', text: 't' }, async () => response(status, body));
    } catch (error) {
      return { kind: error.kind, message: error.message };
    }
    return null;
  };
  assert.equal((await kindFor(401, { message: 'Key not found' })).kind, 'config');
  assert.equal((await kindFor(403)).kind, 'config');
  assert.equal((await kindFor(429)).kind, 'transient');
  assert.equal((await kindFor(503)).kind, 'transient');
  const bad = await kindFor(400, { code: 'invalid_parameter', message: 'email is not valid' });
  assert.equal(bad.kind, 'permanent');
  assert.equal(bad.message, 'Brevo 400 : email is not valid');
  assert.equal(await kindFor(201), null);

  await assert.rejects(
    sendWithBrevo({ apiKey: 'k', from: { email: 'a@b.c', name: 'x' }, to: { email: 'd@e.f' }, subject: 's', html: 'h', text: 't' }, async () => { throw new TypeError('fetch failed'); }),
    (error) => error instanceof SendError && error.kind === 'transient'
  );
});

console.log('File d\'attente');

await test('envoie la confirmation et l\'alerte, et les marque envoyées', async () => {
  const repo = fakeRepo([row({ id: 'r1' }), row({ id: 'r2', kind: 'order_alert', to_email: 'admin@example.com', to_name: 'Admin' })]);
  const sent = [];
  const result = await processQueue({ repo, send: async (mail) => { sent.push(mail); } });
  assert.deepEqual(result, { sent: 2, retry: 0, failed: 0 });
  assert.deepEqual(repo.log, [['sent', 'r1'], ['sent', 'r2']]);
  assert.equal(sent[0].to.email, 'claire@example.com');
  assert.match(sent[0].subject, /^Confirmation de votre commande/);
  assert.equal(sent[1].to.email, 'admin@example.com');
  assert.match(sent[1].subject, /^Nouvelle commande/);
});

await test('clé API refusée : on réessaie sans compter la tentative', async () => {
  const repo = fakeRepo([row()]);
  const result = await processQueue({ repo, send: async () => { throw new SendError('Brevo 401 : Key not found', 'config'); } });
  assert.deepEqual(result, { sent: 0, retry: 1, failed: 0 });
  assert.deepEqual(repo.log, [['release', 'r1', 'Brevo 401 : Key not found', true]]);
});

await test('panne passagère : nouvelle tentative, puis abandon à la 5e', async () => {
  const boom = async () => { throw new SendError('Brevo 503', 'transient'); };
  const early = fakeRepo([row({ attempts: 2 })]);
  assert.deepEqual(await processQueue({ repo: early, send: boom }), { sent: 0, retry: 1, failed: 0 });
  assert.deepEqual(early.log, [['release', 'r1', 'Brevo 503', false]]);

  const last = fakeRepo([row({ attempts: MAX_ATTEMPTS })]);
  assert.deepEqual(await processQueue({ repo: last, send: boom }), { sent: 0, retry: 0, failed: 1 });
  assert.deepEqual(last.log, [['failed', 'r1', 'Brevo 503']]);
});

await test('erreur inconnue : traitée comme passagère', async () => {
  const repo = fakeRepo([row({ attempts: 1 })]);
  const result = await processQueue({ repo, send: async () => { throw new Error('inattendu'); } });
  assert.deepEqual(result, { sent: 0, retry: 1, failed: 0 });
});

await test('refus définitif ou commande introuvable : abandon immédiat', async () => {
  const refused = fakeRepo([row()]);
  await processQueue({ repo: refused, send: async () => { throw new SendError('Brevo 400 : email is not valid', 'permanent'); } });
  assert.deepEqual(refused.log, [['failed', 'r1', 'Brevo 400 : email is not valid']]);

  const missing = fakeRepo([row({ order_id: 'inconnue' })]);
  let called = false;
  const result = await processQueue({ repo: missing, send: async () => { called = true; } });
  assert.equal(called, false);
  assert.deepEqual(result, { sent: 0, retry: 0, failed: 1 });
  assert.deepEqual(missing.log, [['failed', 'r1', 'Commande introuvable']]);
});

await test('un email en échec n\'empêche pas l\'envoi des suivants', async () => {
  const repo = fakeRepo([row({ id: 'r1', to_email: 'mauvais@example.com' }), row({ id: 'r2' })]);
  const result = await processQueue({
    repo,
    send: async (mail) => { if (mail.to.email === 'mauvais@example.com') throw new SendError('Brevo 400', 'permanent'); },
  });
  assert.deepEqual(result, { sent: 1, retry: 0, failed: 1 });
  assert.deepEqual(repo.log, [['failed', 'r1', 'Brevo 400'], ['sent', 'r2']]);
});

await test('file vide : rien à faire', async () => {
  const result = await processQueue({ repo: fakeRepo([]), send: async () => { throw new Error('ne doit pas être appelé'); } });
  assert.deepEqual(result, { sent: 0, retry: 0, failed: 0 });
});

console.log(`\n${passed} tests réussis${process.exitCode ? ', des échecs ci-dessus' : ''}.`);
