(() => {
  const API_BASE = '/api';
  const TOKEN_KEY = 'authToken';
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

  const queryMode = () => new URLSearchParams(window.location.search).get('mode') || 'cart';

  const getStoredCouponCode = () => (sessionStorage.getItem(CHECKOUT_COUPON_KEY) || '').trim().toUpperCase();
  const setStoredCouponCode = (code) => {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) {
      sessionStorage.removeItem(CHECKOUT_COUPON_KEY);
      return;
    }
    sessionStorage.setItem(CHECKOUT_COUPON_KEY, normalized);
  };

  const readAddress = () => {
    const get = (id) => document.getElementById(id)?.value?.trim() || '';
    const firstName = get('checkout-first-name');
    const lastName = get('checkout-last-name');
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      full_name: fullName,
      email: get('checkout-email').toLowerCase(),
      address_line1: get('checkout-line1'),
      address_line2: get('checkout-line2') || null,
      city: get('checkout-city'),
      state: get('checkout-state'),
      postal_code: get('checkout-postal-code'),
      phone: get('checkout-phone')
    };
  };

  const splitName = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  };

  const setFieldValue = (id, value) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = String(value || '');
  };

  const fillAddressForm = (address) => {
    if (!address || typeof address !== 'object') return;

    const name = splitName(address.full_name);
    setFieldValue('checkout-first-name', name.firstName);
    setFieldValue('checkout-last-name', name.lastName);
    setFieldValue('checkout-email', address.email || '');
    setFieldValue('checkout-line1', address.address_line1 || '');
    setFieldValue('checkout-line2', address.address_line2 || '');
    setFieldValue('checkout-city', address.city || '');
    setFieldValue('checkout-state', address.state || '');
    setFieldValue('checkout-postal-code', address.postal_code || '');
    setFieldValue('checkout-phone', address.phone || '');
  };

  const prefillAddressForAuthenticatedUser = async () => {
    if (!isAuthenticated()) return;

    try {
      const payload = await api('/users/addresses');
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const defaultAddress = rows.find((row) => Number(row.is_default) === 1) || rows[0] || null;
      if (defaultAddress) fillAddressForm(defaultAddress);
    } catch (_error) {
    }
  };

  const saveAddressIfNeeded = async (address) => {
    if (!isAuthenticated()) return;

    const saveCheckbox = document.getElementById('checkout-save-address');
    if (!saveCheckbox || !saveCheckbox.checked) return;

    const payload = {
      address_type: 'home',
      full_name: address.full_name,
      phone: address.phone,
      address_line1: address.address_line1,
      address_line2: address.address_line2,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country || 'India',
      is_default: true
    };

    try {
      await api('/users/addresses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (_error) {
    }
  };

  const validateAddress = (address, requireEmail) => {
    const baseValid = address.full_name && address.address_line1 && address.city && address.state && address.postal_code && address.phone;
    if (!baseValid) return false;
    if (!requireEmail) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email || '');
  };

  const createCheckoutItemTemplate = () => {
    const row = document.createElement('div');
    row.className = 'flex gap-4';

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'relative h-20 w-20 flex-shrink-0 bg-background-light dark:bg-slate-800 rounded-lg overflow-hidden';
    const image = document.createElement('img');
    image.className = 'h-full w-full object-cover';
    image.alt = '';
    const qty = document.createElement('span');
    qty.className = 'absolute -top-2 -right-2 h-5 w-5 bg-slate-500 text-white text-[10px] flex items-center justify-center rounded-full';
    qty.textContent = '1';
    mediaWrap.appendChild(image);
    mediaWrap.appendChild(qty);

    const body = document.createElement('div');
    body.className = 'flex flex-col justify-center flex-1';
    const title = document.createElement('h3');
    title.className = 'text-sm font-semibold';
    const detail = document.createElement('p');
    detail.className = 'text-xs text-slate-500';
    body.appendChild(title);
    body.appendChild(detail);

    const amountWrap = document.createElement('div');
    amountWrap.className = 'flex items-center';
    const amount = document.createElement('span');
    amount.className = 'text-sm font-bold';
    amount.textContent = '₹0.00';
    amountWrap.appendChild(amount);

    row.appendChild(mediaWrap);
    row.appendChild(body);
    row.appendChild(amountWrap);
    return row;
  };

  const setSummary = (summary) => {
    const root = document.getElementById('checkout-summary');
    if (!root) return;

    const rows = Array.from(root.querySelectorAll('div.flex.justify-between'));
    if (rows[0]) {
      const value = rows[0].querySelector('span:last-child');
      if (value) value.textContent = currency(summary.subtotal || 0);
    }
    if (rows[1]) {
      const value = rows[1].querySelector('span:last-child');
      if (value) value.textContent = currency(summary.shipping_charge || summary.shipping_fee || 0);
    }
    if (rows[2]) {
      const value = rows[2].querySelector('span:last-child');
      if (value) value.textContent = currency(summary.total_gst || summary.tax || 0);
    }

    const totalRow = root.querySelector('div.flex.justify-between.text-lg.font-bold');
    if (totalRow) {
      const value = totalRow.querySelector('span:last-child');
      if (value) value.textContent = currency(summary.grand_total || summary.total || 0);
    }
  };

  const clearItems = (root) => {
    while (root.firstChild) root.removeChild(root.firstChild);
  };

  const renderItems = (root, template, items) => {
    clearItems(root);
    items.forEach((item) => {
      const node = template.cloneNode(true);
      const image = parseJson(item.images || item.variation?.images, [])[0] || '';

      const imageNode = node.querySelector('img');
      const nameNode = node.querySelector('h3, h4');
      const detailNode = node.querySelector('p.text-xs, p.text-sm');
      const qtyNode = node.querySelector('span.absolute.-top-2.-right-2');
      const amountNode = node.querySelector('span.text-sm.font-bold');

      if (imageNode) {
        imageNode.src = image;
        imageNode.alt = item.product_name || item.variation?.product_name || '';
      }
      if (nameNode) nameNode.textContent = item.product_name || item.variation?.product_name || '';
      if (detailNode) detailNode.textContent = item.size || item.variation?.size || '';
      if (qtyNode) qtyNode.textContent = String(item.quantity || 0);
      if (amountNode) amountNode.textContent = currency(item.line_total || 0);

      root.appendChild(node);
    });
  };

  const createBuyNowPreview = async () => {
    const raw = sessionStorage.getItem('buyNowItem');
    if (!raw) throw new Error('Buy-now item not found');

    const buyNow = parseJson(raw, null);
    const variation = await api(`/products/variation/${buyNow.variation_id}`);

    const line_total = Number(variation.price) * Number(buyNow.quantity);
    const subtotal = line_total;
    const total_gst = subtotal * 0.08;
    const shipping_charge = subtotal > 0 ? 49 : 0;

    return {
      mode: 'buy-now',
      items: [{
        variation_id: buyNow.variation_id,
        product_name: variation.product_name,
        size: variation.size,
        images: variation.images,
        quantity: buyNow.quantity,
        line_total
      }],
      summary: {
        subtotal,
        shipping_charge,
        total_gst,
        grand_total: subtotal + shipping_charge + total_gst
      }
    };
  };

  const createAuthCartPreview = async () => {
    const payload = await api('/cart');
    return {
      mode: 'cart',
      items: payload.items || [],
      summary: payload.summary || {}
    };
  };

  const fetchPreview = async () => {
    const mode = queryMode();

    if (mode === 'buy-now') return createBuyNowPreview();
    return createAuthCartPreview();
  };

  const placeAuthenticatedOrder = async (address, paymentMethod) => {
    const payload = await api('/orders/from-cart', {
      method: 'POST',
      body: JSON.stringify({
        shipping_address: address,
        payment_method: paymentMethod,
        coupon_code: getStoredCouponCode() || null
      })
    });
    return payload;
  };

  const placeBuyNowOrder = async (address, paymentMethod, preview) => {
    const payload = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        shipping_address: address,
        payment_method: paymentMethod,
        items: (preview.items || []).map((item) => ({
          variation_id: Number(item.variation_id),
          quantity: Number(item.quantity || 0)
        })),
        coupon_code: getStoredCouponCode() || null
      })
    });
    return payload;
  };

  const resolvePaymentMethod = () => {
    const selected = document.querySelector('input[name="checkout-payment-method"]:checked');
    return selected ? selected.value : 'cod';
  };

  const setCouponMessage = (message, isError = false) => {
    const node = document.getElementById('checkout-coupon-message');
    if (!node) return;
    node.textContent = message || '';
    node.className = isError
      ? 'text-xs text-rose-500 mt-2'
      : 'text-xs text-emerald-600 mt-2';
  };

  const syncCouponControls = (couponCode) => {
    const input = document.getElementById('checkout-coupon-code');
    const removeBtn = document.getElementById('checkout-remove-coupon-btn');
    if (input) input.value = couponCode || '';
    if (removeBtn) removeBtn.classList.toggle('hidden', !couponCode);
  };

  const toPreviewItems = (items) => {
    return (Array.isArray(items) ? items : []).map((item) => ({
      variation_id: Number(item.variation_id),
      quantity: Number(item.quantity || 0)
    })).filter((item) => Number.isInteger(item.variation_id) && item.variation_id > 0 && item.quantity > 0);
  };

  const recalculateSummary = async ({ items, paymentMethod, couponCode }) => {
    const previewItems = toPreviewItems(items);
    if (!previewItems.length) {
      setSummary({ subtotal: 0, shipping_charge: 0, total_gst: 0, grand_total: 0 });
      return { couponCode: '' };
    }

    const payload = await api('/orders/preview', {
      method: 'POST',
      body: JSON.stringify({
        items: previewItems,
        payment_method: paymentMethod,
        coupon_code: couponCode || null
      })
    });

    setSummary(payload?.summary || {});
    return { couponCode: payload?.summary?.coupon_code || '' };
  };

  const ensureRazorpayScript = async () => {
    if (window.Razorpay) return;

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-razorpay-checkout="1"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay checkout script')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.dataset.razorpayCheckout = '1';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Unable to load Razorpay checkout script'));
      document.head.appendChild(script);
    });
  };

  const clearCheckoutClientState = (mode) => {
    if (mode === 'buy-now') {
      sessionStorage.removeItem('buyNowItem');
    }
  };

  const startRazorpayAndVerify = async ({ result, address, mode }) => {
    await ensureRazorpayScript();

    const keyId = result?.razorpay_key_id;
    const orderId = result?.order_id;
    const razorpayOrderId = result?.razorpay_order_id;
    const amountPaise = Number(result?.amount_paise || Math.round(Number(result?.amount || 0) * 100));

    if (!keyId || !orderId || !razorpayOrderId || !amountPaise) {
      throw new Error('Missing Razorpay payment details');
    }

    await new Promise((resolve, reject) => {
      const razorpay = new window.Razorpay({
        key: keyId,
        amount: amountPaise,
        currency: result?.currency || 'INR',
        name: 'Dermacare Elite',
        description: `Order #${orderId}`,
        order_id: razorpayOrderId,
        prefill: {
          name: address?.full_name || '',
          email: address?.email || '',
          contact: address?.phone || ''
        },
        handler: async (paymentResponse) => {
          try {
            await api('/orders/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                order_id: orderId,
                amount: amountPaise
              })
            });

            clearCheckoutClientState(mode);
            resolve();
            window.location.href = `/orderdetails/${orderId}`;
          } catch (error) {
            reject(error);
          }
        },
        modal: {
          ondismiss: () => reject(new Error('Payment was cancelled'))
        }
      });

      razorpay.open();
    });
  };

  const bindSubmit = (preview, getCouponCode, refreshSummary) => {
    const form = document.getElementById('checkout-form');
    if (!form) return;

    form.onsubmit = async (event) => {
      event.preventDefault();

      const address = readAddress();
      const mode = preview.mode || queryMode();
      if (!validateAddress(address, false)) {
        window.AppUI?.toast?.('Please fill all required shipping fields.', 'error');
        return;
      }

      const paymentMethod = resolvePaymentMethod();

      try {
        await refreshSummary();

        let result;
        if (mode === 'buy-now') {
          result = await placeBuyNowOrder(address, paymentMethod, preview);
        } else {
          result = await placeAuthenticatedOrder(address, paymentMethod);
        }

        const orderId = result?.order?.id || result?.order_id || result?.id;
        if (!orderId) throw new Error('Order creation failed');

        if (paymentMethod === 'razorpay') {
          await saveAddressIfNeeded(address);
          await startRazorpayAndVerify({ result, address, mode });
          return;
        }

        await saveAddressIfNeeded(address);
        clearCheckoutClientState(mode);
        setStoredCouponCode(getCouponCode());
        window.location.href = `/orderdetails/${orderId}`;
      } catch (error) {
        window.AppUI?.toast?.(error?.message || 'Checkout failed. Please try again.', 'error');
      }
    };
  };

  const init = async () => {
    const itemRoot = document.getElementById('checkout-items');
    if (!itemRoot) return;

    if (!isAuthenticated()) {
      const loginSuccess = await window.AppUI?.ensureAuth?.();
      if (!loginSuccess) {
        window.location.href = '/cart';
        return;
      }
    }

    const template = Array.from(itemRoot.children)[0] || createCheckoutItemTemplate();

    const preview = await fetchPreview();
    renderItems(itemRoot, template, preview.items || []);

    const saveAddressWrap = document.getElementById('checkout-save-address')?.closest('label');
    if (saveAddressWrap) saveAddressWrap.style.display = isAuthenticated() ? '' : 'none';
    await prefillAddressForAuthenticatedUser();

    let activeCouponCode = getStoredCouponCode();
    syncCouponControls(activeCouponCode);

    const refreshSummary = async (showCouponSuccessMessage = false) => {
      try {
        const result = await recalculateSummary({
          items: preview.items || [],
          paymentMethod: resolvePaymentMethod(),
          couponCode: activeCouponCode
        });

        activeCouponCode = result.couponCode || activeCouponCode;
        setStoredCouponCode(activeCouponCode);
        syncCouponControls(activeCouponCode);

        if (activeCouponCode && showCouponSuccessMessage) {
          setCouponMessage(`Coupon ${activeCouponCode} applied successfully.`);
        } else if (!activeCouponCode) {
          setCouponMessage('');
        }
      } catch (error) {
        if (activeCouponCode) {
          activeCouponCode = '';
          setStoredCouponCode('');
          syncCouponControls('');
          setCouponMessage(error?.message || 'Coupon removed because it is not applicable.', true);
          await recalculateSummary({
            items: preview.items || [],
            paymentMethod: resolvePaymentMethod(),
            couponCode: ''
          });
          return;
        }

        setSummary(preview.summary || {});
      }
    };

    const applyButton = document.getElementById('checkout-apply-coupon-btn');
    const removeButton = document.getElementById('checkout-remove-coupon-btn');
    const couponInput = document.getElementById('checkout-coupon-code');

    applyButton?.addEventListener('click', () => {
      const code = (couponInput?.value || '').trim().toUpperCase();
      if (!code) {
        setCouponMessage('Please enter a coupon code', true);
        return;
      }

      activeCouponCode = code;
      setStoredCouponCode(activeCouponCode);
      refreshSummary(true).catch((error) => console.error(error));
    });

    couponInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      applyButton?.click();
    });

    removeButton?.addEventListener('click', () => {
      activeCouponCode = '';
      setStoredCouponCode('');
      syncCouponControls('');
      setCouponMessage('Coupon removed.');
      refreshSummary(false).catch((error) => console.error(error));
    });

    document.querySelectorAll('input[name="checkout-payment-method"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        refreshSummary(false).catch((error) => console.error(error));
      });
    });

    await refreshSummary(false);
    bindSubmit(preview, () => activeCouponCode, () => refreshSummary(false));
  };

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => console.error(error));
  });
})();
