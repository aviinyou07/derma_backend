(() => {
  const API_BASE = '/api';
  const TOKEN_KEY = 'authToken';
  const GUEST_CART_KEY = 'guestCart';
  const DEFAULT_LIMIT = 9;

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
  const inr = (v) => `₹${new Intl.NumberFormat('en-IN').format(Math.round(Number(v || 0)))}`;

  const createProductCardTemplate = () => {
    const card = document.createElement('div');
    card.className = 'product-card group relative bg-white rounded-xl overflow-hidden border border-slate-100';

    const media = document.createElement('div');
    media.className = 'relative aspect-square overflow-hidden bg-slate-100';

    const image = document.createElement('img');
    image.className = 'default-image absolute inset-0 w-full h-full object-cover';
    image.alt = '';

    const wishlistButton = document.createElement('button');
    wishlistButton.className = 'wishlist-toggle absolute top-3 right-3 p-2 rounded-full bg-white/90 text-slate-600 hover:text-rose-500 shadow';
    wishlistButton.type = 'button';
    wishlistButton.setAttribute('aria-label', 'Toggle wishlist');

    const wishlistIcon = document.createElement('span');
    wishlistIcon.className = 'material-symbols-outlined text-[20px]';
    wishlistIcon.textContent = 'favorite_border';
    wishlistButton.appendChild(wishlistIcon);

    const actionWrap = document.createElement('div');
    actionWrap.className = 'absolute inset-x-4 bottom-4 translate-y-12 group-hover:translate-y-0 transition-transform duration-300';

    const addButton = document.createElement('button');
    addButton.className = 'w-full py-3 bg-primary text-white text-sm font-bold rounded-lg shadow-lg';
    addButton.type = 'button';
    addButton.textContent = 'ADD TO CART';

    actionWrap.appendChild(addButton);
    media.appendChild(image);
    media.appendChild(wishlistButton);
    media.appendChild(actionWrap);

    const details = document.createElement('div');
    details.className = 'p-5';

    const title = document.createElement('h4');
    title.className = 'font-bold text-slate-900 text-lg mb-1 leading-tight';

    const desc = document.createElement('p');
    desc.className = 'text-slate-500 text-sm mb-4';

    const price = document.createElement('p');
    price.className = 'font-bold text-primary';

    details.appendChild(title);
    details.appendChild(desc);
    details.appendChild(price);

    card.appendChild(media);
    card.appendChild(details);
    return card;
  };

  const readFilters = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      category: params.get('category') || '',
      brand: params.get('brand') || '',
      rating: params.get('rating') || '',
      search: params.get('search') || params.get('q') || '',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      sort: params.get('sort') || 'newest',
      page: Math.max(1, Number(params.get('page') || 1)),
      limit: Math.max(1, Number(params.get('limit') || DEFAULT_LIMIT))
    };
  };

  const pushFilters = (filters) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v != null) params.set(k, String(v));
    });

    const query = params.toString();
    const url = query ? `/productlist?${query}` : '/productlist';
    window.history.replaceState({}, '', url);
  };

  const upsertGuestCart = (variationId) => {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    const cart = raw ? JSON.parse(raw) : [];
    const item = cart.find((x) => x.variation_id === variationId);
    if (item) item.quantity += 1;
    else cart.push({ variation_id: variationId, quantity: 1 });
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  };

  const selectCardTemplate = (container) => {
    const cards = Array.from(container.children).filter((node) => node.tagName === 'DIV' || node.tagName === 'ARTICLE');
    return cards[0] || createProductCardTemplate();
  };

  const setCardData = (card, product, wishlistProductIds, onWishlistChange) => {
    const images = parseJson(product.images, []);
    const imageUrl = images[0] || '';

    const imageNode = card.querySelector('img');
    const title = card.querySelector('h4');
    const desc = card.querySelector('p.text-sm');
    const price = card.querySelector('p.font-bold.text-primary, p.text-lg.font-bold');
    const addButton = Array.from(card.querySelectorAll('button')).find((button) => (button.textContent || '').toUpperCase().includes('ADD TO CART'));
    const wishlistButton = card.querySelector('button.wishlist-toggle');
    const wishlistIcon = wishlistButton?.querySelector('.material-symbols-outlined');

    if (imageNode) {
      imageNode.src = imageUrl;
      imageNode.alt = product.name || '';
    }
    if (title) title.textContent = product.name || '';
    if (desc) desc.textContent = `${product.category_name || ''}${product.brand_name ? ` • ${product.brand_name}` : ''}`;
    if (price) price.textContent = currency(product.starting_price);

    if (wishlistButton && wishlistIcon) {
      const isWished = wishlistProductIds.has(Number(product.id));
      wishlistIcon.textContent = isWished ? 'favorite' : 'favorite_border';
      wishlistButton.classList.toggle('text-rose-500', isWished);

      wishlistButton.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!isAuthenticated()) {
          const ok = await (window.AppUI?.ensureAuth?.() || Promise.resolve(false));
          if (!ok) return;
        }

        try {
          await onWishlistChange(product);
        } catch (error) {
          window.AppUI?.toast?.(error?.message || 'Unable to update wishlist', 'error');
        }
      };
    }

    card.style.display = '';
    card.style.cursor = 'pointer';
    card.onclick = (event) => {
      if (event.target.closest('button')) return;
      window.location.href = `/productdetails/${product.slug}`;
    };

    if (addButton) {
      addButton.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const detail = await api(`/products/${encodeURIComponent(product.slug)}`);
        const firstVariation = detail?.variations?.[0];
        if (!firstVariation) return;

        if (isAuthenticated()) {
          await api('/cart/items', {
            method: 'POST',
            body: JSON.stringify({ variation_id: firstVariation.id, quantity: 1 })
          });
        } else {
          upsertGuestCart(firstVariation.id);
        }

        const originalText = addButton.textContent;
        addButton.textContent = 'Added';
        addButton.disabled = true;
        setTimeout(() => {
          addButton.textContent = originalText;
          addButton.disabled = false;
        }, 1200);
      };
    }
  };

  const clearContainer = (container) => {
    while (container.firstChild) container.removeChild(container.firstChild);
  };

  const renderProducts = (container, template, products, wishlistProductIds, onWishlistChange) => {
    clearContainer(container);

    if (!products.length) {
      const empty = document.createElement('div');
      empty.className = 'p-6 bg-white rounded-xl border border-slate-100 text-slate-500';
      empty.textContent = 'No products found for selected filters.';
      container.appendChild(empty);
      return;
    }

    products.forEach((product) => {
      const card = template.cloneNode(true);
      setCardData(card, product, wishlistProductIds, onWishlistChange);
      container.appendChild(card);
    });
  };

  const loadWishlistProductIds = async () => {
    if (!isAuthenticated()) return new Set();

    try {
      const payload = await api('/wishlist');
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      return new Set(rows.map((row) => Number(row.product_id)).filter((id) => Number.isInteger(id) && id > 0));
    } catch (_error) {
      return new Set();
    }
  };

  const createOptionCheckbox = ({ group, value, label, checked = false }) => {
    const row = document.createElement('label');
    row.className = 'flex items-center gap-3 cursor-pointer group';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-700 bg-transparent';
    input.setAttribute('data-filter-group', group);
    input.value = value;
    input.checked = checked;

    const text = document.createElement('span');
    text.className = 'text-sm text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors';
    text.textContent = label;

    row.appendChild(input);
    row.appendChild(text);
    return row;
  };

  const renderFacetOptions = (group, options, selectedValues) => {
    const targets = Array.from(document.querySelectorAll(`[data-dynamic-facet="${group}"]`));
    targets.forEach((root) => {
      root.innerHTML = '';
      options.forEach((item) => {
        root.appendChild(createOptionCheckbox({
          group,
          value: item.slug,
          label: item.name,
          checked: selectedValues.includes(item.slug)
        }));
      });
    });
  };

  const parseChecked = (group) => {
    const selected = Array.from(document.querySelectorAll(`input[data-filter-group="${group}"]:checked`))
      .map((input) => String(input.value || '').trim())
      .filter(Boolean);
    return selected[0] || '';
  };

  const parseSelectedRating = () => {
    const selected = document.querySelector('input[data-filter="rating"]:checked');
    return selected ? String(selected.value || '').trim() : '';
  };

  const syncFacetGroup = (group, selectedValue) => {
    const normalized = String(selectedValue || '').trim();
    document.querySelectorAll(`input[data-filter-group="${group}"]`).forEach((input) => {
      input.checked = normalized !== '' && String(input.value || '').trim() === normalized;
    });
  };

  const updatePriceLabels = (min, max) => {
    document.querySelectorAll('[data-price-min-label]').forEach((node) => {
      node.textContent = inr(min);
    });
    document.querySelectorAll('[data-price-max-label]').forEach((node) => {
      node.textContent = inr(max);
    });
  };

  const syncPriceRange = (minValue, maxValue) => {
    const minRanges = Array.from(document.querySelectorAll('input[data-filter="minPrice"]'));
    const maxRanges = Array.from(document.querySelectorAll('input[data-filter="maxPrice"]'));

    minRanges.forEach((range) => {
      range.value = String(minValue);
    });

    maxRanges.forEach((range) => {
      range.value = String(maxValue);
    });

    updatePriceLabels(minValue, maxValue);
  };

  const syncRatingChoice = (value) => {
    const normalized = String(value || '').trim();
    const allRatings = Array.from(document.querySelectorAll('input[data-filter="rating"]'));
    allRatings.forEach((input) => {
      input.checked = normalized !== '' && String(input.value || '').trim() === normalized;
    });
  };

  const bindPagination = (pagination, onPageChange) => {
    const root = document.getElementById('product-pagination');
    if (!root) return;

    root.innerHTML = '';

    const totalPages = Math.max(1, Number(pagination?.total_pages || 1));
    const currentPage = Math.max(1, Number(pagination?.page || 1));

    const createPageButton = (label, page, disabled = false, active = false, icon = false) => {
      const button = document.createElement('button');
      button.disabled = disabled;
      button.className = active
        ? 'size-10 rounded-lg flex items-center justify-center bg-primary text-white font-bold'
        : 'size-10 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:text-slate-400';

      if (icon) {
        const span = document.createElement('span');
        span.className = 'material-symbols-outlined';
        span.textContent = label;
        button.appendChild(span);
      } else {
        button.textContent = String(label);
      }

      button.addEventListener('click', () => {
        if (disabled || page === currentPage) return;
        onPageChange(page);
      });

      return button;
    };

    root.appendChild(createPageButton('chevron_left', currentPage - 1, currentPage <= 1, false, true));

    const pages = [];
    for (let p = 1; p <= totalPages; p += 1) {
      if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) pages.push(p);
    }

    let prev = 0;
    pages.forEach((p) => {
      if (p - prev > 1) {
        const dots = document.createElement('span');
        dots.className = 'text-slate-400 px-2';
        dots.textContent = '...';
        root.appendChild(dots);
      }
      root.appendChild(createPageButton(p, p, false, p === currentPage));
      prev = p;
    });

    root.appendChild(createPageButton('chevron_right', currentPage + 1, currentPage >= totalPages, false, true));
  };

  const fetchFacets = async () => {
    const payload = await api('/products/facets');
    return {
      categories: Array.isArray(payload?.categories) ? payload.categories : [],
      brands: Array.isArray(payload?.brands) ? payload.brands : [],
      priceRange: payload?.price_range || { min: 0, max: 5000 }
    };
  };

  const buildProductQuery = (filters) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v != null) params.set(k, String(v));
    });
    return `/products?${params.toString()}`;
  };

  const init = async () => {
    const productRoot = document.getElementById('product-list-grid') || document.getElementById('product-grid');
    if (!productRoot) return;

    const template = selectCardTemplate(productRoot);
    if (!template) return;

    let filters = readFilters();
    const facets = await fetchFacets();
    let wishlistProductIds = await loadWishlistProductIds();
    const activeFiltersRoot = document.getElementById('active-filters');

    const categoryLabelBySlug = new Map((facets.categories || []).map((item) => [String(item.slug), String(item.name || item.slug)]));
    const brandLabelBySlug = new Map((facets.brands || []).map((item) => [String(item.slug), String(item.name || item.slug)]));

    renderFacetOptions('category', facets.categories, filters.category ? [filters.category] : []);
    renderFacetOptions('brand', facets.brands, filters.brand ? [filters.brand] : []);

    const maxRange = Math.max(0, Number(facets.priceRange.max || 5000));
    const minRange = Math.max(0, Number(facets.priceRange.min || 0));

    const ranges = Array.from(document.querySelectorAll('input[data-filter="minPrice"], input[data-filter="maxPrice"]'));
    ranges.forEach((range) => {
      range.min = String(minRange);
      range.max = String(maxRange || 5000);
      range.step = '50';
    });

    const parsedMin = Number(filters.minPrice);
    const parsedMax = Number(filters.maxPrice);
    const currentMinPrice = Number.isFinite(parsedMin)
      ? Math.min(Math.max(parsedMin, minRange), maxRange)
      : minRange;
    const currentMaxPrice = Number.isFinite(parsedMax)
      ? Math.max(Math.min(parsedMax, maxRange), minRange)
      : maxRange;

    const initialMin = Math.min(currentMinPrice, currentMaxPrice);
    const initialMax = Math.max(currentMinPrice, currentMaxPrice);

    syncPriceRange(initialMin, initialMax || maxRange || 5000);
    syncRatingChoice(filters.rating || '');
    syncFacetGroup('category', filters.category || '');
    syncFacetGroup('brand', filters.brand || '');

    const searchInput = document.getElementById('global-search-input');
    if (searchInput && filters.search) searchInput.value = filters.search;

    const syncInputsFromFilters = (nextFilters) => {
      syncFacetGroup('category', nextFilters.category || '');
      syncFacetGroup('brand', nextFilters.brand || '');
      syncRatingChoice(nextFilters.rating || '');

      const parsedNextMin = Number(nextFilters.minPrice);
      const parsedNextMax = Number(nextFilters.maxPrice);

      const nextMin = Number.isFinite(parsedNextMin)
        ? Math.min(Math.max(parsedNextMin, minRange), maxRange)
        : minRange;
      const nextMax = Number.isFinite(parsedNextMax)
        ? Math.max(Math.min(parsedNextMax, maxRange), minRange)
        : maxRange;

      const safeMin = Math.min(nextMin, nextMax);
      const safeMax = Math.max(nextMin, nextMax);
      syncPriceRange(safeMin, safeMax);

      if (searchInput) searchInput.value = nextFilters.search || '';
    };

    const createFilterChip = (label, onRemove) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors';

      const text = document.createElement('span');
      text.textContent = label;

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined text-sm';
      icon.textContent = 'close';

      chip.appendChild(text);
      chip.appendChild(icon);
      chip.addEventListener('click', (event) => {
        event.preventDefault();
        onRemove();
      });

      return chip;
    };

    const renderActiveFilters = () => {
      if (!activeFiltersRoot) return;

      activeFiltersRoot.innerHTML = '';
      const chips = [];

      if (filters.search) {
        chips.push(createFilterChip(`Search: ${filters.search}`, () => {
          apply({ ...filters, search: '', page: 1 }).catch((error) => console.error(error));
        }));
      }

      if (filters.category) {
        const label = categoryLabelBySlug.get(String(filters.category)) || filters.category;
        chips.push(createFilterChip(`Category: ${label}`, () => {
          apply({ ...filters, category: '', page: 1 }).catch((error) => console.error(error));
        }));
      }

      if (filters.brand) {
        const label = brandLabelBySlug.get(String(filters.brand)) || filters.brand;
        chips.push(createFilterChip(`Brand: ${label}`, () => {
          apply({ ...filters, brand: '', page: 1 }).catch((error) => console.error(error));
        }));
      }

      if (filters.rating) {
        chips.push(createFilterChip(`Rating: ${filters.rating}+`, () => {
          apply({ ...filters, rating: '', page: 1 }).catch((error) => console.error(error));
        }));
      }

      const chipMin = Number(filters.minPrice || minRange);
      const chipMax = Number(filters.maxPrice || maxRange);
      const hasPriceChip = Number.isFinite(chipMin)
        && Number.isFinite(chipMax)
        && (Math.round(chipMin) !== Math.round(minRange) || Math.round(chipMax) !== Math.round(maxRange));

      if (hasPriceChip) {
        chips.push(createFilterChip(`Price: ${inr(Math.min(chipMin, chipMax))} - ${inr(Math.max(chipMin, chipMax))}`, () => {
          apply({
            ...filters,
            minPrice: String(minRange),
            maxPrice: String(maxRange),
            page: 1
          }).catch((error) => console.error(error));
        }));
      }

      if (!chips.length) {
        activeFiltersRoot.classList.add('hidden');
        return;
      }

      activeFiltersRoot.classList.remove('hidden');
      chips.forEach((chip) => activeFiltersRoot.appendChild(chip));
    };

    const apply = async (nextFilters) => {
      filters = { ...nextFilters };
      syncInputsFromFilters(filters);
      pushFilters(filters);

      const payload = await api(buildProductQuery(filters));
      const products = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      const pagination = payload?.pagination || { page: Number(filters.page || 1), total_pages: 1 };

      const onWishlistChange = async (product) => {
        const productId = Number(product.id);
        if (!Number.isInteger(productId) || productId <= 0) return;

        if (wishlistProductIds.has(productId)) {
          await api(`/wishlist/items/${productId}`, { method: 'DELETE' });
          wishlistProductIds.delete(productId);
        } else {
          await api('/wishlist/items', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId })
          });
          wishlistProductIds.add(productId);
        }

        renderProducts(productRoot, template, products, wishlistProductIds, onWishlistChange);
      };

      renderProducts(productRoot, template, products, wishlistProductIds, onWishlistChange);
      bindPagination(pagination, (page) => apply({ ...filters, page }));
      renderActiveFilters();
    };

    const reCollectAndApply = () => {
      const minPrice = Array.from(document.querySelectorAll('input[data-filter="minPrice"]'))[0]?.value || '';
      const maxPrice = Array.from(document.querySelectorAll('input[data-filter="maxPrice"]'))[0]?.value || '';
      apply({
        ...filters,
        category: parseChecked('category'),
        brand: parseChecked('brand'),
        rating: parseSelectedRating(),
        minPrice,
        maxPrice,
        page: 1,
        limit: filters.limit || DEFAULT_LIMIT
      }).catch((error) => console.error(error));
    };

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.matches('input[data-filter-group], input[data-filter="minPrice"], input[data-filter="maxPrice"], input[data-filter="rating"]')) {
        if (target.hasAttribute('data-filter-group')) {
          const group = String(target.getAttribute('data-filter-group') || '').trim();
          if (group) {
            const selected = target.checked ? String(target.value || '').trim() : '';
            syncFacetGroup(group, selected);
          }
        }
        if (target.getAttribute('data-filter') === 'minPrice' || target.getAttribute('data-filter') === 'maxPrice') {
          const currentMin = Number(Array.from(document.querySelectorAll('input[data-filter="minPrice"]'))[0]?.value || minRange);
          const currentMax = Number(Array.from(document.querySelectorAll('input[data-filter="maxPrice"]'))[0]?.value || maxRange);
          const safeMin = Math.min(currentMin, currentMax);
          const safeMax = Math.max(currentMin, currentMax);
          syncPriceRange(safeMin, safeMax);
        }
        if (target.getAttribute('data-filter') === 'rating') syncRatingChoice(target.value);
        reCollectAndApply();
      }
    });

    const clearButtons = [
      document.getElementById('desktop-clear-filters'),
      document.getElementById('mobile-clear-filters')
    ].filter(Boolean);

    clearButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        document.querySelectorAll('input[data-filter-group]').forEach((input) => {
          input.checked = false;
        });
        document.querySelectorAll('input[data-filter="rating"]').forEach((input) => {
          input.checked = false;
        });
        syncPriceRange(minRange || 0, maxRange || 5000);
        if (searchInput) searchInput.value = filters.search || '';

        apply({
          ...filters,
          category: '',
          brand: '',
          rating: '',
          search: filters.search || '',
          minPrice: String(minRange || 0),
          maxPrice: String(maxRange || 5000),
          page: 1,
          limit: filters.limit || DEFAULT_LIMIT
        }).catch((error) => console.error(error));
      });
    });

    await apply({
      ...filters,
      limit: filters.limit || DEFAULT_LIMIT,
      minPrice: String(initialMin),
      maxPrice: String(initialMax || maxRange || 5000)
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => console.error(error));
  });
})();
