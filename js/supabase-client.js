// Configuration Supabase — à compléter avec les identifiants du projet
// (Réglages du projet > API, dans le tableau de bord Supabase).
//
// L'URL et la clé "anon" sont publiques par conception : elles sont protégées
// par les règles RLS (Row Level Security) côté Supabase, pas par le secret.
// Ne jamais mettre la clé "service_role" ici, elle donne un accès total à la base.
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabaseClient = isSupabaseConfigured
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Schéma attendu pour la table `products` :
//   id          uuid       clé primaire
//   name        text       nom du produit
//   description text       description courte (facultatif)
//   price       numeric    prix en euros
//   unit        text       unité de vente ("kg", "pièce", "botte"...)
//   category    text       catégorie (facultatif)
//   image_url   text       URL de la photo (facultatif)
//   in_stock    boolean    visible dans la boutique
async function fetchProducts() {
  if (!supabaseClient) {
    return { products: [], error: 'not-configured' };
  }

  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .eq('in_stock', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Erreur de chargement des produits :', error);
    return { products: [], error: 'fetch-failed' };
  }

  return { products: data ?? [], error: null };
}
