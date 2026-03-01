(() => {
  const API_BASE = '/api';
  const TOKEN_KEY = 'authToken';
  const GUEST_CART_KEY = 'guestCart';
  const CHECKOUT_COUPON_KEY = 'checkoutCouponCode';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const isAuthenticated = () => Boolean(getToken());

  const api = async (url, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
    const payload = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : null;

    if (!response.ok) throw new Error(payload?.message || `Request failed (${response.status})`);
    return payload;
  };

  const parseJson = (value, fallback = []) => {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_e) { return fallback; }
  };

  const currency = (v) => `₹${Number(v || 0).toFixed(2)}`;

  const bindHeaderNav = () => {
    const cartBtn = Array.from(document.querySelectorAll('header button')).find((button) => {
      const icon = button.querySelector('.material-symbols-outlined');
      return icon && icon.textContent.trim() === 'shopping_bag';
    });

    if (cartBtn) cartBtn.addEventListener('click', () => { window.location.href = '/cart'; });

    document.querySelectorAll('header a, nav a').forEach((link) => {
      const t = (link.textContent || '').trim().toLowerCase();
      if (t === 'home') link.href = '/';
      if (t === 'shop all' || t === 'shop') link.href = '/productlist';
      if (t === 'account') link.href = '/orderhistory';
    });
  };

  const getGuestCart = () => {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? parseJson(raw, []) : [];
  };

  const setGuestCart = (items) => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  };

  const getStoredCouponCode = () => (sessionStorage.getItem(CHECKOUT_COUPON_KEY) || '').trim().toUpperCase();
  const setStoredCouponCode = (code) => {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) {
      sessionStorage.removeItem(CHECKOUT_COUPON_KEY);
      return;
    }
    sessionStorage.setItem(CHECKOUT_COUPON_KEY, normalized);
  };

  const fetchGuestDetails = async (items) => {
    const output = [];
    for (const item of items) {
      const variation = await api(`/products/variation/${item.variation_id}`);
      output.push({
        id: item.variation_id,
        variation_id: item.variation_id,
        quantity: item.quantity,
        variation,
        line_total: Number(variation.price) * Number(item.quantity)
      });
    }
    return output;
  };

  const createCartItemTemplate = () => {
    const row = document.createElement('div');
    row.className = 'flex flex-row items-center gap-6 p-2 bg-white rounded-xl border border-slate-200';

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'w-32 h-32 flex-shrink-0 bg-primary/5 rounded-lg overflow-hidden border border-slate-200';

    const image = document.createElement('img');
    image.className = 'w-full h-full object-cover';
    image.alt = '';
    mediaWrap.appendChild(image);

    const content = document.createElement('div');
    content.className = 'flex-1 flex flex-col justify-between h-full';

    const top = document.createElement('div');
    const headingWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'text-lg font-bold text-slate-800';
    const detail = document.createElement('p');
    detail.className = 'text-sm text-slate-500';
    headingWrap.appendChild(title);
    headingWrap.appendChild(detail);

    const lineTotal = document.createElement('p');
    lineTotal.className = 'text-lg font-bold text-emerald-600';

    top.appendChild(headingWrap);
    top.appendChild(lineTotal);

    const actions = document.createElement('div');
    actions.className = 'flex items-center justify-between mt-2';

    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'flex items-center bg-slate-100 rounded-lg px-2 py-1';

    const minusButton = document.createElement('button');
    minusButton.className = 'w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-all duration-200 text-slate-600 hover:text-slate-900';
    minusButton.type = 'button';
    const minusIcon = document.createElement('span');
    minusIcon.className = 'material-symbols-outlined text-base';
    minusIcon.textContent = 'remove';
    minusButton.appendChild(minusIcon);

    const qtyText = document.createElement('span');
    qtyText.className = 'w-8 text-center font-semibold text-sm text-slate-700';
    qtyText.textContent = '1';

    const plusButton = document.createElement('button');
    plusButton.className = 'w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-all duration-200 text-slate-600 hover:text-slate-900';
    plusButton.type = 'button';
    const plusIcon = document.createElement('span');
    plusIcon.className = 'material-symbols-outlined text-base';
    plusIcon.textContent = 'add';
    plusButton.appendChild(plusIcon);

    qtyWrap.appendChild(minusButton);
    qtyWrap.appendChild(qtyText);
    qtyWrap.appendChild(plusButton);

    const removeButton = document.createElement('button');
    removeButton.className = 'flex items-center gap-1.5 text-slate-400 hover:text-rose-500 transition-colors duration-200 text-sm font-medium group';
    removeButton.type = 'button';
    const removeIcon = document.createElement('span');
    removeIcon.className = 'material-symbols-outlined text-lg group-hover:scale-110 transition-transform';
    removeIcon.textContent = 'delete';
    removeButton.appendChild(removeIcon);

    actions.appendChild(qtyWrap);
    actions.appendChild(removeButton);

    content.appendChild(top);
    content.appendChild(actions);

    row.appendChild(mediaWrap);
    row.appendChild(content);
    return row;
  };

  const selectTemplate = (container) => Array.from(container.children)[0] || createCartItemTemplate();

  const clearContainer = (container) => {
    while (container.firstChild) container.removeChild(container.firstChild);
  };

  const setSummary = (summaryData) => {
    const summaryRoot = document.getElementById('cart-summary');
    if (!summaryRoot) return;

    const subtotal = Number(summaryData?.subtotal || 0);
    const shipping = Number(summaryData?.shipping_charge || 0);
    const tax = Number(summaryData?.total_gst || 0);
    const grandTotal = Number(summaryData?.grand_total || (subtotal + shipping + tax));

    const rows = Array.from(summaryRoot.querySelectorAll('div.flex.justify-between'));
    if (rows[0]) {
      const value = rows[0].querySelector('span:last-child');
      if (value) value.textContent = currency(subtotal);
    }
    if (rows[2]) {
      const value = rows[2].querySelector('span:last-child');
      if (value) value.textContent = currency(tax);
    }

    const totalRow = summaryRoot.querySelector('div.pt-4.border-t');
    if (totalRow) {
      const totalValue = totalRow.querySelector('span:last-child');
      if (totalValue) totalValue.textContent = currency(grandTotal);
    }
  };

  const setCouponMessage = (message, isError = false) => {
    const node = document.getElementById('cart-coupon-message');
    if (!node) return;
    node.textContent = message || '';
    node.className = isError
      ? 'text-xs text-rose-500 mt-2'
      : 'text-xs text-emerald-600 mt-2';
  };

  const syncCouponControls = (couponCode) => {
    const input = document.getElementById('cart-coupon-code');
    const removeBtn = document.getElementById('cart-remove-coupon-btn');
    if (input) input.value = couponCode || '';
    if (removeBtn) removeBtn.classList.toggle('hidden', !couponCode);
  };

  const toPreviewItems = (items) => {
    return (Array.isArray(items) ? items : []).map((item) => ({
      variation_id: item.variation_id,
      quantity: Number(item.quantity || 0)
    })).filter((item) => Number.isInteger(Number(item.variation_id)) && Number(item.quantity) > 0);
  };

  const fallbackSummary = (items) => {
    const subtotal = (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Number(item.line_total || 0), 0);
    return {
      subtotal,
      shipping_charge: 0,
      total_gst: 0,
      discount_amount: 0,
      grand_total: subtotal
    };
  };

  const normalizeItemView = (item) => {
    const variation = item?.variation && typeof item.variation === 'object' ? item.variation : item;
    const price = Number(variation?.price ?? item?.unit_price ?? 0);
    const quantity = Number(item?.quantity || 0);
    const lineTotal = item?.line_total != null
      ? Number(item.line_total)
      : Number((price * quantity).toFixed(2));

    return {
      image: parseJson(variation?.images, [])[0] || variation?.image || item?.image || '',
      productName: variation?.product_name || item?.product_name || '',
      size: variation?.size || item?.size || '',
      price,
      quantity,
      lineTotal
    };
  };

  const setItemData = (node, item, onQtyChange, onRemove) => {
    const view = normalizeItemView(item);

    const imageNode = node.querySelector('img');
    const title = node.querySelector('h3, h4');
    const detail = node.querySelector('p.text-sm');
    const qtyWrap = node.querySelector('div.flex.items-center.bg-slate-100');
    const qtyButtons = qtyWrap ? Array.from(qtyWrap.querySelectorAll('button')) : [];
    const minusButton = qtyButtons[0] || null;
    const qtyText = qtyWrap ? qtyWrap.querySelector('span.w-8') : null;
    const plusButton = qtyButtons[1] || null;
    const lineTotal = node.querySelector('p.text-lg.font-bold.text-emerald-600, p.text-lg.font-bold');
    const removeButton = Array.from(node.querySelectorAll('button')).find((button) => {
      const icon = button.querySelector('.material-symbols-outlined');
      return icon && icon.textContent.trim() === 'delete';
    });

    if (imageNode) {
      imageNode.src = view.image;
      imageNode.alt = view.productName;
    }
    if (title) title.textContent = view.productName;
    if (detail) detail.textContent = `${view.size || ''} • ${currency(view.price)}`;
    if (qtyText) qtyText.textContent = String(view.quantity);

    const itemRef = item.id ?? item.variation_id;

    if (minusButton) {
      minusButton.onclick = () => {
        const next = Number(view.quantity) - 1;
        onQtyChange(itemRef, next > 0 ? next : 1);
      };
    }
    if (plusButton) {
      plusButton.onclick = () => {
        const next = Number(view.quantity) + 1;
        onQtyChange(itemRef, next);
      };
    }
    if (lineTotal) lineTotal.textContent = currency(view.lineTotal);

    if (removeButton) {
      removeButton.onclick = () => onRemove(itemRef);
    }
  };

  const render = (container, template, items, onQtyChange, onRemove) => {
    clearContainer(container);
    const subtitle = document.getElementById('cart-subtitle');

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'p-6 rounded-xl border border-slate-200 bg-white text-slate-500';
      empty.textContent = 'Your cart is empty. Add products to continue.';
      container.appendChild(empty);
      if (subtitle) subtitle.textContent = '0 items selected';
      setSummary({ subtotal: 0, shipping_charge: 0, total_gst: 0, grand_total: 0 });
      return;
    }

    items.forEach((item) => {
      const node = template.cloneNode(true);
      setItemData(node, item, onQtyChange, onRemove);
      container.appendChild(node);
    });
    if (subtitle) subtitle.textContent = `${items.length} item${items.length === 1 ? '' : 's'} selected`;
  };

  const recalculateSummary = async (items, activeCouponCode) => {
    if (!Array.isArray(items) || !items.length) {
      setSummary({ subtotal: 0, shipping_charge: 0, total_gst: 0, grand_total: 0 });
      return { couponCode: '' };
    }

    const previewItems = toPreviewItems(items);

    try {
      const payload = await api('/orders/preview', {
        method: 'POST',
        body: JSON.stringify({
          items: previewItems,
          payment_method: 'cod',
          coupon_code: activeCouponCode || null
        })
      });

      setSummary(payload?.summary || fallbackSummary(items));
      return { couponCode: payload?.summary?.coupon_code || '' };
    } catch (error) {
      if (activeCouponCode) throw error;
      setSummary(fallbackSummary(items));
      return { couponCode: '' };
    }
  };

  const bindCheckout = (items) => {
    const checkoutButton = document.getElementById('cart-checkout-btn');
    if (!checkoutButton) return;

    checkoutButton.disabled = !items.length;
    checkoutButton.classList.toggle('opacity-50', !items.length);

    checkoutButton.onclick = async () => {
      if (!items.length) return;

      if (!isAuthenticated()) {
        const loginSuccess = await window.AppUI?.ensureAuth?.();
        if (!loginSuccess) return;

        try {
          const guestItems = getGuestCart();
          for (const guestItem of guestItems) {
            await api('/cart/items', {
              method: 'POST',
              body: JSON.stringify({
                variation_id: Number(guestItem.variation_id),
                quantity: Number(guestItem.quantity || 0)
              })
            });
          }
          if (guestItems.length) setGuestCart([]);
        } catch (error) {
          window.AppUI?.toast?.(error?.message || 'Unable to prepare cart for checkout.', 'error');
          return;
        }
      }

      window.location.href = '/checkout?mode=cart';
    };
  };

  const initAuthenticated = async (container, template) => {
    const refresh = async () => {
      const payload = await api('/cart');
      const items = payload.items || [];

      render(
        container,
        template,
        items,
        async (itemId, quantity) => {
          await api(`/cart/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) });
          await refresh();
        },
        async (itemId) => {
          await api(`/cart/items/${itemId}`, { method: 'DELETE' });
          await refresh();
        }
      );

      bindCheckout(items);
    };

    await refresh();
  };

  const initGuest = async (container, template) => {
    const refresh = async () => {
      const guestItems = getGuestCart();
      const items = await fetchGuestDetails(guestItems);

      render(
        container,
        template,
        items,
        (variationId, quantity) => {
          const next = getGuestCart().map((item) => item.variation_id === variationId ? { ...item, quantity } : item);
          setGuestCart(next);
          refresh().catch((error) => console.error(error));
        },
        (variationId) => {
          const next = getGuestCart().filter((item) => item.variation_id !== variationId);
          setGuestCart(next);
          refresh().catch((error) => console.error(error));
        }
      );

      bindCheckout(items);
    };

    await refresh();
  };

  const init = async () => {
    bindHeaderNav();

    const root = document.getElementById('cart-items');
    if (!root) return;

    const template = selectTemplate(root);
    if (!template) return;

    let currentItems = [];
    let activeCouponCode = getStoredCouponCode();

    const applyCouponState = async (nextCouponCode, showSuccessMessage = true) => {
      const normalized = String(nextCouponCode || '').trim().toUpperCase();
      try {
        const result = await recalculateSummary(currentItems, normalized);
        activeCouponCode = result.couponCode || normalized;
        setStoredCouponCode(activeCouponCode);
        syncCouponControls(activeCouponCode);
        if (activeCouponCode && showSuccessMessage) {
          setCouponMessage(`Coupon ${activeCouponCode} applied successfully.`);
        } else if (!activeCouponCode) {
          setCouponMessage('');
        }
      } catch (error) {
        setCouponMessage(error?.message || 'Unable to apply coupon', true);
      }
    };

    const removeCouponState = async () => {
      activeCouponCode = '';
      setStoredCouponCode('');
      syncCouponControls('');
      setCouponMessage('Coupon removed.');
      await recalculateSummary(currentItems, '');
    };

    const applyButton = document.getElementById('cart-apply-coupon-btn');
    const removeButton = document.getElementById('cart-remove-coupon-btn');
    const input = document.getElementById('cart-coupon-code');

    applyButton?.addEventListener('click', () => {
      const code = (input?.value || '').trim().toUpperCase();
      if (!code) {
        setCouponMessage('Please enter a coupon code', true);
        return;
      }
      applyCouponState(code).catch((error) => console.error(error));
    });

    input?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      applyButton?.click();
    });

    removeButton?.addEventListener('click', () => {
      removeCouponState().catch((error) => console.error(error));
    });

    const refreshAndRender = async (items) => {
      currentItems = items;
      render(
        root,
        template,
        items,
        async (itemId, quantity) => {
          if (isAuthenticated()) {
            await api(`/cart/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) });
            const payload = await api('/cart');
            await refreshAndRender(payload.items || []);
            return;
          }

          const next = getGuestCart().map((item) => item.variation_id === itemId ? { ...item, quantity } : item);
          setGuestCart(next);
          const guestItems = await fetchGuestDetails(next);
          await refreshAndRender(guestItems);
        },
        async (itemId) => {
          if (isAuthenticated()) {
            await api(`/cart/items/${itemId}`, { method: 'DELETE' });
            const payload = await api('/cart');
            await refreshAndRender(payload.items || []);
            return;
          }

          const next = getGuestCart().filter((item) => item.variation_id !== itemId);
          setGuestCart(next);
          const guestItems = await fetchGuestDetails(next);
          await refreshAndRender(guestItems);
        }
      );

      bindCheckout(items);

      if (activeCouponCode) {
        try {
          const summaryResult = await recalculateSummary(items, activeCouponCode);
          activeCouponCode = summaryResult.couponCode || activeCouponCode;
          setStoredCouponCode(activeCouponCode);
          syncCouponControls(activeCouponCode);
        } catch (error) {
          activeCouponCode = '';
          setStoredCouponCode('');
          syncCouponControls('');
          setCouponMessage(error?.message || 'Coupon removed because it is no longer applicable.', true);
          await recalculateSummary(items, '');
        }
      } else {
        await recalculateSummary(items, '');
      }
    };

    syncCouponControls(activeCouponCode);

    if (isAuthenticated()) {
      const payload = await api('/cart');
      await refreshAndRender(payload.items || []);
    } else {
      const guestItems = await fetchGuestDetails(getGuestCart());
      await refreshAndRender(guestItems);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
      const subtitle = document.getElementById('cart-subtitle');
      if (subtitle) subtitle.textContent = error?.message || 'Unable to load cart right now.';
      console.error(error);
    });
  });
})();
