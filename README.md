# CroqFruit

Site de livraison de fruits et légumes CroqFruit — un primeur qui achète ses produits auprès de producteurs et les livre directement chez les particuliers.

## Contenu

- `index.html` — page d'accueil
- `boutique.html` — boutique en ligne (catalogue + panier)
- `css/style.css` — styles partagés (couleurs, typographie, en-tête, pied de page)
- `css/boutique.css` — styles propres à la boutique (grille produits, panier)
- `js/supabase-client.js` — connexion à Supabase et récupération des produits
- `js/cart.js` — panier client (persisté dans le navigateur)
- `js/boutique.js` — logique de la page boutique (filtres, grille, panier)

Aucun produit n'est codé en dur : la boutique affiche uniquement ce qui est présent dans la base Supabase.

## Aperçu local

Ouvrez `index.html` ou `boutique.html` dans un navigateur (aucun serveur ni build requis).

## Connecter Supabase

La boutique a besoin d'un projet Supabase pour afficher des produits :

1. Dans le tableau de bord Supabase du projet : **Project Settings > API**.
2. Copier l'**URL du projet** et la clé **anon / public** (jamais la clé `service_role`, qui reste secrète).
3. Renseigner ces deux valeurs dans `js/supabase-client.js` (`SUPABASE_URL` et `SUPABASE_ANON_KEY`).
4. Créer une table `products` avec au minimum les colonnes :

   | colonne       | type      | description                          |
   |---------------|-----------|---------------------------------------|
   | `id`          | uuid      | clé primaire                          |
   | `name`        | text      | nom du produit                        |
   | `description` | text      | description courte (facultatif)       |
   | `price`       | numeric   | prix en euros                         |
   | `unit`        | text      | unité de vente (`kg`, `pièce`, `botte`...) |
   | `category`    | text      | catégorie (facultatif, sert aux filtres) |
   | `image_url`   | text      | URL de la photo (facultatif)          |
   | `in_stock`    | boolean   | visible dans la boutique              |

La clé anon est protégée par les règles RLS (Row Level Security) de Supabase — la lecture de `products` doit être autorisée en public en lecture seule.

Les comptes clients et les commandes viendront dans une prochaine étape, une fois le projet Supabase partagé.
