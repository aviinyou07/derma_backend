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

  const createCategoryTemplate = () => {
    const link = document.createElement('a');
    link.className = 'group flex flex-col items-center w-24 md:w-28 text-center';

    const media = document.createElement('div');
    media.className = 'w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-gray-100 mb-3 transition-transform duration-300 group-hover:scale-110';

    const image = document.createElement('img');
    image.className = 'w-full h-full object-cover';
    image.alt = '';

    const label = document.createElement('span');
    label.className = 'text-sm font-semibold text-gray-800';

    media.appendChild(image);
    link.appendChild(media);
    link.appendChild(label);
    return link;
  };

  const createHomeProductCardTemplate = () => {
    const card = document.createElement('div');
    card.className = 'group flex flex-col gap-4';

    const media = document.createElement('div');
    media.className = 'relative aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden';

    const image = document.createElement('img');
    image.className = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500';
    image.alt = '';

    const button = document.createElement('button');
    button.className = 'absolute bottom-4 left-4 right-4 translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all bg-white dark:bg-slate-900 py-3 rounded-lg font-bold text-xs shadow-xl rounded-full py-2.5 font-medium tracking-tight';
    button.type = 'button';
    button.textContent = 'ADD TO CART';

    media.appendChild(image);
    media.appendChild(button);

    const details = document.createElement('div');

    const title = document.createElement('h4');
    title.className = 'font-bold text-lg mb-1';

    const desc = document.createElement('p');
    desc.className = 'text-sm text-slate-500 mb-2';

    const price = document.createElement('p');
    price.className = 'font-bold text-primary';

    details.appendChild(title);
    details.appendChild(desc);
    details.appendChild(price);

    card.appendChild(media);
    card.appendChild(details);
    return card;
  };

  const upsertGuestCart = (variationId) => {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    const cart = raw ? JSON.parse(raw) : [];
    const item = cart.find((x) => x.variation_id === variationId);
    if (item) item.quantity += 1;
    else cart.push({ variation_id: variationId, quantity: 1 });
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

  const setCategoryItem = (node, category) => {
    node.href = `/productlist?category=${encodeURIComponent(category.slug)}`;
    const img = node.querySelector('img');
    const name = node.querySelector('span');
    if (img) {
      img.src = category.image || `https://picsum.photos/seed/${category.slug}/150/150`;
      img.alt = category.name || '';
    }
    if (name) name.textContent = category.name || '';
    node.style.display = '';
  };

  const setProductCard = (card, product) => {
    const imgs = parseJson(product.images, []);
    const image = imgs[0] || '';

    const imageNode = card.querySelector('img');
    const title = card.querySelector('h4');
    const desc = card.querySelector('p.text-sm');
    const price = card.querySelector('p.font-bold.text-primary');
    const button = Array.from(card.querySelectorAll('button')).find((x) => x.textContent.includes('ADD TO CART'));

    if (imageNode) {
      imageNode.src = image;
      imageNode.alt = product.name || '';
    }
    if (title) title.textContent = product.name || '';
    if (desc) desc.textContent = product.category_name || '';
    if (price) price.textContent = currency(product.starting_price);

    card.style.display = '';
    card.style.cursor = 'pointer';
    card.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      window.location.href = `/productdetails/${product.slug}`;
    });

    if (button) {
      button.onclick = async (event) => {
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

        const originalText = button.textContent;
        button.textContent = 'ADDED';
        button.disabled = true;
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 1200);
      };
    }
  };

  const bindHomeNewsletter = () => {
    const form = document.getElementById('home-newsletter-form');
    const input = document.getElementById('home-newsletter-email');
    const submit = document.getElementById('home-newsletter-submit');
    if (!form || !input || !submit) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = String(input.value || '').trim().toLowerCase();
      if (!email) {
        window.AppUI?.toast?.('Please enter your email', 'error');
        return;
      }

      submit.disabled = true;
      try {
        const payload = await api('/newsletter/subscribe', {
          method: 'POST',
          body: JSON.stringify({ email, source: 'home' })
        });

        input.value = '';
        window.AppUI?.toast?.(payload?.message || 'Subscribed successfully', 'success');
      } catch (error) {
        window.AppUI?.toast?.(error?.message || 'Subscription failed', 'error');
      } finally {
        submit.disabled = false;
      }
    });
  };

  const init = async () => {
    bindHeaderNav();
    bindHomeNewsletter();

    const categoryRoot = document.getElementById('home-categories');
    const featuredRoot = document.getElementById('home-featured-grid');
    const trendingRoot = document.getElementById('home-trending-grid');
    if (!categoryRoot || !featuredRoot || !trendingRoot) return;

    const [categories, featured, trending] = await Promise.all([
      api('/categories?limit=8'),
      api('/products/featured?limit=8'),
      api('/products/trending?limit=8')
    ]);

    clearNode(categoryRoot);
    categories.forEach((category) => {
      const node = createCategoryTemplate();
      setCategoryItem(node, category);
      categoryRoot.appendChild(node);
    });

    clearNode(featuredRoot);
    featured.forEach((product) => {
      const card = createHomeProductCardTemplate();
      setProductCard(card, product);
      featuredRoot.appendChild(card);
    });

    clearNode(trendingRoot);
    trending.forEach((product) => {
      const card = createHomeProductCardTemplate();
      setProductCard(card, product);
      trendingRoot.appendChild(card);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => console.error(error));
  });
})();
