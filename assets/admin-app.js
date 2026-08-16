// Nexa Digital — Executive Admin Panel Single Page Application
(function () {
  const API_BASE = '/api/admin';
  const TRACK_BASE = '/api/track';

  let state = {
    token: localStorage.getItem('nexa_admin_token') || null,
    user: JSON.parse(localStorage.getItem('nexa_admin_user') || 'null'),
    activeTab: 'dashboard',
    draggedToolId: null, // dashboard, tools, coupons, freebies, reviews
    timeRange: 'today', // today, week, all
    analytics: {
      live_visitors: 0,
      total_visits: 0,
      mobile_visits: 0,
      desktop_visits: 0,
      total_clicks: 0,
      total_tool_views: 0,
      tool_clicks: []
    },
    tools: [],
    categories: [],
    popularPicks: [],
    editingPick: null,
    isNewPick: false,
    coupons: [],
    freebies: [],
    reviews: [],
    searchQuery: '',
    categoryFilter: 'all',
    editingTool: null,
    isNewTool: false,
    editingCoupon: null,
    editingFreebie: null,
    editingReview: null,
    activeToolTab: 'basic', // basic, plans, features, faqs, suggested, seo
    toast: null
  };

  
  function broadcastSync() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('nexa_sync_channel');
        bc.postMessage({ type: 'SYNC_TOOLS', timestamp: Date.now() });
        setTimeout(() => { try { bc.close(); } catch(e) {} }, 100);
      }
    } catch (e) {}
    try {
      localStorage.setItem('nexa_tools_updated', Date.now().toString());
    } catch (e) {}
  }

  function showToast(message, type = 'success') {
    state.toast = { message, type };
    render();
    setTimeout(() => {
      state.toast = null;
      render();
    }, 3500);
  }

  // --- API Calls ---
  async function apiFetch(endpoint, options = {}) {
    options.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.token}`,
      ...(options.headers || {})
    };
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, options);
      if (res.status === 401) {
        logout();
        return null;
      }
      return await res.json();
    } catch (err) {
      console.error('API error:', err);
      showToast('Network error, please check connection', 'error');
      return null;
    }
  }

  async function login(email, password) {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('nexa_admin_token', data.token);
        localStorage.setItem('nexa_admin_user', JSON.stringify(data.user));
        showToast('Welcome back, FAHAD!');
        await loadAllData();
      } else {
        showToast(data.message || 'Invalid credentials', 'error');
      }
    } catch (err) {
      showToast('Login failed', 'error');
    }
  }

  function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('nexa_admin_token');
    localStorage.removeItem('nexa_admin_user');
    render();
  }

  async function loadAllData() {
    if (!state.token) return;
    const [analytics, tools, picks, coupons, freebies, reviews] = await Promise.all([
      apiFetch(`/analytics?range=${state.timeRange}`),
      apiFetch('/tools'),
      apiFetch('/popular-picks'),
      apiFetch('/coupons'),
      apiFetch('/freebies'),
      apiFetch('/reviews')
    ]);

    if (analytics) state.analytics = analytics;
    if (tools) {
      state.tools = tools.tools || [];
      state.categories = tools.categories || [];
    }
    if (picks) state.popularPicks = picks.picks || [];
    if (coupons) state.coupons = coupons.coupons || [];
    if (freebies) state.freebies = freebies.freebies || [];
    if (reviews) state.reviews = reviews.reviews || [];
    render();
  }

  // --- Real-time Polling for Live Visitors ---
  setInterval(async () => {
    if (state.token && state.activeTab === 'dashboard') {
      const analytics = await apiFetch(`/analytics?range=${state.timeRange}`);
      if (analytics) {
        state.analytics = analytics;
        render();
      }
    }
  }, 5000);

  // --- SVG Icons Helper ---
  const icons = {
    picks: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"></path></svg>',
    dashboard: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>',
    tools: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
    coupons: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>',
    freebies: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>',
    reviews: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>',
    whatsapp: '<svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor"><path d="M19.05 4.91A9.816 9.816 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zm-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.22 8.23z"/></svg>',
    external: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>',
    plus: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>',
    star: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>',
    sparkles: '<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>'
  };

  // --- Main Render Function ---
  function render() {
    const root = document.getElementById('app');
    if (!root) return;

    if (!state.token) {
      root.innerHTML = renderLogin();
      bindLoginEvents();
      return;
    }

    root.innerHTML = `
      <div class="flex h-screen overflow-hidden bg-[#09090b]">
        ${renderSidebar()}
        <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
          ${renderTopbar()}
          <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
            ${renderActiveTab()}
          </main>
        </div>
      </div>
      ${state.toast ? renderToast() : ''}
      ${state.editingTool ? renderToolModal() : ''}
      ${state.editingCoupon ? renderCouponModal() : ''}
      ${state.editingFreebie ? renderFreebieModal() : ''}
      ${state.editingReview ? renderReviewModal() : ''}
      ${state.editingPick ? renderPickModal() : ''}
    `;

    bindAppEvents();
  }

  // --- Views ---
  function renderLogin() {
    return `
      <div class="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-[#09090b] to-[#09090b]">
        <div class="w-full max-w-md glass-card rounded-3xl p-8 shadow-2xl border border-zinc-800 relative overflow-hidden">
          <div class="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-zinc-900 border border-amber-500/40 mb-4 shadow-xl shadow-amber-500/25 overflow-hidden p-1">
              <img src="/logo.png" alt="Nexa Digital" class="w-full h-full object-contain">
            </div>
            <h1 class="text-2xl font-bold font-syne tracking-tight text-zinc-100">Nexa Digital Admin</h1>
            <p class="text-sm text-zinc-400 mt-1">Sign in to control tools, coupons, and live analytics</p>
          </div>

          <form id="loginForm" class="space-y-5">
            <div>
              <label class="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Admin Email</label>
              <input type="email" id="email" value="nexadigitaltoools@gmail.com" required class="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors" placeholder="Enter admin email">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Password</label>
              <input type="password" id="password" value="fahad3344" required class="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors" placeholder="••••••••">
            </div>

            <button type="submit" class="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all transform active:scale-[0.98]">
              Access Executive Dashboard
            </button>
          </form>

          <div class="mt-6 text-center text-xs text-zinc-500">
            Protected by Nexa Digital Security Shield & SSL
          </div>
        </div>
      </div>
    `;
  }

  function renderSidebar() {
    const tabs = [
      { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard },
      { id: 'tools', label: 'Tools & Catalog', icon: icons.tools, badge: state.tools.length },
      { id: 'picks', label: 'Popular Picks (Hero)', icon: icons.picks, badge: (state.popularPicks || []).filter(p => p.enabled !== false).length },
      { id: 'coupons', label: 'Coupons Engine', icon: icons.coupons, badge: state.coupons.filter(c => c.is_active).length },
      { id: 'freebies', label: 'Editing Packs', icon: icons.freebies, badge: state.freebies.length },
      { id: 'reviews', label: 'Customer Reviews', icon: icons.reviews, badge: state.reviews.length }
    ];

    return `
      <aside class="w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col shrink-0">
        <div class="p-6 flex items-center gap-3 border-b border-zinc-800/80">
          <div class="w-10 h-10 rounded-xl overflow-hidden bg-zinc-900 border border-amber-500/30 shrink-0 shadow-md shadow-amber-500/20 flex items-center justify-center p-0.5">
            <img src="/logo.png" alt="Nexa Digital" class="w-full h-full object-contain">
          </div>
          <div>
            <div class="font-syne font-bold text-base text-zinc-100 tracking-tight">Nexa Digital</div>
            <div class="text-[11px] text-amber-400/90 font-medium">Control Center</div>
          </div>
        </div>

        <nav class="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          <div class="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-2">Navigation</div>
          ${tabs.map(t => {
            const active = state.activeTab === t.id;
            return `
              <button onclick="window.switchTab('${t.id}')" class="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                active 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
              }">
                <div class="flex items-center gap-3">
                  ${t.icon}
                  <span>${t.label}</span>
                </div>
                ${t.badge !== undefined ? `<span class="px-2 py-0.5 text-[11px] rounded-full font-semibold ${active ? 'bg-amber-400/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'}">${t.badge}</span>` : ''}
              </button>
            `;
          }).join('')}
        </nav>

        <div class="p-4 border-t border-zinc-800/80">
          <div class="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                F
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold text-zinc-200 truncate">FAHAD</div>
                <div class="text-[10px] text-zinc-500 truncate">Super Admin</div>
              </div>
            </div>
            <button onclick="window.logoutAdmin()" title="Logout" class="text-zinc-400 hover:text-red-400 p-1.5 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          </div>
        </div>
      </aside>
    `;
  }

  function renderTopbar() {
    return `
      <header class="h-16 bg-zinc-950/60 backdrop-blur-md border-b border-zinc-800/80 px-6 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <span class="w-2 h-2 rounded-full bg-emerald-500 pulse-live"></span>
            <span class="font-bold">${state.analytics.live_visitors} Live Visitors</span> Active Now
          </span>
        </div>

        <div class="flex items-center gap-3">
          <a href="/" target="_blank" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium border border-zinc-700/80 transition-colors">
            <span>View Live Website</span>
            ${icons.external}
          </a>
        </div>
      </header>
    `;
  }

  function renderActiveTab() {
    switch (state.activeTab) {
      case 'dashboard': return renderDashboardTab();
      case 'tools': return renderToolsTab();
      case 'picks': return renderPopularPicksTab();
      case 'coupons': return renderCouponsTab();
      case 'freebies': return renderFreebiesTab();
      case 'reviews': return renderReviewsTab();
      default: return renderDashboardTab();
    }
  }

  // --- Tab 1: Dashboard Analytics ---
  function renderDashboardTab() {
    const a = state.analytics;
    const mobilePct = a.total_visits ? Math.round((a.mobile_visits / a.total_visits) * 100) : 0;
    const desktopPct = a.total_visits ? (100 - mobilePct) : 0;

    return `
      <div class="space-y-6">
        <!-- Top Filters & Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold font-syne text-zinc-100">Live Traffic & Analytics</h2>
            <p class="text-sm text-zinc-400">Real-time visitor counts, device breakdown, and tool WhatsApp conversions</p>
          </div>

          <div class="inline-flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button onclick="window.setTimeRange('today')" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${state.timeRange === 'today' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}">Today</button>
            <button onclick="window.setTimeRange('week')" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${state.timeRange === 'week' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}">This Week</button>
            <button onclick="window.setTimeRange('all')" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${state.timeRange === 'all' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}">Lifetime</button>
          </div>
        </div>

        <!-- 4 Key Stat Metric Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div class="glass-card rounded-3xl p-6 relative overflow-hidden border-emerald-500/20">
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">Live Traffic</span>
              <span class="w-3 h-3 rounded-full bg-emerald-500 pulse-live"></span>
            </div>
            <div class="text-3xl font-extrabold font-syne text-zinc-100">${a.live_visitors}</div>
            <div class="text-xs text-zinc-400 mt-1">Active users browsing store right now</div>
          </div>

          <div class="glass-card rounded-3xl p-6 relative overflow-hidden border-amber-500/20">
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs font-bold uppercase tracking-wider text-amber-400">Total Visits</span>
              <span class="p-2 rounded-xl bg-amber-500/10 text-amber-400">${icons.dashboard}</span>
            </div>
            <div class="text-3xl font-extrabold font-syne text-zinc-100">${a.total_visits.toLocaleString()}</div>
            <div class="text-xs text-zinc-400 mt-1">Filtered by ${state.timeRange}</div>
          </div>

          <div class="glass-card rounded-3xl p-6 relative overflow-hidden border-blue-500/20">
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs font-bold uppercase tracking-wider text-blue-400">Tool Page Opens</span>
              <span class="p-2 rounded-xl bg-blue-500/10 text-blue-400">${icons.tools}</span>
            </div>
            <div class="text-3xl font-extrabold font-syne text-zinc-100">${a.total_tool_views.toLocaleString()}</div>
            <div class="text-xs text-zinc-400 mt-1">Detail views across all subscriptions</div>
          </div>

          <div class="glass-card rounded-3xl p-6 relative overflow-hidden border-emerald-500/30">
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">WhatsApp Order Clicks</span>
              <span class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">${icons.whatsapp}</span>
            </div>
            <div class="text-3xl font-extrabold font-syne text-emerald-400">${a.total_clicks.toLocaleString()}</div>
            <div class="text-xs text-zinc-400 mt-1">Total checkouts initiated via WhatsApp</div>
          </div>
        </div>

        <!-- Device Breakdown & Top Performing Tools -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Device Breakdown Card -->
          <div class="glass-card rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <h3 class="text-base font-bold font-syne text-zinc-100 mb-1">Device Breakdown</h3>
              <p class="text-xs text-zinc-400 mb-6">Mobile vs Desktop audience ratio</p>

              <div class="space-y-4">
                <div>
                  <div class="flex justify-between text-xs font-medium mb-1.5">
                    <span class="text-zinc-300 flex items-center gap-2">📱 Mobile Users</span>
                    <span class="text-amber-400 font-bold">${mobilePct}% (${a.mobile_visits})</span>
                  </div>
                  <div class="h-3 rounded-full bg-zinc-800 overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500" style="width: ${mobilePct}%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-medium mb-1.5">
                    <span class="text-zinc-300 flex items-center gap-2">💻 Desktop / Tablet</span>
                    <span class="text-blue-400 font-bold">${desktopPct}% (${a.desktop_visits})</span>
                  </div>
                  <div class="h-3 rounded-full bg-zinc-800 overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full transition-all duration-500" style="width: ${desktopPct}%"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-zinc-800/80 text-[11px] text-zinc-500">
              💡 Tip: Over 60% of buyers browse from mobile and order directly to their WhatsApp app.
            </div>
          </div>

          <!-- Click Performance Table -->
          <div class="glass-card rounded-3xl p-6 lg:col-span-2">
            <h3 class="text-base font-bold font-syne text-zinc-100 mb-1">Tool & Plan WhatsApp Conversion</h3>
            <p class="text-xs text-zinc-400 mb-4">Every click on WhatsApp order button tracked by specific tool and selected plan</p>

            ${(a.tool_clicks && a.tool_clicks.length > 0 && a.tool_clicks.some(tc => tc.clicks > 0)) ? `
            <div class="overflow-x-auto custom-scrollbar">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                    <th class="py-3 px-3">Product / Tool</th>
                    <th class="py-3 px-3">Category</th>
                    <th class="py-3 px-3 text-center">Views</th>
                    <th class="py-3 px-3 text-center">WA Clicks</th>
                    <th class="py-3 px-3">Plan Breakdown</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/60">
                  ${(a.tool_clicks || []).filter(tc => tc.clicks > 0).slice(0, 10).map(tc => {
                    const planKeys = Object.keys(tc.plan_breakdown || {});
                    return `
                      <tr class="hover:bg-zinc-900/40 transition-colors">
                        <td class="py-3 px-3 font-semibold text-zinc-200 flex items-center gap-2.5">
                          <img src="${tc.image}" class="w-7 h-7 rounded-lg object-cover bg-zinc-800" onerror="this.src='/placeholder.svg'">
                          <span class="truncate max-w-[140px]">${tc.name}</span>
                        </td>
                        <td class="py-3 px-3 text-zinc-400">${tc.category}</td>
                        <td class="py-3 px-3 text-center font-bold text-zinc-300">${tc.views}</td>
                        <td class="py-3 px-3 text-center font-bold text-emerald-400">${tc.clicks}</td>
                        <td class="py-3 px-3">
                          <div class="flex flex-wrap gap-1">
                            ${planKeys.length ? planKeys.map(k => `
                              <span class="px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700 text-[10px] text-zinc-300">
                                ${k}: <b class="text-amber-400">${tc.plan_breakdown[k]}</b>
                              </span>
                            `).join('') : '<span class="text-zinc-500 text-[10px]">Standard</span>'}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>` : `
            <div class="py-12 text-center text-zinc-500 flex flex-col items-center justify-center">
              <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 mb-3 text-emerald-400">
                ${icons.whatsapp}
              </div>
              <p class="text-sm font-semibold text-zinc-300">No WhatsApp Order Clicks Recorded (0 Clicks)</p>
              <p class="text-xs text-zinc-500 mt-1 max-w-sm">When customers click any WhatsApp order button on the storefront, their tool and plan choices will be tracked here live.</p>
            </div>`}
          </div>
        </div>
      </div>
    `;
  }

  // --- Tab 2: Tools & Catalog ---
  function renderToolsTab() {
    let filtered = state.tools.filter(t => {
      const matchSearch = t.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(state.searchQuery.toLowerCase());
      const matchCategory = state.categoryFilter === 'all' || t.category_id === state.categoryFilter;
      return matchSearch && matchCategory;
    });

    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold font-syne text-zinc-100">Tools & Subscriptions Catalog</h2>
            <p class="text-sm text-zinc-400">Edit pricing, multi-plans, stock status, FAQs, What's Included, and suggested tools</p>
          </div>

          <button onclick="window.openNewToolModal()" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all">
            ${icons.plus}
            <span>Add New Tool</span>
          </button>
        </div>

        <!-- Search & Filter Row -->
        <div class="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div class="relative w-full sm:w-80">
            <input type="text" id="toolSearch" value="${state.searchQuery}" oninput="window.setSearchQuery(this.value)" placeholder="Search tools by name..." class="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors">
          </div>

          <div class="flex items-center gap-3 w-full sm:w-auto">
            <label class="text-xs text-zinc-400 font-medium">Category:</label>
            <select onchange="window.setCategoryFilter(this.value)" class="bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500">
              <option value="all">All Categories (${state.tools.length})</option>
              ${state.categories.map(c => `
                <option value="${c.id}" ${state.categoryFilter === c.id ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Tools List Table -->
        <div class="glass-card rounded-3xl overflow-hidden border border-zinc-800">
          <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th class="py-3.5 px-4 w-12 text-center">Seq</th>
                  <th class="py-3.5 px-4">Tool</th>
                  <th class="py-3.5 px-4">Category</th>
                  <th class="py-3.5 px-4">Starting Price</th>
                  <th class="py-3.5 px-4 text-center">Plans</th>
                  <th class="py-3.5 px-4 text-center">Stock Status</th>
                  <th class="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/60">
                ${filtered.map((t, idx) => `
                  <tr draggable="true" 
                        ondragstart="window.handleToolDragStart(event, '${t.id}')"
                        ondragover="window.handleToolDragOver(event)"
                        ondragleave="window.handleToolDragLeave(event)"
                        ondrop="window.handleToolDrop(event, '${t.id}')"
                        ondragend="window.handleToolDragEnd(event)"
                        class="hover:bg-zinc-900/70 transition-all border-b border-zinc-800/60 group">
                    <td class="py-3 px-3 text-center">
                      <div class="inline-flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-xl px-2 py-1">
                        <span class="text-zinc-500 group-hover:text-amber-400 text-sm font-black cursor-grab active:cursor-grabbing select-none" title="Drag to reorder sequence">⠿</span>
                        <input type="number" min="1" max="${state.tools.length}" value="${idx + 1}" 
                               onchange="window.changeToolPositionInput('${t.id}', this.value)"
                               title="Type number and press Enter to move tool position"
                               class="w-9 bg-zinc-900 border border-zinc-700/80 rounded-md text-center text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500 py-0.5">
                        <div class="flex flex-col -space-y-1">
                          <button onclick="window.moveToolSequence('${t.id}', 'up')" class="text-zinc-500 hover:text-amber-400 text-[10px] leading-tight px-0.5">▲</button>
                          <button onclick="window.moveToolSequence('${t.id}', 'down')" class="text-zinc-500 hover:text-amber-400 text-[10px] leading-tight px-0.5">▼</button>
                        </div>
                      </div>
                    </td>
                    <td class="py-3.5 px-4">
                      <div class="flex items-center gap-3">
                        <img src="${t.image}" class="w-10 h-10 rounded-xl object-cover bg-zinc-800 shrink-0" onerror="this.src='/placeholder.svg'">
                        <div>
                          <div class="font-bold text-zinc-100 text-sm">${t.name}</div>
                          <div class="text-[11px] text-zinc-400 font-mono">/${t.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3.5 px-4 text-zinc-400">${t.category_name}</td>
                    <td class="py-3.5 px-4 font-bold text-amber-400">PKR ${t.price}</td>
                    <td class="py-3.5 px-4 text-center">
                      <span class="px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-zinc-300">
                        ${(t.plans || []).length} Plans
                      </span>
                    </td>
                    <td class="py-3.5 px-4 text-center">
                      <button onclick="window.toggleToolStock('${t.id}')" class="px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                        t.status === 'in_stock'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }">
                        ${t.status === 'in_stock' ? '● In Stock' : '○ Out of Stock'}
                      </button>
                    </td>
                    <td class="py-3.5 px-4 text-right space-x-2">
                      <button onclick="window.editToolModal('${t.id}')" class="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold transition-colors">
                        Edit Tool
                      </button>
                      <button onclick="window.deleteToolConfirm('${t.id}')" class="p-1.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- Tab 3: Coupons Engine ---
  
  // --- Tab 2.5: Today's Popular Picks (Hero Showcase) ---
  function renderPopularPicksTab() {
    const picks = state.popularPicks || [];
    const activeCount = picks.filter(p => p.enabled !== false).length;

    return `
      <div class="space-y-6">
        <!-- Header & Action Controls -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-zinc-800/80 shadow-xl">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
              🔥 Hero Showcase
            </div>
            <h2 class="text-2xl font-bold font-syne text-zinc-100">Today's Popular Picks</h2>
            <p class="text-xs text-zinc-400 mt-1 max-w-xl">
              Control the top featured tools shown in the Homepage Hero section. Edit badges, custom pricing, icons, or add new tools to the showcase.
            </p>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <a href="/" target="_blank" class="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-semibold flex items-center gap-2 transition-all">
              <span>↗</span> View Live Hero
            </a>
            <button onclick="window.openNewPickModal()" class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all">
              <span class="text-base leading-none">+</span> Add Hero Tool
            </button>
          </div>
        </div>

        <!-- Live Hero Preview Banner -->
        <div class="glass-card p-5 rounded-3xl border border-amber-500/20 bg-amber-950/10 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-xs font-bold font-syne text-amber-400 uppercase tracking-wider">Live Homepage Preview</span>
            </div>
            <span class="text-[11px] text-zinc-400">${activeCount} Active Tools on Hero Section</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            ${picks.filter(p => p.enabled !== false).map((p, idx) => `
              <div class="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3 relative group">
                <span class="absolute top-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-bold">#${idx + 1}</span>
                <div class="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 flex items-center justify-center">
                  ${p.icon_url ? `<img src="${p.icon_url}" class="w-full h-full object-cover">` : `<span class="text-amber-400 font-bold font-syne">${(p.name || '?').charAt(0)}</span>`}
                </div>
                <div class="min-w-0 flex-1 pr-4">
                  <div class="text-xs font-bold text-zinc-100 truncate">${p.name}</div>
                  <div class="text-[10px] text-zinc-400 truncate">${p.category_name || 'AI Tools'}</div>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">${p.badge || '🔥 POPULAR'}</span>
                    <span class="text-[11px] font-bold text-emerald-400">PKR ${p.price}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Popular Picks List Table -->
        <div class="glass-card rounded-3xl border border-zinc-800/80 overflow-hidden shadow-xl">
          <div class="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 class="text-sm font-bold font-syne text-zinc-200">Configured Hero Showcase Tools (${picks.length})</h3>
            <span class="text-xs text-zinc-400">Use ▲ ▼ buttons to change order on the homepage</span>
          </div>

          <div class="divide-y divide-zinc-800/60">
            ${picks.length === 0 ? `
              <div class="p-12 text-center text-zinc-500 text-xs">
                No hero tools added yet. Click "+ Add Hero Tool" above to add your first popular pick!
              </div>
            ` : picks.map((p, idx) => `
              <div class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors">
                <div class="flex items-center gap-4 min-w-0">
                  <!-- Sequence badge & step buttons -->
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-xs font-bold text-amber-400">#${idx + 1}</span>
                    <div class="flex flex-col gap-0.5">
                      <button onclick="window.movePickUp(${idx})" ${idx === 0 ? 'disabled class="opacity-30 cursor-not-allowed"' : ''} class="w-5 h-5 rounded bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-[10px] flex items-center justify-center text-zinc-300 transition-colors" title="Move Up">▲</button>
                      <button onclick="window.movePickDown(${idx})" ${idx === picks.length - 1 ? 'disabled class="opacity-30 cursor-not-allowed"' : ''} class="w-5 h-5 rounded bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-[10px] flex items-center justify-center text-zinc-300 transition-colors" title="Move Down">▼</button>
                    </div>
                  </div>

                  <!-- Tool Icon -->
                  <div class="w-12 h-12 rounded-2xl overflow-hidden bg-zinc-900 shrink-0 border border-zinc-700 flex items-center justify-center shadow-md">
                    ${p.icon_url ? `<img src="${p.icon_url}" class="w-full h-full object-cover" onerror="this.src='/placeholder.svg'">` : `<span class="text-lg font-bold text-amber-400 font-syne">${(p.name || '?').charAt(0)}</span>`}
                  </div>

                  <!-- Details -->
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-bold text-zinc-100 font-syne">${p.name}</span>
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">${p.badge || '🔥 POPULAR'}</span>
                    </div>
                    <div class="text-xs text-zinc-400 flex items-center gap-3 mt-1">
                      <span>${p.category_name || 'Category'}</span>
                      <span>•</span>
                      <span class="text-emerald-400 font-semibold">PKR ${p.price}</span>
                      <span>•</span>
                      <span class="text-zinc-500 truncate max-w-xs">Slug: ${p.product_id || p.slug || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <!-- Right Controls & Actions -->
                <div class="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <!-- Active Toggle -->
                  <button onclick="window.togglePick('${p.id}', ${p.enabled === false ? 'true' : 'false'})" class="px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                    p.enabled !== false ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                  }">
                    <span>${p.enabled !== false ? '● Active' : '○ Disabled'}</span>
                  </button>

                  <!-- Edit Button -->
                  <button onclick="window.openEditPickModal('${p.id}')" class="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white transition-colors">
                    Edit
                  </button>

                  <!-- Delete Button -->
                  <button onclick="window.deletePick('${p.id}')" class="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-xs font-semibold text-red-400 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // --- Modal: Add / Edit Popular Pick ---
  function renderPickModal() {
    const p = state.editingPick || {};
    const tools = state.tools || [];

    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div class="w-full max-w-lg glass-card rounded-3xl border border-zinc-700/80 shadow-2xl p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h3 class="text-lg font-bold font-syne text-zinc-100">${state.isNewPick ? 'Add Hero Showcase Tool' : 'Edit Popular Pick'}</h3>
              <p class="text-xs text-zinc-400 mt-0.5">Customize how this tool card appears on the Homepage Hero.</p>
            </div>
            <button onclick="window.closePickModal()" class="text-zinc-400 hover:text-zinc-100 p-1">✕</button>
          </div>

          <form onsubmit="window.savePickModal(event)" class="space-y-4">
            <!-- 1. Select Existing Tool (Auto-Fill) -->
            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Select Tool from Catalog (Auto-fill details)</label>
              <select id="pickProductSelect" onchange="window.onPickToolSelect(this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500">
                <option value="">-- Or enter custom details below --</option>
                ${tools.map(t => `
                  <option value="${t.id}" ${p.product_id === t.id ? 'selected' : ''}>${t.name} (PKR ${t.price}) — ${t.category_name || 'Tool'}</option>
                `).join('')}
              </select>
            </div>

            <!-- 2. Tool Name & Category -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1">Tool Name *</label>
                <input type="text" id="pickName" value="${p.name || ''}" required class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500" placeholder="e.g. CapCut Pro">
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1">Category Label</label>
                <input type="text" id="pickCategory" value="${p.category_name || 'AI Tools'}" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500" placeholder="e.g. Design Tools">
              </div>
            </div>

            <!-- 3. Pricing & Badge -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1">Display Price (PKR) *</label>
                <input type="number" id="pickPrice" value="${p.price || 1000}" required class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500" placeholder="1000">
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1">Highlight Badge *</label>
                <input type="text" id="pickBadge" value="${p.badge || '🔥 POPULAR'}" required class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500" placeholder="e.g. 🔥 HOT, ⭐ POPULAR">
              </div>
            </div>

            <!-- 4. Tool Icon / Image URL with Preview -->
            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Icon / Image URL or Local Path *</label>
              <div class="flex items-center gap-3">
                <input type="text" id="pickIcon" value="${p.icon_url || ''}" oninput="document.getElementById('pickIconPreview').src = this.value" required class="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500" placeholder="https://... or /product-images/...">
                <div class="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 shrink-0 overflow-hidden flex items-center justify-center">
                  <img id="pickIconPreview" src="${p.icon_url || '/placeholder.svg'}" class="w-full h-full object-cover" onerror="this.src='/placeholder.svg'">
                </div>
              </div>
            </div>

            <!-- 5. Target Product Slug / ID -->
            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Target Product Link / Slug</label>
              <input type="text" id="pickProductId" value="${p.product_id || p.slug || ''}" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500" placeholder="e.g. capcut-pro or product UUID">
            </div>

            <!-- 6. Active Toggle -->
            <div class="flex items-center gap-2.5 pt-2">
              <input type="checkbox" id="pickEnabled" ${p.enabled !== false ? 'checked' : ''} class="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0">
              <label for="pickEnabled" class="text-xs font-semibold text-zinc-300 cursor-pointer">Show this tool in Homepage Hero section</label>
            </div>

            <div class="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button type="button" onclick="window.closePickModal()" class="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button type="submit" class="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20">
                ${state.isNewPick ? 'Add to Hero Showcase' : 'Save & Sync Live'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderCouponsTab() {
    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold font-syne text-zinc-100">Discount Coupons Engine</h2>
            <p class="text-sm text-zinc-400">Create promotional promo codes with percentage discounts across all tools or targeted products</p>
          </div>

          <button onclick="window.openNewCouponModal()" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all">
            ${icons.plus}
            <span>Create New Coupon</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          ${state.coupons.map(cp => `
            <div class="glass-card rounded-3xl p-6 border ${cp.is_active ? 'border-amber-500/30' : 'border-zinc-800 opacity-70'} relative overflow-hidden flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between mb-4">
                  <span class="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono font-bold text-base tracking-wider">
                    ${cp.code}
                  </span>
                  <button onclick="window.toggleCouponStatus('${cp.id}')" class="px-2.5 py-1 rounded-full text-xs font-semibold ${
                    cp.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }">
                    ${cp.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>

                <div class="text-3xl font-extrabold font-syne text-zinc-100 mb-2">
                  ${cp.discount_value}% OFF
                </div>

                <div class="text-xs text-zinc-400 space-y-1">
                  <div>Scope: <b class="text-zinc-200">${cp.scope === 'all' ? 'All Tools' : `${(cp.applicable_tools || []).length} Selected Tools`}</b></div>
                  <div>Used: <b class="text-zinc-200">${cp.usage_count || 0} times</b></div>
                </div>
              </div>

              <div class="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <button onclick="window.editCouponModal('${cp.id}')" class="text-xs text-amber-400 hover:underline font-semibold">Edit Details</button>
                <button onclick="window.deleteCouponConfirm('${cp.id}')" class="text-xs text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // --- Tab 4: Editing Packs / Freebies ---
  function renderFreebiesTab() {
    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold font-syne text-zinc-100">Editing Packs & Freebies</h2>
            <p class="text-sm text-zinc-400">Manage graphic assets, 3D icons, LUTs, and drive download links</p>
          </div>

          <button onclick="window.openNewFreebieModal()" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all">
            ${icons.plus}
            <span>Add Editing Pack</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          ${state.freebies.map(fb => `
            <div class="glass-card rounded-3xl p-5 border border-zinc-800 hover:border-amber-500/30 transition-all flex flex-col justify-between">
              <div>
                <img src="${fb.image}" class="w-full h-40 rounded-2xl object-cover bg-zinc-800 mb-4" onerror="this.src='/placeholder.svg'">
                <div class="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">${fb.category}</div>
                <h3 class="text-base font-bold font-syne text-zinc-100 mb-2">${fb.name}</h3>
                <p class="text-xs text-zinc-400 line-clamp-2 mb-4">${fb.description || 'Premium editing bundle for video editors and creators.'}</p>
              </div>

              <div class="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <a href="${fb.download_link}" target="_blank" class="text-xs text-blue-400 hover:underline flex items-center gap-1">
                  <span>Drive Link</span>
                  ${icons.external}
                </a>
                <div class="space-x-2">
                  <button onclick="window.editFreebieModal('${fb.id}')" class="text-xs text-amber-400 font-semibold hover:underline">Edit</button>
                  <button onclick="window.deleteFreebieConfirm('${fb.id}')" class="text-xs text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // --- Tab 5: Reviews & Testimonials ---
  function renderReviewsTab() {
    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold font-syne text-zinc-100">Customer Testimonials & Reviews</h2>
            <p class="text-sm text-zinc-400">Manage client feedbacks, ratings (1-5 stars), designations, and avatar DPs rendered on the homepage</p>
          </div>

          <button onclick="window.openNewReviewModal()" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all">
            ${icons.plus}
            <span>Add Review</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          ${state.reviews.map(rv => `
            <div class="glass-card rounded-3xl p-6 border border-zinc-800 flex flex-col justify-between">
              <div>
                <div class="flex items-center gap-3 mb-4">
                  <img src="${rv.avatar_url}" class="w-12 h-12 rounded-full object-cover border-2 border-amber-500/30 ring-2 ring-amber-500/10" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'">
                  <div>
                    <div class="font-bold text-zinc-100 text-sm">${rv.name}</div>
                    <div class="text-xs text-amber-400 font-medium">${rv.role}</div>
                  </div>
                </div>

                <div class="flex gap-1 mb-3 text-amber-400">
                  ${Array.from({ length: rv.rating || 5 }).map(() => '★').join('')}
                </div>

                <p class="text-xs text-zinc-300 leading-relaxed italic">"${rv.content}"</p>
              </div>

              <div class="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <button onclick="window.editReviewModal('${rv.id}')" class="text-xs text-amber-400 font-semibold hover:underline">Edit Review</button>
                <button onclick="window.deleteReviewConfirm('${rv.id}')" class="text-xs text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // --- Tool Modal (Full Advanced Editor) ---
  function renderToolModal() {
    const t = state.editingTool;
    const isNew = state.isNewTool;

    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar">
        <div class="w-full max-w-4xl glass-card rounded-3xl border border-zinc-700/80 shadow-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
          <!-- Modal Header -->
          <div class="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
            <div>
              <h3 class="text-xl font-bold font-syne text-zinc-100">${isNew ? 'Create New Tool' : `Edit: ${t.name}`}</h3>
              <p class="text-xs text-zinc-400">Configure pricing, plans, FAQs, features, and WhatsApp draft</p>
            </div>
            <button onclick="window.closeToolModal()" class="text-zinc-400 hover:text-zinc-100 p-2 rounded-xl hover:bg-zinc-900 transition-colors">
              ✕
            </button>
          </div>

          <!-- Tab Navigation inside Modal -->
          <div class="flex border-b border-zinc-800 bg-zinc-900/80 px-6 gap-2 overflow-x-auto custom-scrollbar">
            <button onclick="window.setToolTab('basic')" class="py-3 px-4 text-xs font-semibold border-b-2 transition-all ${state.activeToolTab === 'basic' ? 'border-amber-400 text-amber-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}">Basic & Info</button>
            <button onclick="window.setToolTab('plans')" class="py-3 px-4 text-xs font-semibold border-b-2 transition-all ${state.activeToolTab === 'plans' ? 'border-amber-400 text-amber-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}">Plans (${(t.plans || []).length})</button>
            <button onclick="window.setToolTab('features')" class="py-3 px-4 text-xs font-semibold border-b-2 transition-all ${state.activeToolTab === 'features' ? 'border-amber-400 text-amber-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}">What's Included (${(t.features || []).length})</button>
            <button onclick="window.setToolTab('faqs')" class="py-3 px-4 text-xs font-semibold border-b-2 transition-all ${state.activeToolTab === 'faqs' ? 'border-amber-400 text-amber-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}">Product FAQs (${(t.faqs || []).length})</button>
            <button onclick="window.setToolTab('suggested')" class="py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${state.activeToolTab === 'suggested' ? 'border-amber-400 text-amber-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}">
              <span>Suggested Tools</span>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold ${(t.show_suggested !== false) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}">
                ${(t.show_suggested !== false) ? 'ON' : 'OFF'}
              </span>
            </button>
            <button onclick="window.setToolTab('seo')" class="py-3 px-4 text-xs font-semibold border-b-2 transition-all ${state.activeToolTab === 'seo' ? 'border-amber-400 text-amber-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}">SEO & WhatsApp Draft</button>
          </div>

          <!-- Modal Scrollable Body -->
          <div class="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
            ${renderToolModalTabContent(t)}
          </div>

          <!-- Modal Footer -->
          <div class="p-6 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
            <button onclick="window.closeToolModal()" class="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-semibold hover:bg-zinc-900 transition-colors">
              Cancel
            </button>
            <button onclick="window.saveToolModal()" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all">
              Save & Sync Live
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderToolModalTabContent(t) {
    switch (state.activeToolTab) {
      case 'basic':
        return `
          <div class="space-y-5">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Tool Name *</label>
                <input type="text" id="toolName" value="${t.name || ''}" oninput="window.updateToolField('name', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:border-amber-500 font-bold" placeholder="e.g. ChatGPT Plus">
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1.5">URL Slug *</label>
                <input type="text" id="toolSlug" value="${t.slug || ''}" oninput="window.updateToolField('slug', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:border-amber-500 font-mono" placeholder="e.g. chatgpt-plus">
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Category *</label>
                <select onchange="window.updateToolField('category_id', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:border-amber-500 font-semibold">
                  ${state.categories.map(c => `
                    <option value="${c.id}" ${t.category_id === c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Starting / Display Price (PKR) *</label>
                <input type="number" value="${t.price || 0}" oninput="window.updateToolField('price', Number(this.value))" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-amber-400 focus:border-amber-500">
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Stock Status</label>
                <select onchange="window.updateToolField('status', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:border-amber-500 font-semibold">
                  <option value="in_stock" ${t.status === 'in_stock' ? 'selected' : ''}>In Stock (Active)</option>
                  <option value="out_of_stock" ${t.status === 'out_of_stock' ? 'selected' : ''}>Out of Stock</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Discount Badge % (Optional)</label>
                <input type="number" value="${t.discount || 0}" oninput="window.updateToolField('discount', Number(this.value))" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:border-amber-500 font-bold" placeholder="e.g. 50">
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Tool Image URL / Path *</label>
                <div class="flex gap-3 items-center">
                  <input type="text" value="${t.image || ''}" oninput="window.updateToolField('image', this.value)" class="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:border-amber-500" placeholder="e.g. /product-images/chatgpt.png">
                  <img src="${t.image}" class="w-12 h-12 rounded-xl object-cover bg-zinc-800 shrink-0 border border-zinc-700 shadow-md" onerror="this.src='/placeholder.svg'">
                </div>
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Product Description Overview</label>
                <textarea rows="3" oninput="window.updateToolField('description', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-100 focus:border-amber-500" placeholder="Overview of the product...">${t.description || ''}</textarea>
              </div>
            </div>

            <!-- Trust Badges Section -->
            <div class="pt-4 border-t border-zinc-800">
              <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">Service & Trust Guarantee Badges (Shown on Product Page)</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label class="block text-[10px] text-zinc-400 mb-1">⚡ Delivery Time</label>
                  <input type="text" value="${t.delivery_time || '30-90 minutes delivery'}" oninput="window.updateToolField('delivery_time', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-100">
                </div>
                <div>
                  <label class="block text-[10px] text-zinc-400 mb-1">🛡️ Warranty</label>
                  <input type="text" value="${t.warranty || 'Genuine license'}" oninput="window.updateToolField('warranty', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-100">
                </div>
                <div>
                  <label class="block text-[10px] text-zinc-400 mb-1">💰 Refund Guarantee</label>
                  <input type="text" value="${t.refund_policy || 'Full refund guarantee'}" oninput="window.updateToolField('refund_policy', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-100">
                </div>
                <div>
                  <label class="block text-[10px] text-zinc-400 mb-1">💬 Support Info</label>
                  <input type="text" value="${t.support_info || '24/7 WhatsApp support'}" oninput="window.updateToolField('support_info', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-100">
                </div>
              </div>
            </div>
          </div>
        `;

      case 'plans':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-zinc-200 uppercase tracking-wider">Subscription Plans (${(t.plans || []).length})</span>
                <p class="text-[11px] text-zinc-400">Configure multiple pricing tiers (Monthly, Quarterly, Annual, Plus, Pro)</p>
              </div>
              <button onclick="window.addToolPlan()" class="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold transition-all">
                + Add Plan Tier
              </button>
            </div>

            ${(t.plans || []).length === 0 ? `
              <div class="py-8 text-center rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-zinc-500 text-xs">
                No custom plan tiers configured. Default base price will be used. Click "+ Add Plan Tier" to add multi-plans.
              </div>
            ` : `
              <div class="space-y-3">
                ${(t.plans || []).map((pl, idx) => `
                  <div class="glass-card rounded-2xl p-4 border border-zinc-700/80 space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-extrabold text-amber-400 font-syne">Plan #${idx + 1}</span>
                        <span class="text-xs font-bold text-zinc-200">${pl.name || 'Standard'}</span>
                        ${pl.popular ? '<span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-extrabold">BEST VALUE</span>' : ''}
                      </div>
                      <button onclick="window.removeToolPlan(${idx})" class="text-xs text-red-400 hover:text-red-300 font-semibold">✕ Remove</button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label class="block text-[10px] text-zinc-400 mb-1">Plan Name</label>
                        <input type="text" value="${pl.name || ''}" oninput="window.updatePlanField(${idx}, 'name', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-bold" placeholder="e.g. Monthly, Pro">
                      </div>
                      <div>
                        <label class="block text-[10px] text-zinc-400 mb-1">Duration / Period</label>
                        <input type="text" value="${pl.period || '1 Month'}" oninput="window.updatePlanField(${idx}, 'period', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100" placeholder="e.g. 1 Month, Annual">
                      </div>
                      <div>
                        <label class="block text-[10px] text-zinc-400 mb-1">Original Price (PKR)</label>
                        <input type="number" value="${pl.original_price || ''}" oninput="window.updatePlanField(${idx}, 'original_price', Number(this.value))" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400">
                      </div>
                      <div>
                        <label class="block text-[10px] text-zinc-400 mb-1">Discounted Price (PKR) *</label>
                        <input type="number" value="${pl.discounted_price || ''}" oninput="window.updatePlanField(${idx}, 'discounted_price', Number(this.value))" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-400 font-black">
                      </div>
                      <div class="flex items-center gap-2 pt-4">
                        <input type="checkbox" id="popular_${idx}" ${pl.popular ? 'checked' : ''} onchange="window.updatePlanField(${idx}, 'popular', this.checked)" class="w-4 h-4 accent-amber-500 rounded">
                        <label for="popular_${idx}" class="text-[11px] text-zinc-300 font-semibold cursor-pointer">Best Value Badge</label>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        `;

      case 'features':
        const rawFeatures = t.features || [];
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-zinc-200 uppercase tracking-wider">What's Included / Key Features (${rawFeatures.length})</h4>
                <p class="text-[11px] text-zinc-400">Bullet points rendered on the product detail page</p>
              </div>
              <button onclick="window.addToolFeature()" class="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold transition-all">
                + Add Bullet Point
              </button>
            </div>

            <div class="space-y-2 max-h-96 overflow-y-auto custom-scrollbar p-1">
              ${rawFeatures.map((ft, idx) => {
                const ftText = typeof ft === 'string' ? ft : (ft.feature || '');
                return `
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-amber-400 font-bold">✓</span>
                    <input type="text" value="${ftText}" oninput="window.updateFeatureField(${idx}, this.value)" class="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:border-amber-500" placeholder="e.g. 100% Official Account">
                    <button onclick="window.removeToolFeature(${idx})" class="p-2 text-zinc-500 hover:text-red-400">✕</button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

      case 'faqs':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-zinc-200 uppercase tracking-wider">Product FAQs Accordion (${(t.faqs || []).length})</h4>
                <p class="text-[11px] text-zinc-400">Frequently asked questions specific to this product</p>
              </div>
              <button onclick="window.addToolFaq()" class="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold transition-all">
                + Add FAQ Question
              </button>
            </div>

            <div class="space-y-3 max-h-96 overflow-y-auto custom-scrollbar p-1">
              ${(t.faqs || []).map((fq, idx) => `
                <div class="glass-card rounded-2xl p-4 border border-zinc-700/80 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-amber-400">Question #${idx + 1}</span>
                    <button onclick="window.removeToolFaq(${idx})" class="text-xs text-red-400 hover:text-red-300 font-semibold">✕ Remove</button>
                  </div>
                  <input type="text" value="${fq.question || ''}" oninput="window.updateFaqField(${idx}, 'question', this.value)" placeholder="Enter question..." class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 font-semibold">
                  <textarea rows="2" oninput="window.updateFaqField(${idx}, 'answer', this.value)" placeholder="Enter detailed answer..." class="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-300 focus:border-amber-500">${fq.answer || ''}</textarea>
                </div>
              `).join('')}
            </div>
          </div>
        `;

      case 'suggested':
        const isSuggestedEnabled = t.show_suggested !== false;
        const selectedIds = t.suggested_tools || [];
        return `
          <div class="space-y-5">
            <!-- ON / OFF Toggle Header -->
            <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="text-xs font-bold text-zinc-100 uppercase tracking-wider">Suggested Tools (You May Also Like)</h4>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold ${isSuggestedEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}">
                    ${isSuggestedEnabled ? '● ON (ACTIVE)' : '○ OFF (DISABLED)'}
                  </span>
                </div>
                <p class="text-xs text-zinc-400 mt-1">Show or hide recommended related tools at the bottom of this product's detail page</p>
              </div>

              <button type="button" onclick="window.toggleSuggestedToolsStatus()" class="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                isSuggestedEnabled
                  ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
              }">
                ${isSuggestedEnabled ? '✓ Enabled on Web' : '✗ Turned Off'}
              </button>
            </div>

            ${isSuggestedEnabled ? `
              <div>
                <div class="flex items-center justify-between mb-2">
                  <p class="text-xs text-zinc-300 font-semibold">Select 4 Recommended Tools (Selected: <b class="text-amber-400">${selectedIds.length} / 4</b>)</p>
                  <span class="text-[11px] text-zinc-500">Click any card to select/deselect</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto custom-scrollbar p-1">
                  ${state.tools.filter(item => item.id !== t.id).map(item => {
                    const isSelected = selectedIds.includes(item.id);
                    return `
                      <div onclick="window.toggleSuggestedTool('${item.id}')" class="p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                        isSelected ? 'bg-amber-500/10 border-amber-500/50 shadow-sm shadow-amber-500/10' : 'glass-card border-zinc-800 hover:border-zinc-700'
                      }">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} class="rounded bg-zinc-900 border-zinc-700 text-amber-500">
                        <img src="${item.image}" class="w-8 h-8 rounded-lg object-cover bg-zinc-800 shrink-0" onerror="this.src='/placeholder.svg'">
                        <div class="min-w-0">
                          <div class="text-xs font-semibold text-zinc-200 truncate">${item.name}</div>
                          <div class="text-[10px] text-zinc-400">PKR ${item.price}</div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : `
              <div class="py-10 px-4 text-center rounded-2xl bg-zinc-900/50 border border-dashed border-zinc-800 text-zinc-500">
                <div class="text-2xl mb-2">🚫</div>
                <div class="text-xs font-bold text-zinc-300">Suggested Tools Section is Turned OFF for this Product</div>
                <p class="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">The "You May Also Like" recommendation block will be completely hidden on this tool's page. Click "Turned Off" above to re-enable.</p>
              </div>
            `}
          </div>
        `;

      case 'seo':
        return `
          <div class="space-y-5">
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">WhatsApp Order Message Draft</label>
                <button onclick="window.aiAutoFillDraft()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all">
                  ${icons.sparkles}
                  <span>✨ AI Auto-Fill Draft</span>
                </button>
              </div>
              <textarea rows="5" oninput="window.updateToolField('whatsapp_message', this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-100 font-mono focus:border-amber-500" placeholder="Hi! I want to purchase {product_name}...">${t.whatsapp_message || ''}</textarea>
              <p class="text-[11px] text-zinc-500 mt-1">Variables available: {product_name}, {plan_name}, {price}, {currency}</p>
            </div>
          </div>
        `;
      default:
        return '';
    }
  }

  function renderCouponModal() {
    const cp = state.editingCoupon;
    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div class="w-full max-w-lg glass-card rounded-3xl border border-zinc-700/80 shadow-2xl p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h3 class="text-lg font-bold font-syne text-zinc-100">${cp.id ? 'Edit Coupon' : 'Create New Coupon'}</h3>
            <button onclick="window.closeCouponModal()" class="text-zinc-400 hover:text-zinc-100">✕</button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Coupon Code *</label>
              <input type="text" value="${cp.code || ''}" oninput="state.editingCoupon.code = this.value.toUpperCase()" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-amber-400 font-mono font-bold uppercase">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Discount Value (% Off) *</label>
              <input type="number" value="${cp.discount_value || 20}" oninput="state.editingCoupon.discount_value = Number(this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Applicable Scope</label>
              <select onchange="state.editingCoupon.scope = this.value; render();" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100">
                <option value="all" ${cp.scope === 'all' ? 'selected' : ''}>Apply to All Tools</option>
                <option value="specific" ${cp.scope === 'specific' ? 'selected' : ''}>Apply to Specific Selected Tools</option>
              </select>
            </div>

            ${cp.scope === 'specific' ? `
              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1">Select Applicable Tools (${(cp.applicable_tools || []).length} selected)</label>
                <div class="max-h-48 overflow-y-auto custom-scrollbar border border-zinc-800 rounded-xl p-2 space-y-1 bg-zinc-950">
                  ${state.tools.map(t => {
                    const sel = (cp.applicable_tools || []).includes(t.id);
                    return `
                      <label class="flex items-center gap-2 p-2 hover:bg-zinc-900 rounded-lg text-xs cursor-pointer">
                        <input type="checkbox" ${sel ? 'checked' : ''} onchange="window.toggleCouponTool('${t.id}')" class="rounded text-amber-500">
                        <span class="text-zinc-200 truncate">${t.name}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            <label class="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" ${cp.is_active ? 'checked' : ''} onchange="state.editingCoupon.is_active = this.checked" class="rounded text-emerald-500">
              <span>Coupon is Active</span>
            </label>
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onclick="window.closeCouponModal()" class="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200">Cancel</button>
            <button onclick="window.saveCouponModal()" class="px-5 py-2.5 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs">Save Coupon</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderFreebieModal() {
    const fb = state.editingFreebie;
    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div class="w-full max-w-lg glass-card rounded-3xl border border-zinc-700/80 shadow-2xl p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h3 class="text-lg font-bold font-syne text-zinc-100">${fb.id ? 'Edit Pack' : 'Add Editing Pack'}</h3>
            <button onclick="window.closeFreebieModal()" class="text-zinc-400 hover:text-zinc-100">✕</button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Pack Title *</label>
              <input type="text" value="${fb.name || ''}" oninput="state.editingFreebie.name = this.value" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Category (e.g. LUTs, 3D Icons, GFX) *</label>
              <input type="text" value="${fb.category || 'Editing Packs'}" oninput="state.editingFreebie.category = this.value" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Thumbnail Image URL *</label>
              <input type="text" value="${fb.image || ''}" oninput="state.editingFreebie.image = this.value" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Direct Download / Drive Link *</label>
              <input type="text" value="${fb.download_link || ''}" oninput="state.editingFreebie.download_link = this.value" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Description</label>
              <textarea rows="3" oninput="state.editingFreebie.description = this.value" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-100">${fb.description || ''}</textarea>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onclick="window.closeFreebieModal()" class="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200">Cancel</button>
            <button onclick="window.saveFreebieModal()" class="px-5 py-2.5 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs">Save Pack</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderReviewModal() {
    const rv = state.editingReview;
    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div class="w-full max-w-lg glass-card rounded-3xl border border-zinc-700/80 shadow-2xl p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h3 class="text-lg font-bold font-syne text-zinc-100">${rv.id ? 'Edit Testimonial' : 'Add Testimonial'}</h3>
            <button onclick="window.closeReviewModal()" class="text-zinc-400 hover:text-zinc-100">✕</button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Client Name *</label>
              <input type="text" value="${rv.name || ''}" oninput="state.editingReview.name = this.value" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100" placeholder="e.g. Hamza Khan">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Niche / Profession *</label>
              <input type="text" value="${rv.role || ''}" oninput="state.editingReview.role = this.value" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100" placeholder="e.g. Content Creator, Video Editor">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Rating (1 to 5 Stars)</label>
              <select onchange="state.editingReview.rating = Number(this.value)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100">
                <option value="5" ${(rv.rating || 5) === 5 ? 'selected' : ''}>★★★★★ (5 Stars)</option>
                <option value="4" ${rv.rating === 4 ? 'selected' : ''}>★★★★☆ (4 Stars)</option>
                <option value="3" ${rv.rating === 3 ? 'selected' : ''}>★★★☆☆ (3 Stars)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Avatar / DP Photo URL *</label>
              <input type="text" value="${rv.avatar_url || ''}" oninput="state.editingReview.avatar_url = this.value" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100" placeholder="https://images.unsplash.com/...">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Review Message Text *</label>
              <textarea rows="3" oninput="state.editingReview.content = this.value" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-100" placeholder="Customer feedback...">${rv.content || ''}</textarea>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onclick="window.closeReviewModal()" class="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200">Cancel</button>
            <button onclick="window.saveReviewModal()" class="px-5 py-2.5 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs">Save Review</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderToast() {
    const isError = state.toast.type === 'error';
    return `
      <div class="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-3 transition-all ${
        isError ? 'bg-red-950/90 border-red-500/50 text-red-300' : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
      }">
        <span>${isError ? '⚠️' : '✓'}</span>
        <span>${state.toast.message}</span>
      </div>
    `;
  }

  // --- Global Window Handler Attachments ---
  window.switchTab = function (tab) {
    state.activeTab = tab;
    render();
  };

  window.setTimeRange = async function (range) {
    state.timeRange = range;
    const a = await apiFetch(`/analytics?range=${range}`);
    if (a) state.analytics = a;
    render();
  };

  window.logoutAdmin = logout;

  
  
  window.onPickToolSelect = (toolId) => {
    if (!toolId) return;
    const tool = state.tools.find(t => t.id === toolId);
    if (!tool) return;
    document.getElementById('pickName').value = tool.name;
    document.getElementById('pickCategory').value = tool.category_name || 'AI Tools';
    document.getElementById('pickPrice').value = tool.price || 1000;
    document.getElementById('pickIcon').value = tool.image || '';
    document.getElementById('pickIconPreview').src = tool.image || '/placeholder.svg';
    document.getElementById('pickProductId').value = tool.slug || tool.id;
  };

  window.savePickModal = async (e) => {
    e.preventDefault();
    const name = document.getElementById('pickName').value.trim();
    const category_name = document.getElementById('pickCategory').value.trim();
    const price = Number(document.getElementById('pickPrice').value);
    const badge = document.getElementById('pickBadge').value.trim();
    const icon_url = document.getElementById('pickIcon').value.trim();
    const product_id = document.getElementById('pickProductId').value.trim();
    const enabled = document.getElementById('pickEnabled').checked;

    const payload = {
      name,
      category_name,
      price,
      badge,
      icon_url,
      product_id: product_id || ('prod_' + Date.now()),
      enabled
    };

    if (state.isNewPick) {
      const res = await apiFetch('/popular-picks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && res.success) {
        broadcastSync();
        showToast('Hero showcase tool added & synced live!');
      }
    } else {
      const res = await apiFetch(`/popular-picks/${state.editingPick.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res && res.success) {
        broadcastSync();
        showToast('Hero tool updated & synced live!');
      }
    }

    state.editingPick = null;
    state.isNewPick = false;
    await loadAllData();
  };

  window.movePickUp = async (idx) => {
    if (idx <= 0) return;
    const picks = [...state.popularPicks];
    const temp = picks[idx];
    picks[idx] = picks[idx - 1];
    picks[idx - 1] = temp;
    state.popularPicks = picks;
    render();

    const ids = picks.map(p => p.id);
    const res = await apiFetch('/popular-picks-reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids })
    });
    if (res && res.success) {
      broadcastSync();
      showToast('Hero tools sequence updated!');
    }
  };

  window.movePickDown = async (idx) => {
    if (idx >= state.popularPicks.length - 1) return;
    const picks = [...state.popularPicks];
    const temp = picks[idx];
    picks[idx] = picks[idx + 1];
    picks[idx + 1] = temp;
    state.popularPicks = picks;
    render();

    const ids = picks.map(p => p.id);
    const res = await apiFetch('/popular-picks-reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids })
    });
    if (res && res.success) {
      broadcastSync();
      showToast('Hero tools sequence updated!');
    }
  };

  window.openNewPickModal = () => {
    const firstTool = state.tools[0] || {};
    state.editingPick = {
      product_id: firstTool.id,
      name: firstTool.name,
      price: firstTool.price,
      category_name: firstTool.category_name,
      badge: '🔥 HOT',
      icon_url: firstTool.image,
      enabled: true
    };
    state.isNewPick = true;
    render();
  };

  window.openEditPickModal = (id) => {
    const pick = state.popularPicks.find(p => p.id === id);
    if (!pick) return;
    state.editingPick = { ...pick };
    state.isNewPick = false;
    render();
  };

  window.closePickModal = () => {
    state.editingPick = null;
    state.isNewPick = false;
    render();
  };

  window.savePick = async (e) => {
    e.preventDefault();
    const prodId = document.getElementById('pickProduct').value;
    const badge = document.getElementById('pickBadge').value;
    const iconUrl = document.getElementById('pickIcon').value;
    const enabled = document.getElementById('pickEnabled').checked;

    const payload = {
      product_id: prodId,
      badge: badge,
      icon_url: iconUrl,
      enabled: enabled
    };

    if (state.isNewPick) {
      const res = await apiFetch('/popular-picks', { method: 'POST', body: JSON.stringify(payload) });
      if (res && res.success) {
      broadcastSync();
        showToast('Popular pick added to Hero Showcase!');
      }
    } else {
      const res = await apiFetch(`/popular-picks/${state.editingPick.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (res && res.success) {
        showToast('Popular pick updated successfully!');
      }
    }

    state.editingPick = null;
    await loadAllData();
  };

  window.deletePick = async (id) => {
    if (!confirm('Are you sure you want to remove this tool from Popular Picks?')) return;
    const res = await apiFetch(`/popular-picks/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      showToast('Popular pick removed');
      await loadAllData();
    }
  };

  window.togglePick = async (id, enabled) => {
    const res = await apiFetch(`/popular-picks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
    if (res && res.success) {
      showToast(enabled ? 'Pick activated on Hero!' : 'Pick disabled');
      await loadAllData();
    }
  };

  window.setSearchQuery = function (q) {
    state.searchQuery = q;
    render();
  };

  window.setCategoryFilter = function (cat) {
    state.categoryFilter = cat;
    render();
  };

  window.toggleToolStock = async function (id) {
    const tool = state.tools.find(t => t.id === id);
    if (!tool) return;
    const newStatus = tool.status === 'in_stock' ? 'out_of_stock' : 'in_stock';
    tool.status = newStatus;
    render();

    const res = await apiFetch(`/tools/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    if (res && res.success) {
      showToast(`${tool.name} marked as ${newStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}`);
    }
  };

  
  window.toggleSuggestedToolsStatus = () => {
    if (!state.editingTool) return;
    const cur = state.editingTool.show_suggested !== false;
    state.editingTool.show_suggested = !cur;
    render();
  };

  window.handleToolDragStart = (e, toolId) => {
    state.draggedToolId = toolId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', toolId);
    e.currentTarget.classList.add('opacity-40', 'bg-amber-500/10');
  };

  window.handleToolDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const row = e.currentTarget.closest('tr');
    if (row) {
      row.classList.add('border-t-2', 'border-amber-400');
    }
  };

  window.handleToolDragLeave = (e) => {
    const row = e.currentTarget.closest('tr');
    if (row) {
      row.classList.remove('border-t-2', 'border-amber-400');
    }
  };

  window.handleToolDragEnd = (e) => {
    state.draggedToolId = null;
    document.querySelectorAll('tr').forEach(r => {
      r.classList.remove('opacity-40', 'bg-amber-500/10', 'border-t-2', 'border-amber-400');
    });
  };

  window.handleToolDrop = async (e, targetToolId) => {
    e.preventDefault();
    document.querySelectorAll('tr').forEach(r => {
      r.classList.remove('opacity-40', 'bg-amber-500/10', 'border-t-2', 'border-amber-400');
    });

    const srcId = state.draggedToolId || e.dataTransfer.getData('text/plain');
    if (!srcId || srcId === targetToolId) return;

    const fromIdx = state.tools.findIndex(t => t.id === srcId);
    const toIdx = state.tools.findIndex(t => t.id === targetToolId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Move tool in array
    const moved = state.tools.splice(fromIdx, 1)[0];
    state.tools.splice(toIdx, 0, moved);

    // Update sequence numbers
    state.tools.forEach((t, i) => { t.sort_order = i; });
    render();

    const ids = state.tools.map(t => t.id);
    const res = await apiFetch('/tools/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });
    if (res && res.success) {
      showToast(`Moved "${moved.name}" to position #${toIdx + 1} live!`);
      broadcastSync();
    }
  };

  
  window.changeToolPositionInput = async (toolId, newPosStr) => {
    const newPos = parseInt(newPosStr, 10);
    if (isNaN(newPos) || newPos < 1 || newPos > state.tools.length) return;
    const targetIdx = newPos - 1;
    const curIdx = state.tools.findIndex(t => t.id === toolId);
    if (curIdx === -1 || curIdx === targetIdx) return;

    const moved = state.tools.splice(curIdx, 1)[0];
    state.tools.splice(targetIdx, 0, moved);
    state.tools.forEach((t, i) => { t.sort_order = i; });
    render();

    const ids = state.tools.map(t => t.id);
    const res = await apiFetch('/tools/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });
    if (res && res.success) {
      showToast(`Moved "${moved.name}" to position #${newPos}!`);
      broadcastSync();
    }
  };

  window.moveToolSequence = async function (id, direction) {
    const index = state.tools.findIndex(t => t.id === id);
    if (index === -1) return;
    if (direction === 'up' && index > 0) {
      const temp = state.tools[index];
      state.tools[index] = state.tools[index - 1];
      state.tools[index - 1] = temp;
    } else if (direction === 'down' && index < state.tools.length - 1) {
      const temp = state.tools[index];
      state.tools[index] = state.tools[index + 1];
      state.tools[index + 1] = temp;
    }
    render();

    const reorderedIds = state.tools.map(t => t.id);
    await apiFetch('/tools/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids: reorderedIds })
    });
  };

  window.openNewToolModal = function () {
    state.isNewTool = true;
    state.editingTool = {
      name: '',
      slug: '',
      category_id: state.categories[0] ? state.categories[0].id : '',
      category_name: state.categories[0] ? state.categories[0].name : 'Tools',
      price: 400,
      image: '/product-images/fa277e88981321dbb2b8b21e19331e2c.png',
      description: '',
      status: 'in_stock',
      delivery_time: '30-90 minutes delivery',
      warranty: 'Genuine license',
      refund_policy: 'Full refund guarantee',
      whatsapp_message: 'Assalam-o-Alaikum Nexa Digital!\nI want to order *{product_name}* (Plan: *{plan_name}*).\nPrice: {currency} {price} ({period})\nPlease send payment details.',
      plans: [
        { name: 'Monthly Plan', period: '1 Month', original_price: 1500, discounted_price: 400, popular: true }
      ],
      features: ['100% Genuine Official License', 'Instant Delivery on WhatsApp', 'Full Replacement Warranty'],
      faqs: [{ question: 'How fast is delivery?', answer: 'Within 2-5 minutes on WhatsApp.' }],
      suggested_tools: state.tools.slice(0, 4).map(t => t.id),
      seo: { meta_title: '', meta_description: '', keywords: '' }
    };
    state.activeToolTab = 'basic';
    render();
  };

  window.editToolModal = function (id) {
    const tool = state.tools.find(t => t.id === id);
    if (!tool) return;
    state.isNewTool = false;
    state.editingTool = JSON.parse(JSON.stringify(tool));
    state.activeToolTab = 'basic';
    render();
  };

  window.closeToolModal = function () {
    state.editingTool = null;
    render();
  };

  window.setToolTab = function (tab) {
    state.activeToolTab = tab;
    render();
  };

  window.updateToolField = function (field, value) {
    if (!state.editingTool) return;
    state.editingTool[field] = value;
    if (field === 'name' && (!state.editingTool.slug || state.isNewTool)) {
      state.editingTool.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (field === 'price') {
      const numVal = Number(value);
      state.editingTool.price = numVal;
      if (state.editingTool.plans && state.editingTool.plans.length > 0) {
        state.editingTool.plans[0].discounted_price = numVal;
      }
    }
  };

  window.updateSeoField = function (field, value) {
    if (!state.editingTool) return;
    if (!state.editingTool.seo) state.editingTool.seo = {};
    state.editingTool.seo[field] = value;
  };

  window.addToolPlan = function () {
    if (!state.editingTool) return;
    if (!state.editingTool.plans) state.editingTool.plans = [];
    state.editingTool.plans.push({
      name: 'Pro Plan',
      period: '1 Month',
      original_price: state.editingTool.price * 2,
      discounted_price: state.editingTool.price,
      popular: false
    });
    render();
  };

  window.removeToolPlan = function (idx) {
    if (!state.editingTool || !state.editingTool.plans) return;
    state.editingTool.plans.splice(idx, 1);
    render();
  };

  window.updatePlanField = function (idx, field, value) {
    if (!state.editingTool || !state.editingTool.plans || !state.editingTool.plans[idx]) return;
    state.editingTool.plans[idx][field] = value;
    if (field === 'discounted_price' && idx === 0) {
      state.editingTool.price = Number(value);
    }
  };

  window.addToolFeature = function () {
    if (!state.editingTool) return;
    if (!state.editingTool.features) state.editingTool.features = [];
    state.editingTool.features.push('Premium Access Granted');
    render();
  };

  window.removeToolFeature = function (idx) {
    if (!state.editingTool || !state.editingTool.features) return;
    state.editingTool.features.splice(idx, 1);
    render();
  };

  window.updateFeatureField = function (idx, value) {
    if (!state.editingTool || !state.editingTool.features) return;
    state.editingTool.features[idx] = value;
  };

  window.addToolFaq = function () {
    if (!state.editingTool) return;
    if (!state.editingTool.faqs) state.editingTool.faqs = [];
    state.editingTool.faqs.push({ question: 'Is this account private?', answer: 'Yes, 100% official and private.' });
    render();
  };

  window.removeToolFaq = function (idx) {
    if (!state.editingTool || !state.editingTool.faqs) return;
    state.editingTool.faqs.splice(idx, 1);
    render();
  };

  window.updateFaqField = function (idx, field, value) {
    if (!state.editingTool || !state.editingTool.faqs || !state.editingTool.faqs[idx]) return;
    state.editingTool.faqs[idx][field] = value;
  };

  window.toggleSuggestedTool = function (toolId) {
    if (!state.editingTool) return;
    let list = state.editingTool.suggested_tools || [];
    if (list.includes(toolId)) {
      list = list.filter(id => id !== toolId);
    } else {
      if (list.length >= 4) {
        showToast('Maximum 4 suggested tools can be selected', 'error');
        return;
      }
      list.push(toolId);
    }
    state.editingTool.suggested_tools = list;
    render();
  };

  window.aiAutoFillDraft = function () {
    if (!state.editingTool) return;
    state.editingTool.whatsapp_message = `Assalam-o-Alaikum Nexa Digital!\nI want to order *{product_name}* (Plan: *{plan_name}*).\nPrice: {currency} {price} ({period})\nPlease send payment details.`;
    showToast('✨ Standard Nexa Digital draft template auto-generated!');
    render();
  };

  window.saveToolModal = async function () {
    const t = state.editingTool;
    if (!t.name) {
      showToast('Tool name is required', 'error');
      return;
    }

    const cat = state.categories.find(c => c.id === t.category_id);
    if (cat) t.category_name = cat.name;

    if (t.price) t.price = Number(t.price);
    if (t.plans && t.plans.length > 0 && t.price) {
      if (!t.plans[0].discounted_price || t.plans.length === 1) {
        t.plans[0].discounted_price = Number(t.price);
      }
    }

    if (state.isNewTool) {
      const res = await apiFetch('/tools', {
        method: 'POST',
        body: JSON.stringify(t)
      });
      if (res && res.success) {
        showToast('Tool created successfully!');
        state.editingTool = null;
        await loadAllData();
      }
    } else {
      const res = await apiFetch(`/tools/${t.id}`, {
        method: 'PUT',
        body: JSON.stringify(t)
      });
      if (res && res.success) {
        showToast('Tool updated & synced live!');
        state.editingTool = null;
        await loadAllData();
      }
    }
  };

  window.deleteToolConfirm = async function (id) {
    if (!confirm('Are you sure you want to delete this tool?')) return;
    const res = await apiFetch(`/tools/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      showToast('Tool deleted');
      await loadAllData();
    }
  };

  // --- Coupon Modals ---
  window.openNewCouponModal = function () {
    state.editingCoupon = {
      code: '',
      discount_value: 20,
      scope: 'all',
      applicable_tools: [],
      is_active: true
    };
    render();
  };

  window.editCouponModal = function (id) {
    const cp = state.coupons.find(c => c.id === id);
    if (!cp) return;
    state.editingCoupon = JSON.parse(JSON.stringify(cp));
    render();
  };

  window.closeCouponModal = function () {
    state.editingCoupon = null;
    render();
  };

  window.toggleCouponTool = function (toolId) {
    if (!state.editingCoupon) return;
    let list = state.editingCoupon.applicable_tools || [];
    if (list.includes(toolId)) {
      list = list.filter(id => id !== toolId);
    } else {
      list.push(toolId);
    }
    state.editingCoupon.applicable_tools = list;
    render();
  };

  window.toggleCouponStatus = async function (id) {
    const cp = state.coupons.find(c => c.id === id);
    if (!cp) return;
    cp.is_active = !cp.is_active;
    render();
    await apiFetch(`/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: cp.is_active })
    });
    showToast(`Coupon ${cp.code} ${cp.is_active ? 'activated' : 'disabled'}`);
  };

  window.saveCouponModal = async function () {
    const cp = state.editingCoupon;
    if (!cp.code) {
      showToast('Coupon code is required', 'error');
      return;
    }
    if (cp.id) {
      await apiFetch(`/coupons/${cp.id}`, { method: 'PUT', body: JSON.stringify(cp) });
    } else {
      await apiFetch('/coupons', { method: 'POST', body: JSON.stringify(cp) });
    }
    showToast('Coupon saved!');
    state.editingCoupon = null;
    await loadAllData();
  };

  window.deleteCouponConfirm = async function (id) {
    if (!confirm('Delete this coupon code?')) return;
    await apiFetch(`/coupons/${id}`, { method: 'DELETE' });
    showToast('Coupon removed');
    await loadAllData();
  };

  // --- Freebie Modals ---
  window.openNewFreebieModal = function () {
    state.editingFreebie = {
      name: '',
      category: 'Editing Packs',
      image: '/product-images/80b160e7e1003e8bf5a13f8f1b2ab905.jpg',
      download_link: 'https://drive.google.com/',
      description: 'High-quality creator pack with instant drive access.'
    };
    render();
  };

  window.editFreebieModal = function (id) {
    const fb = state.freebies.find(f => f.id === id);
    if (!fb) return;
    state.editingFreebie = JSON.parse(JSON.stringify(fb));
    render();
  };

  window.closeFreebieModal = function () {
    state.editingFreebie = null;
    render();
  };

  window.saveFreebieModal = async function () {
    const fb = state.editingFreebie;
    if (!fb.name) {
      showToast('Pack name is required', 'error');
      return;
    }
    if (fb.id) {
      await apiFetch(`/freebies/${fb.id}`, { method: 'PUT', body: JSON.stringify(fb) });
    } else {
      await apiFetch('/freebies', { method: 'POST', body: JSON.stringify(fb) });
    }
    showToast('Pack saved!');
    state.editingFreebie = null;
    await loadAllData();
  };

  window.deleteFreebieConfirm = async function (id) {
    if (!confirm('Delete this pack?')) return;
    await apiFetch(`/freebies/${id}`, { method: 'DELETE' });
    showToast('Pack deleted');
    await loadAllData();
  };

  // --- Review Modals ---
  window.openNewReviewModal = function () {
    state.editingReview = {
      name: '',
      role: 'Content Creator',
      rating: 5,
      content: '',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    };
    render();
  };

  window.editReviewModal = function (id) {
    const rv = state.reviews.find(r => r.id === id);
    if (!rv) return;
    state.editingReview = JSON.parse(JSON.stringify(rv));
    render();
  };

  window.closeReviewModal = function () {
    state.editingReview = null;
    render();
  };

  window.saveReviewModal = async function () {
    const rv = state.editingReview;
    if (!rv.name || !rv.content) {
      showToast('Name and review content are required', 'error');
      return;
    }
    if (rv.id) {
      await apiFetch(`/reviews/${rv.id}`, { method: 'PUT', body: JSON.stringify(rv) });
    } else {
      await apiFetch('/reviews', { method: 'POST', body: JSON.stringify(rv) });
    }
    showToast('Testimonial saved & updated on homepage!');
    state.editingReview = null;
    await loadAllData();
  };

  window.deleteReviewConfirm = async function (id) {
    if (!confirm('Delete this review?')) return;
    await apiFetch(`/reviews/${id}`, { method: 'DELETE' });
    showToast('Review removed');
    await loadAllData();
  };

  // --- Event Binding ---
  function bindLoginEvents() {
    const form = document.getElementById('loginForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        login(email, password);
      });
    }
  }

  function bindAppEvents() {
    // any DOM specific listener if needed
  }

  // --- Init ---
  if (state.token) {
    loadAllData();
  }
  render();
})();
