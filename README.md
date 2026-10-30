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
| Espace client | `compte.html`, `compte-commandes.html`, `compte-commande.html`, `compte-informations.html`, `compte-adresses.html` | protégé côté navigateur (redirige vers la connexion) ; contenus = maquettes |
| Légal | `cgv.html`, `mentions-legales.html`, `politique-confidentialite.html`, `cookies.html` | modèles à compléter et à faire valider |
| Administration | `admin/index.html`, `commandes.html`, `commande.html`, `produits.html`, `produit-edition.html`, `clients.html`, `livraisons.html` | maquettes, **pas encore protégées** |

Les maquettes affichent un encadré « Maquette » et leurs boutons sont désactivés tant que la fonctionnalité n'existe pas.

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
js/utils.js         échappement HTML, pastille produit
js/boutique.js, panier.js, commande.js, connexion.js, inscription.js, compte.js   logique par page
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

- `products` — `id`, `name`, `description`, `price`, `unit`, `category`, `image_url`, `in_stock`. Lecture publique seule ; aucun produit n'est codé en dur dans le site.
- `profiles` — `id` (réf. `auth.users`), `full_name`, `role` (`customer` par défaut, `admin` à positionner en base), `created_at`. Remplie automatiquement à l'inscription par un déclencheur ; un client ne peut lire que sa propre ligne.

Les comptes eux-mêmes (email, mot de passe haché, sessions) sont gérés par Supabase Authentication.

À prévoir : commandes, adresses, zones et créneaux de livraison, messages de contact, protection de l'administration par le rôle `admin`.

Remarques :

- Un projet Supabase gratuit se met en pause après une période d'inactivité ; il faut alors le réveiller depuis le tableau de bord (ou passer à une offre payante pour un site en production).
- Les emails de confirmation d'inscription sont soumis à une limite d'envoi sur l'offre gratuite ; un service d'envoi dédié (SMTP) lève cette limite.
