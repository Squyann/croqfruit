// Panier client, persisté dans localStorage. Partagé entre toutes les pages.
const CART_STORAGE_KEY = 'croqfruit:cart';

let cartItems = loadCart();
const cartListeners = [];

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  } catch {
    // stockage indisponible (navigation privée, quota...) : le panier reste en mémoire
  }
  cartListeners.forEach((listen) => listen(cartItems));
}

const Cart = {
  getItems() {
    return cartItems;
  },
  getQty(productId) {
    return cartItems.find((item) => item.id === productId)?.qty ?? 0;
  },
  add(product) {
    const existing = cartItems.find((item) => item.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cartItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        image_url: product.image_url || '',
        qty: 1,
      });
    }
    saveCart();
  },
  setQty(productId, qty) {
    if (qty <= 0) {
      cartItems = cartItems.filter((item) => item.id !== productId);
    } else {
      const existing = cartItems.find((item) => item.id === productId);
      if (existing) existing.qty = qty;
    }
    saveCart();
  },
  remove(productId) {
    cartItems = cartItems.filter((item) => item.id !== productId);
    saveCart();
  },
  getCount() {
    return cartItems.reduce((sum, item) => sum + item.qty, 0);
  },
  getSubtotal() {
    return cartItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  },
  subscribe(listen) {
    cartListeners.push(listen);
    listen(cartItems);
  },
};

function formatPrice(value) {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function renderCartBadge() {
  document.querySelectorAll('[data-cart-badge]').forEach((badge) => {
    const count = Cart.getCount();
    badge.textContent = String(count);
    badge.hidden = count === 0;
  });
}

Cart.subscribe(renderCartBadge);
