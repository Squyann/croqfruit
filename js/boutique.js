let allProducts = [];
let productsById = new Map();
let activeCategory = 'all';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function productInitial(name) {
  return escapeHtml((name || '?').trim().charAt(0).toUpperCase());
}

function renderMedia(product, sizeClass) {
  if (product.image_url) {
    return `<img src="${escapeHtml(product.image_url)}" alt="" loading="lazy">`;
  }
  return `<span class="product-placeholder ${sizeClass || ''}">${productInitial(product.name)}</span>`;
}

function renderQtyControl(productId) {
  const qty = Cart.getQty(productId);
  if (qty === 0) {
    return `<button type="button" class="btn btn-primary btn-sm" data-action="add">Ajouter</button>`;
  }
  return `
    <div class="stepper" role="group" aria-label="Quantité">
      <button type="button" data-action="decrement" aria-label="Retirer un">−</button>
      <span class="stepper-qty">${qty}</span>
      <button type="button" data-action="increment" aria-label="Ajouter un">+</button>
    </div>`;
}

function updateCardControl(productId) {
  const card = document.querySelector(`.product-card[data-product-id="${productId}"] [data-qty-control]`);
  if (card) card.innerHTML = renderQtyControl(productId);
}

function renderProductCard(product) {
  return `
    <article class="product-card" data-product-id="${product.id}">
      <div class="product-media">${renderMedia(product)}</div>
      <div class="product-body">
        ${product.category ? `<span class="product-category">${escapeHtml(product.category)}</span>` : ''}
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        ${product.description ? `<p class="product-desc">${escapeHtml(product.description)}</p>` : ''}
        <div class="product-row">
          <span class="product-price">${formatPrice(product.price)} <span class="product-unit">/ ${escapeHtml(product.unit)}</span></span>
          <div data-qty-control>${renderQtyControl(product.id)}</div>
        </div>
      </div>
    </article>`;
}

function renderFilters(categories) {
  const container = document.getElementById('filters');
  if (categories.length <= 1) {
    container.innerHTML = '';
    return;
  }
  const chips = ['all', ...categories];
  container.innerHTML = chips
    .map((cat) => {
      const label = cat === 'all' ? 'Tous' : escapeHtml(cat);
      const active = cat === activeCategory ? ' is-active' : '';
      return `<button type="button" class="filter-chip${active}" data-category="${escapeHtml(cat)}">${label}</button>`;
    })
    .join('');
}

function renderGrid() {
  const grid = document.getElementById('products-grid');
  const visible = activeCategory === 'all' ? allProducts : allProducts.filter((p) => p.category === activeCategory);

  if (visible.length === 0) {
    grid.innerHTML = '<p class="state-message">Aucun produit dans cette catégorie pour le moment.</p>';
    return;
  }
  grid.innerHTML = visible.map(renderProductCard).join('');
}

function showState(message, detail) {
  document.getElementById('filters').innerHTML = '';
  document.getElementById('products-grid').innerHTML = `
    <div class="state-message">
      <strong>${escapeHtml(message)}</strong>
      ${detail ? escapeHtml(detail) : ''}
    </div>`;
}

async function loadProducts() {
  showState('Chargement des produits…');

  const { products, error } = await fetchProducts();

  if (error === 'not-configured') {
    showState(
      'La boutique n’est pas encore connectée à la base de données.',
      'Revenez bientôt pour découvrir nos produits en ligne.'
    );
    return;
  }
  if (error) {
    showState(
      'Impossible de charger les produits pour le moment.',
      'Merci de réessayer dans quelques instants.'
    );
    return;
  }
  if (products.length === 0) {
    showState('Aucun produit disponible pour le moment.', 'Revenez bientôt, la sélection change chaque semaine.');
    return;
  }

  allProducts = products;
  productsById = new Map(products.map((p) => [p.id, p]));

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  renderFilters(categories);
  renderGrid();
}

// ---------- interactions sur la grille ----------
document.getElementById('products-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const card = button.closest('.product-card');
  const productId = card?.dataset.productId;
  if (!productId) return;

  const action = button.dataset.action;
  if (action === 'add') {
    const product = productsById.get(productId) ?? allProducts.find((p) => String(p.id) === productId);
    if (product) Cart.add(product);
  } else if (action === 'increment') {
    Cart.setQty(productId, Cart.getQty(productId) + 1);
  } else if (action === 'decrement') {
    Cart.setQty(productId, Cart.getQty(productId) - 1);
  }
  updateCardControl(productId);
});

document.getElementById('filters').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-category]');
  if (!chip) return;
  activeCategory = chip.dataset.category;
  document.querySelectorAll('.filter-chip').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.category === activeCategory);
  });
  renderGrid();
});

// ---------- panier ----------
function renderCartDrawer() {
  const list = document.getElementById('cart-drawer-items');
  const items = Cart.getItems();

  if (items.length === 0) {
    list.innerHTML = '<p class="cart-empty">Votre panier est vide.</p>';
  } else {
    list.innerHTML = items.map(renderCartRow).join('');
  }
  document.getElementById('cart-subtotal').textContent = formatPrice(Cart.getSubtotal());
}

function renderCartRow(item) {
  return `
    <li class="cart-row" data-product-id="${item.id}">
      <div class="cart-row-media">${renderMedia(item)}</div>
      <div class="cart-row-info">
        <span class="cart-row-name">${escapeHtml(item.name)}</span>
        <span class="cart-row-price">${formatPrice(item.price)} / ${escapeHtml(item.unit)}</span>
      </div>
      <div class="cart-row-actions">
        <div class="stepper" role="group" aria-label="Quantité">
          <button type="button" data-action="decrement" aria-label="Retirer un">−</button>
          <span class="stepper-qty">${item.qty}</span>
          <button type="button" data-action="increment" aria-label="Ajouter un">+</button>
        </div>
        <button type="button" class="cart-row-remove" data-action="remove" aria-label="Retirer ${escapeHtml(item.name)} du panier">✕</button>
      </div>
    </li>`;
}

document.getElementById('cart-drawer-items').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const row = button.closest('.cart-row');
  const productId = row?.dataset.productId;
  if (!productId) return;

  const action = button.dataset.action;
  if (action === 'increment') {
    Cart.setQty(productId, Cart.getQty(productId) + 1);
  } else if (action === 'decrement') {
    Cart.setQty(productId, Cart.getQty(productId) - 1);
  } else if (action === 'remove') {
    Cart.remove(productId);
  }
  updateCardControl(productId);
});

function openCart() {
  document.body.classList.add('cart-open');
  document.getElementById('cart-drawer').setAttribute('aria-hidden', 'false');
}
function closeCart() {
  document.body.classList.remove('cart-open');
  document.getElementById('cart-drawer').setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('[data-cart-trigger]').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openCart();
  });
});
document.getElementById('cart-close').addEventListener('click', closeCart);
document.getElementById('cart-backdrop').addEventListener('click', closeCart);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeCart();
});

Cart.subscribe(renderCartDrawer);

if (window.location.hash === '#panier') openCart();

loadProducts();
