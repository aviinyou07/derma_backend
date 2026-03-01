(() => {
  const API_BASE = '/api';
  const TOKEN_KEY = 'authToken';
  const GUEST_CART_KEY = 'guestCart';

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

  const clearNode = (node) => {
    while (node.firstChild) node.removeChild(node.firstChild);
  };

  const normalizeDescription = (value) => {
    if (typeof value === 'string') return value;
    const parsed = parseJson(value, null);
    if (!parsed) return '';
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) return '';
    if (typeof parsed === 'object') {
      const blocks = [parsed.short, parsed.long, parsed.text, parsed.description, parsed.summary].filter(Boolean);
      return blocks.join(' ');
    }
    return '';
  };

  const normalizeAccordionSections = (value) => {
    const parsed = typeof value === 'string' ? parseJson(value, value) : value;

    const fromArray = (list) => {
      return (Array.isArray(list) ? list : [])
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const title = String(item.title || item.heading || '').trim();
          const content = String(item.content || item.body || item.text || '').trim();
          if (!title || !content) return null;
          return { title, content };
        })
        .filter(Boolean);
    };

    if (Array.isArray(parsed)) {
      const direct = fromArray(parsed);
      if (direct.length) return direct;
      return parsed
        .map((item, index) => {
          const text = String(item || '').trim();
          if (!text) return null;
          return { title: `Details ${index + 1}`, content: text };
        })
        .filter(Boolean);
    }

    if (parsed && typeof parsed === 'object') {
      const nested = fromArray(parsed.accordions || parsed.sections || parsed.details);
      if (nested.length) return nested;

      return Object.entries(parsed)
        .filter(([key, content]) => (
          !['short', 'long', 'text', 'description'].includes(String(key).toLowerCase())
          && (typeof content === 'string' || typeof content === 'number')
        ))
        .map(([key, content]) => ({
          title: String(key).replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
          content: String(content)
        }));
    }

    const fallback = String(parsed || '').trim();
    if (!fallback) return [];
    return [{ title: 'Product Details', content: fallback }];
  };

  const setAccordions = (description) => {
    const root = document.getElementById('pd-accordions');
    if (!root) return;

    const sections = normalizeAccordionSections(description);
    clearNode(root);

    if (!sections.length) {
      root.style.display = 'none';
      return;
    }

    root.style.display = '';

    sections.forEach((section, index) => {
      const node = document.createElement('details');
      node.className = 'group border-b border-slate-200 dark:border-slate-800 pb-4';

      const summary = document.createElement('summary');
      summary.className = 'flex justify-between items-center cursor-pointer list-none py-2 font-bold hover:text-primary transition-colors';
      summary.appendChild(document.createTextNode(section.title));

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined transition-transform group-open:rotate-180';
      icon.textContent = 'expand_more';
      summary.appendChild(icon);

      const content = document.createElement('div');
      content.className = 'pt-2 text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-line';
      content.textContent = section.content;

      node.appendChild(summary);
      node.appendChild(content);
      node.open = index === 0;
      root.appendChild(node);
    });
  };

  const upsertGuestCart = (variationId, quantity) => {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    const cart = raw ? JSON.parse(raw) : [];
    const item = cart.find((x) => x.variation_id === variationId);
    if (item) item.quantity += quantity;
    else cart.push({ variation_id: variationId, quantity });
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  };

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

  const selectProductFromPath = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[1] || '';
  };

  const setMainData = (product) => {
    const images = parseJson(product.images, []);
    const title = document.getElementById('pd-title');
    const desc = document.getElementById('pd-description');
    const price = document.getElementById('pd-price');
    const mainImage = document.getElementById('pd-main-image');
    const breadcrumbName = document.getElementById('pd-breadcrumb-name');

    if (title) title.textContent = product.name || '';
    if (desc) desc.textContent = normalizeDescription(product.description) || '';
    if (price) price.textContent = currency(product.starting_price);
    if (breadcrumbName) breadcrumbName.textContent = product.name || '';
    if (mainImage && images[0]) {
      mainImage.src = images[0];
      mainImage.alt = product.name || '';
    }
  };

  const setReviewCount = async (slug) => {
    const node = document.getElementById('pd-review-count');
    if (!node || !slug) return;

    try {
      const payload = await api(`/products/${encodeURIComponent(slug)}/reviews?limit=1&page=1`);
      const total = Number(payload?.pagination?.total || 0);
      node.textContent = `${total} Review${total === 1 ? '' : 's'}`;
    } catch (_error) {
      node.textContent = '0 Reviews';
    }
  };

  const setGallery = (product) => {
    const images = parseJson(product.images, []);
    const gallery = document.getElementById('pd-gallery');
    if (!gallery) return;

    clearNode(gallery);

    const mainImage = document.getElementById('pd-main-image');

    images.slice(0, 4).forEach((image, index) => {
      const thumbWrap = document.createElement('button');
      thumbWrap.type = 'button';
      thumbWrap.className = index === 0
        ? 'aspect-square rounded-lg overflow-hidden border-2 border-primary ring-2 ring-primary/20'
        : 'aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer hover:opacity-80 transition-opacity';

      const thumb = document.createElement('img');
      thumb.className = 'w-full h-full object-cover';
      thumb.src = image;
      thumb.alt = product.name || '';

      thumbWrap.appendChild(thumb);
      thumbWrap.onclick = () => {
        if (mainImage) {
          mainImage.src = image;
          mainImage.alt = product.name || '';
        }
      };

      gallery.appendChild(thumbWrap);
    });
  };

  const bindVariationSelector = (variations, onChange) => {
    const select = document.getElementById('pd-variation');
    if (!select) return { getSelected: () => variations[0] || null };

    while (select.firstChild) select.removeChild(select.firstChild);

    variations.forEach((variation) => {
      const option = document.createElement('option');
      option.value = String(variation.id);
      option.textContent = `${variation.size || ''} (${variation.stock || 0} in stock)`;
      select.appendChild(option);
    });

    select.onchange = () => {
      const selected = variations.find((v) => v.id === Number(select.value)) || variations[0] || null;
      if (selected && typeof onChange === 'function') onChange(selected);
    };

    const first = variations[0] || null;
    if (first && typeof onChange === 'function') onChange(first);

    return {
      getSelected: () => {
        const id = Number(select.value);
        return variations.find((v) => v.id === id) || variations[0] || null;
      }
    };
  };

  const bindQuantity = () => {
    const qtyInput = document.getElementById('pd-quantity');
    const qtyWrap = qtyInput ? qtyInput.closest('div.flex.items-center') : null;
    const qtyButtons = qtyWrap ? Array.from(qtyWrap.querySelectorAll('button')) : [];
    const minus = qtyButtons[0] || null;
    const plus = qtyButtons[1] || null;

    const getQuantity = () => {
      const parsed = Number(qtyInput?.value || 1);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };

    if (plus && qtyInput) {
      plus.onclick = () => {
        qtyInput.value = String(getQuantity() + 1);
      };
    }

    if (minus && qtyInput) {
      minus.onclick = () => {
        const next = getQuantity() - 1;
        qtyInput.value = String(next > 0 ? next : 1);
      };
    }

    return { getQuantity };
  };

  const bindAddToCart = (selectVariation, getQuantity) => {
    const addBtn = document.getElementById('pd-add-to-cart');
    if (!addBtn) return;

    addBtn.onclick = async () => {
      const variation = selectVariation();
      const quantity = getQuantity();
      if (!variation) return;

      if (isAuthenticated()) {
        await api('/cart/items', {
          method: 'POST',
          body: JSON.stringify({ variation_id: variation.id, quantity })
        });
      } else {
        upsertGuestCart(variation.id, quantity);
      }

      addBtn.disabled = true;
      const old = addBtn.textContent;
      addBtn.textContent = 'ADDED';
      setTimeout(() => {
        addBtn.disabled = false;
        addBtn.textContent = old;
      }, 1000);
    };
  };

  const bindBuyNow = (selectVariation, getQuantity) => {
    const buyBtn = document.getElementById('product-buy-now');
    if (!buyBtn) return;

    buyBtn.onclick = async () => {
      const variation = selectVariation();
      const quantity = getQuantity();
      if (!variation) return;

      sessionStorage.setItem('buyNowItem', JSON.stringify({ variation_id: variation.id, quantity }));
      window.location.href = '/checkout?mode=buy-now';
    };
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

  const bindWishlist = async (product) => {
    const button = document.getElementById('pd-wishlist-btn');
    if (!button) return;

    const productId = Number(product?.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      button.style.display = 'none';
      return;
    }

    const wishlistProductIds = await loadWishlistProductIds();

    const refreshState = () => {
      const isWished = wishlistProductIds.has(productId);
      button.textContent = isWished ? 'REMOVE FROM WISHLIST' : 'ADD TO WISHLIST';
      button.classList.toggle('text-rose-600', isWished);
      button.classList.toggle('border-rose-300', isWished);
    };

    refreshState();

    button.onclick = async () => {
      if (!isAuthenticated()) {
        const ok = await (window.AppUI?.ensureAuth?.() || Promise.resolve(false));
        if (!ok) return;
      }

      try {
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
        refreshState();
      } catch (error) {
        window.AppUI?.toast?.(error?.message || 'Unable to update wishlist', 'error');
      }
    };
  };

  const createRelatedCard = () => {
    const card = document.createElement('div');
    card.className = 'min-w-[260px] snap-start group cursor-pointer';

    const media = document.createElement('div');
    media.className = 'aspect-square rounded-xl overflow-hidden bg-white dark:bg-slate-900 mb-4 relative';
    const image = document.createElement('img');
    image.className = 'w-full h-full object-cover group-hover:scale-110 transition-transform duration-500';
    image.alt = '';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'absolute bottom-4 right-4 bg-white dark:bg-background-dark p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity';
    const addIcon = document.createElement('span');
    addIcon.className = 'material-symbols-outlined text-primary';
    addIcon.textContent = 'add_shopping_cart';
    addButton.appendChild(addIcon);

    media.appendChild(image);
    media.appendChild(addButton);

    const title = document.createElement('h3');
    title.className = 'font-bold text-lg';
    const category = document.createElement('p');
    category.className = 'text-sm text-slate-500 mb-2';
    const price = document.createElement('p');
    price.className = 'font-black';

    card.appendChild(media);
    card.appendChild(title);
    card.appendChild(category);
    card.appendChild(price);

    return { card, image, addButton, title, category, price };
  };

  const renderRelated = (products) => {
    const root = document.getElementById('pd-related-grid');
    if (!root) return;

    clearNode(root);

    products.forEach((product) => {
      const ui = createRelatedCard();
      const imageUrl = parseJson(product.images, [])[0] || '';

      ui.image.src = imageUrl;
      ui.image.alt = product.name || '';
      ui.title.textContent = product.name || '';
      ui.category.textContent = product.category_name || '';
      ui.price.textContent = currency(product.starting_price || 0);

      ui.card.onclick = (event) => {
        if (event.target.closest('button')) return;
        window.location.href = `/productdetails/${product.slug}`;
      };

      ui.addButton.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const detail = await api(`/products/${encodeURIComponent(product.slug)}`);
        const variation = detail?.variations?.[0];
        if (!variation) return;
        if (isAuthenticated()) {
          await api('/cart/items', {
            method: 'POST',
            body: JSON.stringify({ variation_id: variation.id, quantity: 1 })
          });
        } else {
          upsertGuestCart(variation.id, 1);
        }
      };

      root.appendChild(ui.card);
    });

    const buttons = Array.from(document.querySelectorAll('section.pb-20 > div.flex.justify-between button'));
    const leftButton = buttons[0] || null;
    const rightButton = buttons[1] || null;

    leftButton?.addEventListener('click', () => {
      root.scrollBy({ left: -320, behavior: 'smooth' });
    });

    rightButton?.addEventListener('click', () => {
      root.scrollBy({ left: 320, behavior: 'smooth' });
    });
  };

  const init = async () => {
    bindHeaderNav();

    const slug = selectProductFromPath();
    if (!slug) return;

    const product = await api(`/products/${encodeURIComponent(slug)}`);
    const variations = product.variations || [];

    setMainData(product);
    await setReviewCount(slug);
    setGallery(product);
    setAccordions(product.description);
    renderRelated(product.similar_products || []);
    await bindWishlist(product);

    const priceNode = document.getElementById('pd-price');
    const mrpNode = document.getElementById('pd-mrp');
    const addBtn = document.getElementById('pd-add-to-cart');

    const updatePriceBlock = (variation) => {
      if (!variation) return;
      if (priceNode) priceNode.textContent = currency(variation.price || 0);
      if (mrpNode) mrpNode.textContent = currency(variation.mrp || variation.price || 0);
      if (addBtn) addBtn.textContent = `ADD TO CART — ${currency(variation.price || 0)}`;
    };

    const variationHandle = bindVariationSelector(variations, updatePriceBlock);
    const quantityHandle = bindQuantity();

    bindAddToCart(() => variationHandle.getSelected(), () => quantityHandle.getQuantity());
    bindBuyNow(() => variationHandle.getSelected(), () => quantityHandle.getQuantity());
  };

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => console.error(error));
  });
})();
