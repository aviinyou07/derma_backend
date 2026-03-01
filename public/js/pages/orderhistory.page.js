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

  const currency = (v) => `₹${Number(v || 0).toFixed(2)}`;

  const createMetaColumn = (labelText, valueText) => {
    const column = document.createElement('div');

    const label = document.createElement('p');
    label.className = 'text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1';
    label.textContent = labelText;

    const value = document.createElement('p');
    value.className = 'text-sm font-semibold text-slate-800 dark:text-slate-200';
    value.textContent = valueText;

    column.appendChild(label);
    column.appendChild(value);
    return column;
  };

  const createOrderRowTemplate = () => {
    const card = document.createElement('div');
    card.className = 'group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300';

    const header = document.createElement('div');
    header.className = 'p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900 flex flex-wrap gap-4 items-center justify-between';

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 flex-grow';

    const orderPlaced = createMetaColumn('Order Placed', '-');
    const total = createMetaColumn('Total', '-');
    const shipTo = createMetaColumn('Ship To', '-');
    const orderId = createMetaColumn('Order #', '-');

    grid.appendChild(orderPlaced);
    grid.appendChild(total);
    grid.appendChild(shipTo);
    grid.appendChild(orderId);

    const status = document.createElement('div');
    status.className = 'flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-full border border-green-100 dark:border-green-500/20';
    const statusIcon = document.createElement('span');
    statusIcon.className = 'material-symbols-outlined text-[18px]';
    statusIcon.textContent = 'check_circle';
    const statusText = document.createElement('span');
    statusText.className = 'text-xs font-bold uppercase tracking-wide';
    statusText.textContent = 'pending';
    status.appendChild(statusIcon);
    status.appendChild(statusText);

    header.appendChild(grid);
    header.appendChild(status);

    const body = document.createElement('div');
    body.className = 'p-4 sm:p-6';

    const bodyRow = document.createElement('div');
    bodyRow.className = 'flex flex-col sm:flex-row gap-6 items-start';

    const summary = document.createElement('div');
    summary.className = 'max-w-md w-full bg-white dark:bg-slate-800 overflow-hidden';

    const summaryRow = document.createElement('div');
    summaryRow.className = 'flex items-start gap-4';
    const summaryMediaWrap = document.createElement('div');
    summaryMediaWrap.className = 'flex-shrink-0';
    const summaryMedia = document.createElement('div');
    summaryMedia.className = 'h-20 w-20 rounded-xl border-2 border-white dark:border-slate-900 bg-slate-100';
    summaryMediaWrap.appendChild(summaryMedia);

    const summaryTextWrap = document.createElement('div');
    summaryTextWrap.className = 'flex-grow';
    const summaryTitle = document.createElement('h3');
    summaryTitle.className = 'text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100';
    summaryTitle.textContent = 'Order';
    const summaryText = document.createElement('p');
    summaryText.className = 'text-sm text-slate-500 dark:text-slate-400';
    summaryText.textContent = 'Items';
    summaryTextWrap.appendChild(summaryTitle);
    summaryTextWrap.appendChild(summaryText);

    summaryRow.appendChild(summaryMediaWrap);
    summaryRow.appendChild(summaryTextWrap);
    summary.appendChild(summaryRow);

    const actions = document.createElement('div');
    actions.className = 'flex gap-2 w-full sm:w-auto';

    const detailsButton = document.createElement('button');
    detailsButton.className = 'flex-1 sm:flex-none px-4 sm:px-5 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1';
    detailsButton.type = 'button';
    const detailsIcon = document.createElement('span');
    detailsIcon.className = 'material-symbols-outlined text-[16px]';
    detailsIcon.textContent = 'visibility';
    detailsButton.appendChild(detailsIcon);
    detailsButton.appendChild(document.createTextNode('Details'));

    const reorderButton = document.createElement('button');
    reorderButton.className = 'flex-1 sm:flex-none px-4 sm:px-5 py-2 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-1';
    reorderButton.type = 'button';
    const reorderIcon = document.createElement('span');
    reorderIcon.className = 'material-symbols-outlined text-[16px]';
    reorderIcon.textContent = 'repeat';
    reorderButton.appendChild(reorderIcon);
    reorderButton.appendChild(document.createTextNode('Reorder'));

    actions.appendChild(detailsButton);
    actions.appendChild(reorderButton);

    bodyRow.appendChild(summary);
    bodyRow.appendChild(actions);
    body.appendChild(bodyRow);

    card.appendChild(header);
    card.appendChild(body);
    return card;
  };

  const clearNode = (node) => {
    while (node.firstChild) node.removeChild(node.firstChild);
  };

  const setRowData = (row, item) => {
    const metaCols = row.querySelectorAll('.grid.grid-cols-2.sm\\:grid-cols-4 > div');
    const dateNode = metaCols[0] ? metaCols[0].querySelector('p:last-child') : null;
    const totalNode = metaCols[1] ? metaCols[1].querySelector('p:last-child') : null;
    const shipToNode = metaCols[2] ? metaCols[2].querySelector('p:last-child') : null;
    const orderIdNode = metaCols[3] ? metaCols[3].querySelector('p:last-child') : null;

    const statusNode = row.querySelector('.rounded-full span:last-child');
    const actionButtons = Array.from(row.querySelectorAll('button'));
    const detailsButton = actionButtons[0] || null;
    const reorderButton = actionButtons[1] || null;

    const summaryTitle = row.querySelector('h3.text-base.sm\\:text-lg');
    const summaryText = row.querySelector('p.text-sm.text-slate-500.dark\\:text-slate-400');

    if (orderIdNode) orderIdNode.textContent = item.order_number || `#${item.id}`;
    if (dateNode) dateNode.textContent = new Date(item.placed_at).toLocaleDateString('en-IN');
    if (statusNode) statusNode.textContent = String(item.status || 'pending').toUpperCase();
    if (totalNode) totalNode.textContent = currency(item.grand_total || 0);
    if (shipToNode) shipToNode.textContent = item.ship_to || '-';
    if (summaryTitle) summaryTitle.textContent = item.first_product_name || 'Order';
    if (summaryText) summaryText.textContent = `+ ${Math.max(Number(item.item_count || 0) - 1, 0)} other item(s)`;
    if (detailsButton) detailsButton.onclick = () => { window.location.href = `/orderdetails?orderId=${item.id}`; };
    if (reorderButton) reorderButton.onclick = () => { window.location.href = '/productlist'; };
  };

  const renderOrders = (root, template, orders) => {
    clearNode(root);
    orders.forEach((order) => {
      const row = template.cloneNode(true);
      setRowData(row, order);
      root.appendChild(row);
    });
  };

  const init = async () => {
    const root = document.getElementById('order-history-list');
    if (!root) return;

    const loginSuccess = await (window.AppUI?.ensureAuth?.() || Promise.resolve(false));
    if (!loginSuccess) {
      window.location.href = '/';
      return;
    }

    const template = Array.from(root.children)[0] || createOrderRowTemplate();

    const payload = await api('/orders/mine?limit=20&page=1');
    renderOrders(root, template, payload?.data || []);
  };

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => console.error(error));
  });
})();
