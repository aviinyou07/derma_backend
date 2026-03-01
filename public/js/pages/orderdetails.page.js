(() => {
  const API_BASE = '/api';
  const TOKEN_KEY = 'authToken';

  const getToken = () => localStorage.getItem(TOKEN_KEY);

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

  const createOrderItemTemplate = () => {
    const row = document.createElement('div');
    row.className = 'p-6 flex items-center gap-6 group';

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'size-24 rounded-lg bg-slate-50 dark:bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-100 dark:border-slate-700';

    const image = document.createElement('img');
    image.className = 'object-contain size-20';
    image.alt = '';
    mediaWrap.appendChild(image);

    const body = document.createElement('div');
    body.className = 'flex-1';

    const top = document.createElement('div');
    top.className = 'flex justify-between items-start';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h4');
    title.className = 'font-bold text-lg group-hover:text-primary transition-colors';
    const detail = document.createElement('p');
    detail.className = 'text-slate-500 text-sm';
    titleWrap.appendChild(title);
    titleWrap.appendChild(detail);

    const amount = document.createElement('p');
    amount.className = 'font-bold text-lg';

    top.appendChild(titleWrap);
    top.appendChild(amount);

    const bottom = document.createElement('div');
    bottom.className = 'mt-4 flex items-center justify-between';

    const qty = document.createElement('p');
    qty.className = 'text-sm text-slate-600 dark:text-slate-400';

    const reviewButton = document.createElement('button');
    reviewButton.className = 'text-primary text-sm font-semibold hover:underline';
    reviewButton.type = 'button';
    reviewButton.textContent = 'Write a review';

    bottom.appendChild(qty);
    bottom.appendChild(reviewButton);

    body.appendChild(top);
    body.appendChild(bottom);

    row.appendChild(mediaWrap);
    row.appendChild(body);
    return row;
  };

  const orderIdFromPath = () => {
    const queryOrderId = new URLSearchParams(window.location.search).get('orderId');
    if (queryOrderId) return Number(queryOrderId);

    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'orderdetails' && parts[1]) return Number(parts[1]);
    return 0;
  };

  const setHeader = (order) => {
    const idNode = document.getElementById('od-order-number');
    const metaNode = document.getElementById('od-meta');
    if (idNode) idNode.textContent = `Order #${order.order_number || order.id}`;
    if (metaNode) {
      const dateText = order.placed_at ? new Date(order.placed_at).toLocaleDateString('en-IN') : '';
      const itemCount = Array.isArray(order.items) ? order.items.length : 0;
      metaNode.textContent = `Placed on ${dateText} • ${itemCount} item(s)`;
    }
  };

  const setAddress = (order) => {
    const node = document.getElementById('od-shipping-address');
    if (!node) return;

    const shipping = (order.shipping_address && typeof order.shipping_address === 'object')
      ? order.shipping_address
      : parseJson(order.shipping_address, {});

    const lines = [
      shipping.full_name,
      shipping.address_line1,
      shipping.address_line2,
      [shipping.city, shipping.state, shipping.postal_code].filter(Boolean).join(' - '),
      shipping.country,
      shipping.phone
    ].filter(Boolean);

    while (node.firstChild) node.removeChild(node.firstChild);
    lines.forEach((line) => {
      const p = document.createElement('p');
      p.textContent = line;
      node.appendChild(p);
    });
  };

  const setSummary = (order) => {
    const root = document.getElementById('od-summary');
    if (!root) return;

    const rows = Array.from(root.querySelectorAll('div.flex.justify-between'));
    if (rows[0]) {
      const value = rows[0].querySelector('span:last-child');
      if (value) value.textContent = currency(order.subtotal || 0);
    }
    if (rows[1]) {
      const value = rows[1].querySelector('span:last-child');
      if (value) value.textContent = currency(order.shipping_charge || 0);
    }
    if (rows[2]) {
      const value = rows[2].querySelector('span:last-child');
      if (value) value.textContent = currency(order.total_gst || 0);
    }

    const totalRow = root.querySelector('div.pt-4.border-t');
    if (totalRow) {
      const value = totalRow.querySelector('span:last-child');
      if (value) value.textContent = currency(order.grand_total || 0);
    }
  };

  const setPayment = (order) => {
    const node = document.getElementById('od-payment-method');
    if (!node) return;

    const badge = node.querySelector('div.w-12.h-8');
    const label = node.querySelector('p.font-medium');
    const subLabel = node.querySelector('p.text-xs.text-slate-500');
    const method = (order.payment_method || 'cod').toUpperCase();

    if (badge) badge.textContent = method;
    if (label) label.textContent = `${method} payment`;
    if (subLabel) subLabel.textContent = `Status: ${String(order.payment_status || 'pending').toUpperCase()}`;
  };

  const setTimeline = (order) => {
    const statusNode = document.getElementById('od-delivery-status');
    const timelineNode = document.getElementById('od-timeline');
    if (!timelineNode) return;

    const rawStatus = String(order.order_status || 'pending').toLowerCase();
    const labelMap = {
      pending: 'Pending',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    };
    const statusLabel = labelMap[rawStatus] || rawStatus;

    if (statusNode) {
      statusNode.textContent = statusLabel;
      statusNode.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider';
      if (rawStatus === 'delivered') {
        statusNode.classList.add('bg-green-100', 'dark:bg-green-900/30', 'text-green-700', 'dark:text-green-400');
      } else if (rawStatus === 'cancelled') {
        statusNode.classList.add('bg-red-100', 'dark:bg-red-900/30', 'text-red-700', 'dark:text-red-400');
      } else {
        statusNode.classList.add('bg-primary/15', 'text-primary');
      }
    }

    const steps = [
      { key: 'placed_at', label: 'Order Placed' },
      { key: 'confirmed_at', label: 'Processing' },
      { key: 'shipped_at', label: 'Shipped' },
      { key: 'delivered_at', label: 'Delivered' }
    ];

    const reachedStatusIndex = {
      pending: 0,
      processing: 1,
      shipped: 2,
      delivered: 3,
      cancelled: 0
    }[rawStatus] ?? 0;

    clearNode(timelineNode);
    steps.forEach((step, index) => {
      const line = document.createElement('div');
      line.className = 'flex items-start gap-3';

      const iconWrap = document.createElement('div');
      iconWrap.className = index <= reachedStatusIndex
        ? 'w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center mt-0.5'
        : 'w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700 text-slate-400 flex items-center justify-center mt-0.5';

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined text-[16px]';
      icon.textContent = index <= reachedStatusIndex ? 'check' : 'radio_button_unchecked';
      iconWrap.appendChild(icon);

      const body = document.createElement('div');
      body.className = 'flex-1';

      const title = document.createElement('p');
      title.className = index <= reachedStatusIndex ? 'font-semibold text-primary' : 'font-semibold';
      title.textContent = step.label;

      const tsValue = order?.[step.key];
      const ts = tsValue ? new Date(tsValue) : null;
      const subtitle = document.createElement('p');
      subtitle.className = 'text-xs text-slate-500';
      subtitle.textContent = ts ? ts.toLocaleString('en-IN') : (index <= reachedStatusIndex ? 'Updated' : 'Pending');

      body.appendChild(title);
      body.appendChild(subtitle);

      line.appendChild(iconWrap);
      line.appendChild(body);
      timelineNode.appendChild(line);
    });
  };

  const setTimelineFromHistory = (historyRows, fallbackOrder) => {
    const timelineNode = document.getElementById('od-timeline');
    const statusNode = document.getElementById('od-delivery-status');
    if (!timelineNode) return;

    const rows = Array.isArray(historyRows) ? historyRows : [];
    if (!rows.length) {
      setTimeline(fallbackOrder || {});
      return;
    }

    const latest = rows[rows.length - 1];
    const latestStatus = String(latest?.to_status || fallbackOrder?.status || 'pending').toLowerCase();
    const labelMap = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      returned: 'Returned'
    };

    if (statusNode) {
      statusNode.textContent = labelMap[latestStatus] || latestStatus;
      statusNode.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider';
      if (latestStatus === 'delivered') {
        statusNode.classList.add('bg-green-100', 'dark:bg-green-900/30', 'text-green-700', 'dark:text-green-400');
      } else if (latestStatus === 'cancelled' || latestStatus === 'returned') {
        statusNode.classList.add('bg-red-100', 'dark:bg-red-900/30', 'text-red-700', 'dark:text-red-400');
      } else {
        statusNode.classList.add('bg-primary/15', 'text-primary');
      }
    }

    clearNode(timelineNode);

    rows.forEach((entry) => {
      const line = document.createElement('div');
      line.className = 'flex items-start gap-3';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center mt-0.5';

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined text-[16px]';
      icon.textContent = 'check';
      iconWrap.appendChild(icon);

      const body = document.createElement('div');
      body.className = 'flex-1';

      const title = document.createElement('p');
      title.className = 'font-semibold text-primary';
      title.textContent = labelMap[String(entry?.to_status || '').toLowerCase()] || String(entry?.to_status || 'Status Updated');

      const subtitle = document.createElement('p');
      subtitle.className = 'text-xs text-slate-500';
      const ts = entry?.created_at ? new Date(entry.created_at).toLocaleString('en-IN') : 'Updated';
      const reason = entry?.change_reason ? ` • ${entry.change_reason}` : '';
      subtitle.textContent = `${ts}${reason}`;

      body.appendChild(title);
      body.appendChild(subtitle);
      line.appendChild(iconWrap);
      line.appendChild(body);
      timelineNode.appendChild(line);
    });
  };

  const clearNode = (node) => {
    while (node.firstChild) node.removeChild(node.firstChild);
  };

  const renderItems = (root, template, items) => {
    clearNode(root);
    items.forEach((item) => {
      const row = template.cloneNode(true);
      const image = parseJson(item.images, [])[0] || '';

      const imageNode = row.querySelector('img');
      const nameNode = row.querySelector('h4');
      const detailNode = row.querySelector('p.text-sm');
      const qtyNode = row.querySelector('p.text-sm.text-slate-600');
      const amountNode = row.querySelector('p.font-bold.text-lg');
      const reviewButton = row.querySelector('button.text-primary');

      if (imageNode) {
        imageNode.src = image;
        imageNode.alt = item.product_name || '';
      }
      if (nameNode) nameNode.textContent = item.product_name || '';
      if (detailNode) detailNode.textContent = item.size || '';
      if (qtyNode) qtyNode.textContent = `Qty: ${String(item.quantity || 0)}`;
      if (amountNode) amountNode.textContent = currency(item.total_price || 0);

      if (reviewButton) {
        reviewButton.onclick = async () => {
          const value = await (window.AppUI?.promptInput?.({
            title: 'Rate this product',
            message: 'Enter a rating between 1 and 5',
            placeholder: 'e.g. 5',
            type: 'number'
          }) || Promise.resolve(null));

          if (value == null || value === '') return;

          const rating = Number(value);
          if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            window.AppUI?.toast?.('Please enter a valid rating between 1 and 5', 'error');
            return;
          }

          const existingReview = item.existing_review || null;

          try {
            if (existingReview?.id) {
              await api(`/reviews/${existingReview.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ rating })
              });
              reviewButton.textContent = 'Review updated';
              window.AppUI?.toast?.('Review updated successfully', 'success');
            } else {
              await api('/reviews', {
                method: 'POST',
                body: JSON.stringify({
                  order_item_id: item.id,
                  rating,
                  review_title: 'Review',
                  review_text: ''
                })
              });
              reviewButton.textContent = 'Review submitted';
              window.AppUI?.toast?.('Review submitted successfully', 'success');
            }

            reviewButton.disabled = true;
          } catch (error) {
            window.AppUI?.toast?.(error.message || 'Unable to submit review', 'error');
          }
        };
      }

      root.appendChild(row);
    });
  };

  const init = async () => {
    const orderId = orderIdFromPath();
    if (!orderId) return;

    const root = document.getElementById('od-items');
    if (!root) return;

    const loginSuccess = await (window.AppUI?.ensureAuth?.() || Promise.resolve(false));
    if (!loginSuccess) {
      window.location.href = '/';
      return;
    }

    const template = Array.from(root.children)[0] || createOrderItemTemplate();

    const payload = await api(`/orders/mine/${orderId}`);
    let statusHistoryRows = [];
    try {
      const statusPayload = await api(`/orders/mine/${orderId}/status-history`);
      statusHistoryRows = Array.isArray(statusPayload?.data) ? statusPayload.data : [];
    } catch (_error) {
      statusHistoryRows = [];
    }

    let myReviewsByOrderItem = new Map();
    try {
      const myReviews = await api('/reviews/mine?limit=100&page=1');
      const rows = Array.isArray(myReviews?.data) ? myReviews.data : [];
      myReviewsByOrderItem = new Map(rows
        .filter((row) => Number.isInteger(Number(row.order_item_id)) && Number(row.order_item_id) > 0)
        .map((row) => [Number(row.order_item_id), row]));
    } catch (_error) {
      myReviewsByOrderItem = new Map();
    }

    const enrichedItems = (payload.items || []).map((item) => ({
      ...item,
      existing_review: myReviewsByOrderItem.get(Number(item.id)) || null
    }));

    setHeader(payload || {});
    setAddress(payload || {});
    setSummary(payload || {});
    setPayment(payload || {});
    setTimelineFromHistory(statusHistoryRows, payload || {});
    renderItems(root, template, enrichedItems);

    const headerButtons = Array.from(document.querySelectorAll('main button'));
    const downloadButton = headerButtons[0] || null;
    const reorderAllButton = headerButtons[1] || null;

    if (downloadButton) {
      downloadButton.onclick = () => {
        window.location.href = `/api/orders/mine/${orderId}/invoice`;
      };
    }

    if (reorderAllButton) {
      reorderAllButton.onclick = () => { window.location.href = '/productlist'; };
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => console.error(error));
  });
})();
