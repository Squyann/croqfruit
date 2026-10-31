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
  clear() {
    cartItems = [];
    saveCart();
  },
  // Aligne le panier sur le catalogue actuel (nom, prix, unité) et retire les produits
  // devenus indisponibles. Renvoie les noms des produits retirés et de ceux dont le prix a changé.
  async syncWithCatalog() {
    const result = { removed: [], repriced: [] };
    if (!supabaseClient || cartItems.length === 0) return result;

    const { data, error } = await supabaseClient
      .from('products')
      .select('id, name, price, unit, image_url')
      .in('id', cartItems.map((item) => item.id));
    if (error) return result; // hors ligne ou panier ancien : on laisse le panier tel quel

    const fresh = new Map(data.map((product) => [product.id, product]));
    cartItems = cartItems.filter((item) => {
      if (fresh.has(item.id)) return true;
      result.removed.push(item.name);
      return false;
    });
    cartItems.forEach((item) => {
      const product = fresh.get(item.id);
      if (Number(product.price) !== Number(item.price)) result.repriced.push(product.name);
      Object.assign(item, {
        name: product.name,
        price: product.price,
        unit: product.unit,
        image_url: product.image_url || '',
      });
    });
    saveCart();
    return result;
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

function renderCartBadge() {
  document.querySelectorAll('[data-cart-badge]').forEach((badge) => {
    const count = Cart.getCount();
    badge.textContent = String(count);
    badge.hidden = count === 0;
  });
}

Cart.subscribe(renderCartBadge);
