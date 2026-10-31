# CroqFruit

Site de livraison de fruits et légumes : un primeur qui achète ses produits auprès de producteurs et les livre chez des particuliers. Site statique (HTML / CSS / JavaScript, aucun outil de build), avec Supabase pour les produits, les comptes et — bientôt — les commandes.

## Aperçu local

Ouvrir une page dans un navigateur, ou lancer un petit serveur depuis ce dossier :

```bash
python -m http.server 5173
```

## Pages

| Zone | Pages | État |
|---|---|---|
| Vitrine | `index.html`, `boutique.html`, `livraison.html`, `a-propos.html`, `contact.html`, `faq.html`, `404.html` | contenu écrit ; textes à compléter signalés |
| Achat | `produit.html`, `panier.html`, `commande.html`, `commande-confirmee.html` | panier fonctionnel ; fiche produit, commande et confirmation = maquettes |
| Compte | `connexion.html`, `inscription.html` (fonctionnelles), `mot-de-passe-oublie.html`, `reinitialiser-mot-de-passe.html` (maquettes) | |
| Espace client | `compte.html`, `compte-commandes.html`, `compte-commande.html`, `compte-informations.html`, `compte-adresses.html` | protégé côté navigateur (redirige vers la connexion) ; changement de mot de passe fonctionnel, le reste = maquettes |
| Légal | `cgv.html`, `mentions-legales.html`, `politique-confidentialite.html`, `cookies.html` | modèles à compléter et à faire valider |
| Administration | `admin/index.html`, `produits.html`, `produit-edition.html`, `clients.html` | **fonctionnelles**, réservées au rôle `admin` |
| Administration (à venir) | `admin/commandes.html`, `commande.html`, `livraisons.html` | maquettes (en attente des tables commandes / livraisons) |

Les maquettes affichent un encadré « Maquette » et leurs boutons sont désactivés tant que la fonctionnalité n'existe pas.

## Administration

Un compte devient administrateur quand sa ligne `profiles.role` vaut `admin` (à positionner en SQL depuis le tableau de bord Supabase : `update public.profiles set role = 'admin' where email = '…';`). Depuis le site, **personne ne peut modifier ce champ**.

- Un admin voit un lien « Administration » dans l'en-tête et dans son espace client.
- Les pages `admin/` redirigent vers la connexion si on n'est pas connecté, et affichent « Accès réservé » pour un compte non-admin. **C'est un simple confort d'affichage** : la vraie protection est dans la base (règles RLS, testées) — un non-admin ne peut ni lire les produits masqués, ni la liste des clients, ni écrire quoi que ce soit.
- Produits : ajout, modification, masquage / mise en vente, suppression, photo (JPG, PNG ou WebP, 3 Mo max) envoyée dans le bucket `product-images`. Un produit masqué (`in_stock = false`) n'apparaît pas dans la boutique.
- Clients : liste des comptes inscrits (nom, email, date).

## Structure

```
css/style.css       styles communs (couleurs, typo, en-tête, formulaires, tableaux, pages légales…)
css/home.css        accueil uniquement
css/boutique.css    boutique, fiche produit, tiroir panier
css/dashboard.css   espace client et administration
js/layout.js        en-tête, pied de page et menus (balises <site-header>, <site-footer>, <dash-nav>)
js/supabase-client.js   connexion Supabase + lecture des produits
js/auth.js          état de connexion partagé, déconnexion, messages d'erreur
js/cart.js          panier (stocké dans le navigateur)
js/utils.js         échappement HTML, formats prix / date, pastille produit
js/admin.js         garde des pages admin + envoi / suppression des photos produit
js/boutique.js, panier.js, commande.js, connexion.js, inscription.js, compte.js, compte-informations.js   logique par page
js/admin-dashboard.js, admin-produits.js, admin-produit-edition.js, admin-clients.js            logique des pages admin
```

### Modifier l'en-tête, le pied de page ou la navigation

Tout est dans `js/layout.js` : une seule modification s'applique à toutes les pages. Les pages dans `admin/` déclarent `<html data-root="../">` pour que les liens restent valides. Toujours écrire la balise fermante (`<site-header ...></site-header>`).

### Coordonnées du commerçant

L'objet `SITE` en haut de `js/layout.js` (email, téléphone, Instagram) alimente le pied de page. **Rien n'est affiché tant qu'une valeur est vide** : aucune coordonnée n'est inventée.

### Textes à compléter

Les champs surlignés (`<mark class="todo">`) sont à remplir avec les vraies informations de l'entreprise : raison sociale, SIRET, médiateur, zones et frais de livraison, moyens de paiement, etc. Pour les retrouver : chercher `class="todo"` dans le projet.

## Supabase

Projet : **CroqFruit** (région UE, Irlande). L'URL et la clé publique (`sb_publishable_…`) sont dans `js/supabase-client.js` — elles sont publiques par conception, la sécurité repose sur les règles RLS. Ne jamais mettre une clé `service_role` / `sb_secret_…` dans le code du site.

Tables actuelles :

- `products` — `id`, `name`, `description`, `price`, `unit`, `category`, `image_url`, `in_stock`. Le public ne lit que les produits `in_stock` ; seul un admin peut créer, modifier, supprimer ou voir les produits masqués. Aucun produit n'est codé en dur dans le site.
- `profiles` — `id` (réf. `auth.users`), `full_name`, `email`, `role` (`customer` par défaut, `admin` à positionner en base), `created_at`. Remplie automatiquement à l'inscription par un déclencheur ; un client ne lit que sa propre ligne, un admin lit toutes les lignes.
- Stockage : bucket public `product-images` (lecture publique, écriture réservée aux admins).
- La fonction `private.is_admin()` (schéma `private`, non exposé par l'API) sert aux règles RLS.

Les comptes eux-mêmes (email, mot de passe haché, sessions) sont gérés par Supabase Authentication.

À prévoir : commandes, adresses, zones et créneaux de livraison, messages de contact.

Remarques :

- Un projet Supabase gratuit se met en pause après une période d'inactivité ; il faut alors le réveiller depuis le tableau de bord (ou passer à une offre payante pour un site en production).
- Les emails de confirmation d'inscription sont soumis à une limite d'envoi sur l'offre gratuite ; un service d'envoi dédié (SMTP) lève cette limite.
