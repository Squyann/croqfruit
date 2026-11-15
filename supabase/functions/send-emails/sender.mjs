// Envoi des emails en attente. Aucune dépendance à Deno ni à Supabase : la base (`repo`) et l'envoi (`send`)
// sont injectés, ce qui permet de tester toute la logique (voir test.mjs).
import { renderOrderAlert, renderOrderConfirmation } from './templates.mjs';

export const MAX_ATTEMPTS = 5;
export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Erreur d'envoi, classée selon ce qu'il faut en faire :
 *  - 'config'    : clé API ou expéditeur refusés (réglage à corriger) → on réessaie sans compter la tentative ;
 *  - 'transient' : panne passagère (réseau, limite de débit, erreur serveur) → on réessaie, 5 tentatives au plus ;
 *  - 'permanent' : l'email ne partira jamais (adresse refusée, commande introuvable) → abandon immédiat.
 */
export class SendError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind;
  }
}

function kindForStatus(status) {
  if (status === 401 || status === 403) return 'config';
  if (status === 429 || status >= 500) return 'transient';
  return 'permanent';
}

/** Envoie un email par l'API transactionnelle de Brevo. */
export async function sendWithBrevo({ apiKey, from, to, subject, html, text }, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: from.name, email: from.email },
        to: [to.name ? { email: to.email, name: to.name } : { email: to.email }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
  } catch (error) {
    throw new SendError(`Réseau : ${error?.message ?? error}`, 'transient');
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body.message || body.code || '';
    } catch {
      // réponse sans corps JSON
    }
    throw new SendError(`Brevo ${response.status}${detail ? ` : ${detail}` : ''}`, kindForStatus(response.status));
  }
}

/**
 * Traite un lot d'emails en attente.
 * @param {object} deps
 * @param {{ claim(limit: number): Promise<object[]>, loadOrder(id: string): Promise<object|null>,
 *           markSent(id: string): Promise<void>, release(row: object, message: string, refundAttempt: boolean): Promise<void>,
 *           markFailed(id: string, message: string): Promise<void> }} deps.repo
 * @param {(mail: object) => Promise<void>} deps.send reçoit { to, subject, html, text }
 * @param {string} [deps.siteUrl]
 */
export async function processQueue({ repo, send, siteUrl, batchSize = 10 }) {
  const result = { sent: 0, retry: 0, failed: 0 };
  const rows = await repo.claim(batchSize);

  for (const row of rows) {
    try {
      const order = await repo.loadOrder(row.order_id);
      if (!order) throw new SendError('Commande introuvable', 'permanent');

      const render = row.kind === 'order_alert' ? renderOrderAlert : renderOrderConfirmation;
      const mail = render(order, { siteUrl });
      await send({ ...mail, to: { email: row.to_email, name: row.to_name } });

      await repo.markSent(row.id);
      result.sent += 1;
    } catch (error) {
      const kind = error instanceof SendError ? error.kind : 'transient';
      const message = String(error?.message ?? error).slice(0, 300);

      if (kind === 'permanent' || (kind === 'transient' && row.attempts >= MAX_ATTEMPTS)) {
        await repo.markFailed(row.id, message);
        result.failed += 1;
      } else {
        await repo.release(row, message, kind === 'config');
        result.retry += 1;
      }
    }
  }
  return result;
}
