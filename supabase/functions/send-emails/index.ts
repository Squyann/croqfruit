// Fonction Edge « send-emails » : envoie les emails de commande en attente (table public.email_outbox) via Brevo.
//
// Elle est appelée sans authentification (verify_jwt désactivé) : par la base à chaque commande, puis toutes les
// 5 minutes tant qu'il reste des emails en attente. Cela ne pose pas de problème de sécurité, car l'appelant ne
// choisit rien : la fonction n'envoie que ce qui est déjà dans la file, à des destinataires déjà enregistrés.
//
// Réglages (Supabase > Edge Functions > Secrets) :
//   BREVO_API_KEY    clé API Brevo (jamais dans le code ni dans le dépôt)
//   EMAIL_FROM       adresse d'expédition, vérifiée dans Brevo
//   EMAIL_FROM_NAME  nom affiché (facultatif, « CroqFruit » par défaut)
//   SITE_URL         adresse du site en ligne (facultatif ; ajoute des liens dans les emails)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { processQueue, sendWithBrevo } from './sender.mjs';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  const apiKey = Deno.env.get('BREVO_API_KEY');
  const fromEmail = Deno.env.get('EMAIL_FROM');
  // Tant que l'envoi n'est pas configuré, on ne touche à rien : les emails restent en attente.
  if (!apiKey || !fromEmail || !fromEmail.includes('@')) return json({ configured: false });

  const from = { email: fromEmail, name: Deno.env.get('EMAIL_FROM_NAME') || 'CroqFruit' };
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const repo = {
    async claim(limit: number) {
      const { data, error } = await db.rpc('claim_pending_emails', { p_limit: limit });
      if (error) throw error;
      return data ?? [];
    },
    async loadOrder(id: string) {
      const { data, error } = await db.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async markSent(id: string) {
      await db.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', id);
    },
    async release(row: { id: string; attempts: number }, message: string, refundAttempt: boolean) {
      await db
        .from('email_outbox')
        .update({ status: 'pending', claimed_at: null, last_error: message, attempts: refundAttempt ? row.attempts - 1 : row.attempts })
        .eq('id', row.id);
    },
    async markFailed(id: string, message: string) {
      await db.from('email_outbox').update({ status: 'failed', claimed_at: null, last_error: message }).eq('id', id);
    },
  };

  try {
    const result = await processQueue({
      repo,
      siteUrl: Deno.env.get('SITE_URL') ?? undefined,
      send: (mail: { to: { email: string; name?: string }; subject: string; html: string; text: string }) =>
        sendWithBrevo({ apiKey, from, ...mail }),
    });
    return json({ configured: true, ...result });
  } catch (error) {
    console.error('send-emails :', error);
    return json({ configured: true, error: 'Erreur interne' }, 500);
  }
});
