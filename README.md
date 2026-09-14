# CroqFruit

Site de livraison de fruits et légumes CroqFruit — un primeur qui achète ses produits auprès de producteurs et les livre directement chez les particuliers.

## Contenu

- `index.html` — page d'accueil
- `boutique.html` — boutique en ligne (catalogue + panier)
- `compte.html` — connexion / inscription / tableau de bord client
- `css/style.css` — styles partagés (couleurs, typographie, en-tête, pied de page)
- `css/boutique.css` — styles propres à la boutique (grille produits, panier)
- `css/compte.css` — styles propres au compte (formulaires, tableau de bord)
- `js/supabase-client.js` — connexion à Supabase et récupération des produits
- `js/cart.js` — panier client (persisté dans le navigateur)
- `js/boutique.js` — logique de la page boutique (filtres, grille, panier)
- `js/auth.js` — état de connexion partagé (utilisé sur toutes les pages)
- `js/compte.js` — logique de la page compte (formulaires, tableau de bord)

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

## Comptes clients

L'authentification utilise Supabase Auth (email + mot de passe). À chaque inscription, une ligne est créée automatiquement dans la table `profiles` :

| colonne     | type      | description                                  |
|-------------|-----------|-----------------------------------------------|
| `id`        | uuid      | clé primaire, référence `auth.users`          |
| `full_name` | text      | nom renseigné à l'inscription                 |
| `role`      | text      | `customer` par défaut, `admin` pour la gestion |
| `created_at`| timestamptz | date de création                            |

Un client ne peut lire que sa propre ligne (RLS). Personne ne peut écrire directement dans `profiles` depuis le site : c'est un trigger côté base de données qui crée la ligne à l'inscription — ça évite qu'un client puisse s'attribuer lui-même le rôle `admin`. Pour créer le premier compte admin, passer `role` à `'admin'` directement en base (SQL), une fois qu'un compte existe.

Si le projet Supabase exige la confirmation par email (réglage par défaut), pensez à renseigner l'URL de redirection dans **Authentication > URL Configuration** une fois le site déployé, pour que le lien reçu par email ramène vers `compte.html`.

Les commandes viendront dans une prochaine étape.
