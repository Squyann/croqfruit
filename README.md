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
| Vitrine | `index.html`, `boutique.html`, `livraison.html`, `a-propos.html`, `contact.html`, `faq.html`, `404.html` | contenu écrit ; textes à compléter signalés ; `livraison.html` affiche zones, créneaux et frais lus en base et vérifie le code postal ; le formulaire de `contact.html` enregistre les messages en base |
| Achat | `boutique.html` (voir ci-dessus), `panier.html`, `commande.html`, `commande-confirmee.html` | panier, commande et confirmation **fonctionnels**. Il n'y a pas de fiche produit : tout est dans la boutique |
| Compte | `connexion.html`, `inscription.html` (fonctionnelles), `mot-de-passe-oublie.html`, `reinitialiser-mot-de-passe.html` (maquettes) | |
| Espace client | `compte.html`, `compte-commandes.html`, `compte-commande.html`, `compte-informations.html`, `compte-adresses.html` | protégé côté navigateur (redirige vers la connexion) ; aperçu avec la dernière commande, historique et détail des commandes, carnet d'adresses, changement de mot de passe fonctionnels ; le reste (nom et téléphone de « Mes informations », export et suppression des données) = maquettes |
| Légal | `cgv.html`, `mentions-legales.html`, `politique-confidentialite.html`, `cookies.html` | modèles à compléter et à faire valider |
| Administration | `admin/index.html`, `produits.html`, `produit-edition.html`, `clients.html`, `commandes.html`, `commande.html`, `livraisons.html` | **fonctionnelles**, réservées au rôle `admin` |

Les maquettes affichent un encadré « Maquette » et leurs boutons sont désactivés tant que la fonctionnalité n'existe pas.

## Administration

Un compte devient administrateur quand sa ligne `profiles.role` vaut `admin` (à positionner en SQL depuis le tableau de bord Supabase : `update public.profiles set role = 'admin' where email = '…';`). Depuis le site, **personne ne peut modifier ce champ**.

- Un admin voit un lien « Administration » dans l'en-tête et dans son espace client.
- Les pages `admin/` redirigent vers la connexion si on n'est pas connecté, et affichent « Accès réservé » pour un compte non-admin. **C'est un simple confort d'affichage** : la vraie protection est dans la base (règles RLS, testées) — un non-admin ne peut ni lire les produits masqués, ni la liste des clients, ni écrire quoi que ce soit.
- Produits : ajout, modification, masquage / mise en vente, suppression, photo (JPG, PNG ou WebP, 3 Mo max) envoyée dans le bucket `product-images`. Un produit masqué (`in_stock = false`) n'apparaît pas dans la boutique.
  Chaque produit de la boutique affiche sa photo, son prix, sa provenance (facultative) et une petite bulle « i » avec sa description (facultative, la bulle n'apparaît que s'il y en a une). Pour un produit qui n'est pas vendu au kilo (botte, pièce, barquette…), renseigner le **poids d'une unité en grammes** fait afficher aussi le prix au kilo (« soit 6,00 € / kg »).
- Clients : liste des comptes inscrits (nom, email, date).
- Commandes : liste filtrable (recherche, statut, jour de livraison), fiche commande avec changement de statut, suivi du règlement et note interne.
- Livraisons : tournées à venir, zones desservies et créneaux (voir ci-dessous).
- Messages : boîte de réception du formulaire de contact (voir ci-dessous).

## Formulaire de contact

Le formulaire de `contact.html` enregistre chaque message dans la table `contact_messages`. **Le site n'envoie aucun email** : les messages se lisent dans l'administration (page « Messages », avec un compteur de messages non lus sur le tableau de bord), et le bouton « Répondre par email » ouvre la messagerie de l'admin. Un message ouvert est marqué comme lu ; l'admin peut aussi le marquer comme traité, le remettre en non lu ou le supprimer.

- **Antispam** : un champ caché que seuls les robots remplissent (leur envoi est ignoré sans rien enregistrer) et, côté base, au plus 3 messages par adresse email et par heure et 100 messages par heure au total. Si du spam passe malgré tout, la suite logique est d'ajouter un test anti-robot (par exemple Cloudflare Turnstile).
- **Conservation** : aucun message n'est supprimé automatiquement. La durée de conservation à annoncer figure dans la politique de confidentialité (ligne « Répondre à vos messages », zone surlignée) ; il faudra supprimer les anciens messages à la main, ou ajouter une purge automatique une fois la durée choisie.
- Un client connecté a son nom et son email préremplis ; son message est alors rattaché à son compte.

## Commandes et livraisons

**Pour que les clients puissent commander, il faut définir au moins une zone et un créneau** dans `admin/livraisons.html`. Tant que ce n'est pas fait, la page de commande affiche « La prise de commande n'est pas encore ouverte ».

- **Zone** : un nom, un ou plusieurs codes postaux (un code ne peut appartenir qu'à une zone), des frais de livraison, un seuil optionnel au-delà duquel la livraison est offerte, et un minimum de commande.
- **Créneau** : un jour de la semaine, une plage horaire et une capacité (nombre de commandes acceptées ce jour-là sur ce créneau). Une commande annulée libère sa place.
- **Fenêtre de livraison** : le client choisit un jour entre demain et dans 14 jours (heure de Paris), parmi les créneaux définis. Ces deux bornes sont codées dans `private.delivery_window()` côté base ; il n'y a pas encore d'heure limite de commande.
- **Création d'une commande** : uniquement par la fonction `place_order` de la base. Le navigateur n'envoie que des identifiants de produits et des quantités ; les prix, les frais, le minimum de commande, la zone et la capacité du créneau sont vérifiés et recalculés par la base, qui conserve une copie des noms et prix au moment de l'achat. Un client ne peut ni choisir son prix ni créer une commande autrement.
- **Statuts** : En attente → En préparation → En livraison → Livrée (ou Annulée), modifiables par l'admin.
- **Paiement** : le site n'encaisse rien pour l'instant. Chaque commande a un état de règlement (à régler / payée / remboursée) que l'admin renseigne à la main. Les modalités de paiement sont à définir avec le primeur (zone surlignée dans `commande.html` et `commande-confirmee.html`).

## Structure

```
css/style.css       styles communs (couleurs, typo, en-tête, formulaires, tableaux, pages légales…)
css/home.css        accueil uniquement
css/boutique.css    boutique (cartes produit, bulle de description), tiroir panier
css/dashboard.css   espace client et administration
js/layout.js        en-tête, pied de page et menus (balises <site-header>, <site-footer>, <dash-nav>)
js/supabase-client.js   connexion Supabase + lecture des produits
js/auth.js          état de connexion partagé, déconnexion, messages d'erreur
js/cart.js          panier (stocké dans le navigateur)
js/utils.js         échappement HTML, formats prix / date / créneau / adresse, statuts de commande, messages de page, pastille produit
js/admin.js         garde des pages admin + envoi / suppression des photos produit
js/boutique.js, panier.js, commande.js, commande-confirmee.js, livraison.js, contact.js, connexion.js, inscription.js,
  compte.js, compte-apercu.js, compte-commandes.js, compte-commande.js, compte-adresses.js, compte-informations.js   logique par page
js/admin-dashboard.js, admin-produits.js, admin-produit-edition.js, admin-clients.js,
  admin-commandes.js, admin-commande.js, admin-livraisons.js, admin-messages.js            logique des pages admin
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

- `products` — `id`, `name`, `description`, `price`, `unit`, `unit_weight_grams` (poids d'une unité, pour le prix au kilo), `origin` (provenance), `category`, `image_url`, `in_stock`. Le public ne lit que les produits `in_stock` ; seul un admin peut créer, modifier, supprimer ou voir les produits masqués. Aucun produit n'est codé en dur dans le site.
- `profiles` — `id` (réf. `auth.users`), `full_name`, `email`, `role` (`customer` par défaut, `admin` à positionner en base), `created_at`. Remplie automatiquement à l'inscription par un déclencheur ; un client ne lit que sa propre ligne, un admin lit toutes les lignes.
- `delivery_zones` (nom, codes postaux, frais, seuil de gratuité, minimum) et `delivery_slots` (jour, plage horaire, capacité) — lisibles par tous (la page « Livraison » et le formulaire de commande en ont besoin), modifiables par un admin uniquement.
- `orders` — commande avec coordonnées et adresse recopiées au moment de l'achat, créneau, montants, statut, règlement, note interne. Un client ne lit que ses commandes, un admin les lit toutes et peut les modifier ; **personne ne peut en insérer directement** : tout passe par `place_order`.
- `order_items` — lignes d'une commande (nom, unité, prix unitaire et quantité figés à l'achat), visibles avec leur commande.
- `addresses` — carnet d'adresses d'un client (nom, adresse, instructions pour le livreur, adresse par défaut). Chacun ne voit et ne modifie que les siennes (même pas l'admin : une commande garde sa propre copie de l'adresse). Règles imposées par la base : 10 adresses au maximum, une seule adresse par défaut, la première adresse enregistrée l'est d'office. À la commande, l'adresse par défaut est préremplie et le client peut en choisir une autre ou enregistrer celle qu'il vient de saisir.
- `contact_messages` — messages du formulaire de contact (nom, email, sujet, message, statut nouveau / lu / traité). **N'importe quel visiteur peut en écrire, seul un admin peut les lire, modifier ou supprimer** ; un visiteur ne peut ni choisir le statut ni écrire au nom d'un autre compte. Un déclencheur limite le volume (voir « Formulaire de contact »).
- Stockage : bucket public `product-images` (lecture publique, écriture réservée aux admins).
- Fonctions : `private.is_admin()` (règles RLS), `private.create_order()` (enregistre la commande) et `private.delivery_availability()` (places restantes par créneau) vivent dans le schéma `private`, non exposé par l'API ; seules les enveloppes `public.place_order()` et `public.get_delivery_availability()` sont appelables, par les comptes connectés.

Les comptes eux-mêmes (email, mot de passe haché, sessions) sont gérés par Supabase Authentication.

À prévoir : paiement en ligne, envoi d'emails automatiques (confirmation de commande, réponse aux messages).

Remarques :

- Un projet Supabase gratuit se met en pause après une période d'inactivité ; il faut alors le réveiller depuis le tableau de bord (ou passer à une offre payante pour un site en production).
- Les emails de confirmation d'inscription sont soumis à une limite d'envoi sur l'offre gratuite ; un service d'envoi dédié (SMTP) lève cette limite.
