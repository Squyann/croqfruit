// Affiche le contenu du panier (lecture/écriture sur panier.html, lecture seule sur commande.html).
// Dépend de cart.js et utils.js.
const linesEl = document.querySelector('[data-cart-lines]');
const editable = linesEl.hasAttribute('data-editable');
const contentEl = document.querySelector('[data-cart-content]');
const emptyEl = document.querySelector('[data-cart-empty]');

function renderLine(item) {
  const qty = editable
    ? `<div class="stepper line-qty" role="group" aria-label="Quantité de ${escapeHtml(item.name)}">
         <button type="button" data-action="decrement" aria-label="Retirer un">−</button>
         <span class="stepper-qty">${item.qty}</span>
         <button type="button" data-action="increment" aria-label="Ajouter un">+</button>
       </div>`
    : '';
  const unitLabel = `${formatPrice(item.price)} / ${escapeHtml(item.unit)}${editable ? '' : ` × ${item.qty}`}`;

  return `
    <li class="line" data-product-id="${escapeHtml(item.id)}">
      <div class="line-media">${renderMedia(item)}</div>
      <div class="line-info">
        <span class="line-name">${escapeHtml(item.name)}</span>
        <span class="line-unit">${unitLabel}</span>
        ${editable ? '<button type="button" class="line-remove" data-action="remove">Retirer</button>' : ''}
      </div>
      ${qty}
      <span class="line-total">${formatPrice(item.qty * item.price)}</span>
    </li>`;
}

function renderCartPage() {
  const items = Cart.getItems();
  const isEmpty = items.length === 0;

  contentEl.hidden = isEmpty;
  emptyEl.hidden = !isEmpty;
  linesEl.innerHTML = items.map(renderLine).join('');

  document.querySelectorAll('[data-cart-subtotal]').forEach((el) => {
    el.textContent = formatPrice(Cart.getSubtotal());
  });
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    const count = Cart.getCount();
    el.textContent = `${count} article${count > 1 ? 's' : ''}`;
  });
}

linesEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  const line = button?.closest('.line');
  if (!line) return;

  const productId = line.dataset.productId;
  const action = button.dataset.action;
  if (action === 'increment') Cart.setQty(productId, Cart.getQty(productId) + 1);
  else if (action === 'decrement') Cart.setQty(productId, Cart.getQty(productId) - 1);
  else if (action === 'remove') Cart.remove(productId);
});

Cart.subscribe(renderCartPage);
