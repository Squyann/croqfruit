// Éléments communs à toutes les pages : en-tête, pied de page, menus d'espace.
//
// Chargé dans le <head> (script bloquant) : les balises <site-header>,
// <site-footer> et <dash-nav> sont remplies dès que le navigateur les lit,
// donc sans scintillement. Penser à toujours écrire la balise fermante.
//
// Pages dans un sous-dossier (admin/) : <html data-root="../"> pour que les
// liens restent valides.

// Coordonnées du commerçant : laisser vide tant qu'elles ne sont pas confirmées.
// Rien n'est affiché dans le pied de page pour une valeur vide.
const SITE = {
  email: '',
  phone: '',
  instagram: '',
};

const ROOT = document.documentElement.dataset.root || '';

function logoMark(variant) {
  const ring = variant === 'light' ? 'var(--paper)' : 'var(--red)';
  const fruit = variant === 'light' ? 'var(--red-deep)' : 'var(--paper)';
  const leaf = variant === 'light' ? '' : '<path d="M17 10c.6-2 1.7-3 3.4-3.4" stroke="var(--leaf)" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
  return `<svg class="logo-mark" viewBox="0 0 34 34" fill="none" aria-hidden="true">
    <circle cx="17" cy="17" r="16" fill="${ring}"/>
    <path d="M17 10c3.5 0 6 2.7 6 6.3S20.8 23 17 23s-6-3.1-6-6.7S13.5 10 17 10Z" fill="${fruit}"/>
    ${leaf}
  </svg>`;
}

const LOGO_WORD = '<span class="logo-word">Croq<b>Fruit</b></span>';

const CART_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none"/></svg>`;
const MENU_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const active = this.getAttribute('active') || '';
    const isAdmin = this.getAttribute('variant') === 'admin';

    if (isAdmin) {
      this.innerHTML = `
        <header>
          <div class="wrap nav">
            <a class="logo" href="${ROOT}admin/index.html">${logoMark()}${LOGO_WORD}<span class="admin-tag">Administration</span></a>
            <div class="nav-side">
              <a class="account-link nav-site-link" href="${ROOT}index.html">Voir le site</a>
              <button type="button" class="btn btn-ghost btn-sm" data-logout>Se déconnecter</button>
            </div>
          </div>
        </header>`;
      return;
    }

    const item = (href, label, key) =>
      `<li><a href="${ROOT}${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a></li>`;

    this.innerHTML = `
      <header>
        <div class="wrap nav">
          <a class="logo" href="${ROOT}index.html">${logoMark()}${LOGO_WORD}</a>
          <nav class="nav-main" id="nav-main" aria-label="Navigation principale">
            <ul class="nav-links">
              ${item('boutique.html', 'Boutique', 'boutique')}
              ${item('livraison.html', 'Livraison', 'livraison')}
              ${item('index.html#comment', 'Comment ça marche', '')}
              ${item('a-propos.html', 'Qui sommes-nous', 'a-propos')}
              ${item('contact.html', 'Contact', 'contact')}
              <li data-admin-link hidden><a href="${ROOT}admin/index.html">Administration</a></li>
            </ul>
          </nav>
          <div class="nav-side">
            <a class="account-link" href="${ROOT}admin/index.html" data-admin-link hidden>Administration</a>
            <a class="account-link" href="${ROOT}connexion.html" data-auth-link>Se connecter</a>
            <a class="cart-btn" href="${ROOT}panier.html" data-cart-trigger aria-label="Voir le panier">
              ${CART_ICON}
              <span class="cart-badge" data-cart-badge hidden>0</span>
            </a>
            <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="nav-main" aria-label="Ouvrir le menu">${MENU_ICON}</button>
          </div>
        </div>
      </header>`;

    const header = this.querySelector('header');
    const toggle = this.querySelector('.nav-toggle');
    const setOpen = (open) => {
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    };
    toggle.addEventListener('click', () => setOpen(!header.classList.contains('nav-open')));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    const contact = [
      SITE.email && `<a href="mailto:${SITE.email}">${SITE.email}</a>`,
      SITE.phone && `<a href="tel:${SITE.phone.replace(/\s/g, '')}">${SITE.phone}</a>`,
      SITE.instagram && `<a href="${SITE.instagram}" rel="noopener">Instagram</a>`,
    ].filter(Boolean).join('');

    const link = (href, label) => `<a href="${ROOT}${href}">${label}</a>`;

    this.innerHTML = `
      <footer>
        <div class="wrap footer-grid">
          <div>
            <a class="logo" href="${ROOT}index.html">${logoMark('light')}${LOGO_WORD}</a>
            <p class="footer-tagline">Fruits et légumes sélectionnés par votre primeur auprès de producteurs, livrés chez vous.</p>
            ${contact ? `<div class="footer-col footer-contact">${contact}</div>` : ''}
          </div>
          <div class="footer-col">
            <h5>Le service</h5>
            ${link('boutique.html', 'Boutique')}
            ${link('livraison.html', 'Livraison')}
            ${link('a-propos.html', 'Qui sommes-nous')}
            ${link('faq.html', 'Questions fréquentes')}
            ${link('contact.html', 'Contact')}
          </div>
          <div class="footer-col">
            <h5>Mon espace</h5>
            ${link('compte.html', 'Mon compte')}
            ${link('compte-commandes.html', 'Mes commandes')}
            ${link('panier.html', 'Mon panier')}
          </div>
          <div class="footer-col">
            <h5>Informations</h5>
            ${link('cgv.html', 'Conditions générales de vente')}
            ${link('mentions-legales.html', 'Mentions légales')}
            ${link('politique-confidentialite.html', 'Politique de confidentialité')}
            ${link('cookies.html', 'Cookies')}
          </div>
        </div>
        <div class="wrap footer-bottom">
          <span>© ${new Date().getFullYear()} CroqFruit</span>
          <a href="#">Haut de page ↑</a>
        </div>
      </footer>`;
  }
}

const DASH_SETS = {
  account: {
    label: 'Mon espace',
    items: [
      ['compte.html', 'Aperçu', 'apercu'],
      ['compte-commandes.html', 'Mes commandes', 'commandes'],
      ['compte-informations.html', 'Mes informations', 'informations'],
      ['compte-adresses.html', 'Mes adresses', 'adresses'],
    ],
    extra: `<li data-admin-only hidden><a href="${ROOT}admin/index.html">Administration</a></li>
            <li><button type="button" class="dash-nav-muted" data-logout>Se déconnecter</button></li>`,
  },
  admin: {
    label: 'Administration',
    items: [
      ['admin/index.html', 'Tableau de bord', 'dashboard'],
      ['admin/commandes.html', 'Commandes', 'commandes'],
      ['admin/produits.html', 'Produits', 'produits'],
      ['admin/clients.html', 'Clients', 'clients'],
      ['admin/livraisons.html', 'Livraisons', 'livraisons'],
    ],
    extra: `<li><a class="dash-nav-muted" href="${ROOT}index.html">Retour au site</a></li>`,
  },
};

class DashNav extends HTMLElement {
  connectedCallback() {
    const set = DASH_SETS[this.getAttribute('set')];
    if (!set) return;
    const active = this.getAttribute('active') || '';
    const items = set.items
      .map(([href, label, key]) => `<li><a href="${ROOT}${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a></li>`)
      .join('');
    this.innerHTML = `<nav class="dash-nav" aria-label="${set.label}"><ul>${items}${set.extra}</ul></nav>`;
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);
customElements.define('dash-nav', DashNav);
