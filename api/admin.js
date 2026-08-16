const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ADMIN_EMAIL = 'nexadigitaltoools@gmail.com';
const ADMIN_PASS = 'fahad3344';
const JWT_TOKEN = 'nexa_jwt_token_fahad_3344_secure';
const SETTINGS_ID = '066a4027-9df8-45ee-ac41-32f26f11a507';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ydbkvjgotjsjjfvruoei.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_5jsN-ZSP1YLw4Tu_mBg2Jw_5hv0HgOv';
const sbHeaders = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

const p1 = path.join(process.cwd(), 'data', 'store.json');
const p2 = path.join(__dirname, '..', 'data', 'store.json');
const storePath = fs.existsSync(p1) ? p1 : p2;

function getLocalStore() {
  try {
    if (fs.existsSync(storePath)) return JSON.parse(fs.readFileSync(storePath, 'utf8'));
  } catch (e) {}
  return { products: [], categories: [], popular_picks: [], coupons: [], freebies: [], reviews: [], analytics: {} };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlPath = (req.url || '').split('?')[0].replace('/api/admin', '');
  const method = req.method.toUpperCase();

  // 1. Admin Login
  if (urlPath === '/login' && method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }
    const { email, password } = body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      return res.status(200).json({
        success: true,
        token: JWT_TOKEN,
        user: { name: 'FAHAD', email: ADMIN_EMAIL, role: 'Super Admin' }
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }

  // Auth Guard
  const auth = req.headers['authorization'];
  if (!auth || !auth.includes(JWT_TOKEN)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const store = getLocalStore();

  // 2. Tools List (Deep Join from Supabase)
  if (urlPath === '/tools' && method === 'GET') {
    try {
      const [prodRes, plansRes, featsRes, faqsRes, catRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/products?select=*&order=sort_order.asc,created_at.desc`, { headers: sbHeaders }).catch(() => null),
        fetch(`${supabaseUrl}/rest/v1/product_plans?select=*`, { headers: sbHeaders }).catch(() => null),
        fetch(`${supabaseUrl}/rest/v1/product_features?select=*&order=sort_order.asc`, { headers: sbHeaders }).catch(() => null),
        fetch(`${supabaseUrl}/rest/v1/product_faqs?select=*&order=sort_order.asc`, { headers: sbHeaders }).catch(() => null),
        fetch(`${supabaseUrl}/rest/v1/categories?select=*`, { headers: sbHeaders }).catch(() => null)
      ]);

      let products = [];
      let categories = store.categories || [];

      if (prodRes && prodRes.ok) {
        products = await prodRes.json();
      } else {
        products = store.products || [];
      }

      if (catRes && catRes.ok) {
        categories = await catRes.json();
      }

      const plans = (plansRes && plansRes.ok) ? await plansRes.json() : [];
      const feats = (featsRes && featsRes.ok) ? await featsRes.json() : [];
      const faqs = (faqsRes && faqsRes.ok) ? await faqsRes.json() : [];

      const catMap = {};
      categories.forEach(c => { catMap[c.id] = c.name; });

      const fullTools = products.map(p => {
        const pPlans = plans.filter(pl => pl.product_id === p.id).sort((a, b) => (a.discounted_price || 0) - (b.discounted_price || 0));
        const pFeats = feats.filter(f => f.product_id === p.id).sort((a, b) => a.sort_order - b.sort_order).map(f => f.feature);
        const pFaqs = faqs.filter(fq => fq.product_id === p.id).sort((a, b) => a.sort_order - b.sort_order);
        const slug = p.slug || (p.name ? p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : p.id);

        return {
          ...p,
          slug,
          category_name: catMap[p.category_id] || p.category_name || "AI Tools",
          plans: pPlans.length ? pPlans : [{ name: 'Standard', period: '1 Month', original_price: p.price, discounted_price: p.price, popular: true }],
          features: pFeats,
          faqs: pFaqs
        };
      });

      return res.status(200).json({ tools: fullTools, categories });
    } catch (e) {
      return res.status(200).json({ tools: store.products || [], categories: store.categories || [] });
    }
  }

  // 3. Create Tool (POST /tools)
  if (urlPath === '/tools' && method === 'POST') {
    let update = req.body || {};
    if (typeof update === 'string') {
      try { update = JSON.parse(update); } catch(e) {}
    }
    const newId = isUUID(update.id) ? update.id : crypto.randomUUID();

    try {
      const prodPayload = {
        id: newId,
        name: update.name,
        description: update.description || '',
        price: Number(update.price || 0),
        image: update.image || '',
        category_id: isUUID(update.category_id) ? update.category_id : '6230af5a-3103-4a36-bc56-edb18842798a',
        status: update.status || 'in_stock',
        delivery_time: update.delivery_time || '30-90 minutes delivery',
        warranty: update.warranty || 'Genuine license',
        refund_policy: update.refund_policy || 'Full refund guarantee',
        support_info: update.support_info || '24/7 WhatsApp support',
        whatsapp_message: update.whatsapp_message || ''
      };

      await fetch(`${supabaseUrl}/rest/v1/products`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify(prodPayload)
      });

      // Plans
      if (update.plans && Array.isArray(update.plans) && update.plans.length > 0) {
        const pRows = update.plans.map(p => ({
          product_id: newId,
          name: p.name || 'Standard',
          period: p.period || '1 Month',
          original_price: Number(p.original_price || p.discounted_price || update.price),
          discounted_price: Number(p.discounted_price || update.price),
          discount: p.discount || 0,
          popular: !!p.popular
        }));
        await fetch(`${supabaseUrl}/rest/v1/product_plans`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(pRows) });
      }

      // Features
      if (update.features && Array.isArray(update.features) && update.features.length > 0) {
        const fRows = update.features.map((f, idx) => ({
          product_id: newId,
          feature: typeof f === 'string' ? f : (f.feature || ''),
          sort_order: idx
        }));
        await fetch(`${supabaseUrl}/rest/v1/product_features`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(fRows) });
      }

      // FAQs
      if (update.faqs && Array.isArray(update.faqs) && update.faqs.length > 0) {
        const qRows = update.faqs.map((fq, idx) => ({
          product_id: newId,
          question: fq.question || '',
          answer: fq.answer || '',
          sort_order: idx
        }));
        await fetch(`${supabaseUrl}/rest/v1/product_faqs`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(qRows) });
      }
    } catch (e) {
      console.error('Supabase create error:', e);
    }

    return res.status(200).json({ success: true, tool: { ...update, id: newId } });
  }

  // 4. Update Tool (PUT /tools/:id with UUID Resolver)
  if (urlPath.startsWith('/tools/') && method === 'PUT') {
    try {
    const rawId = urlPath.replace('/tools/', '').split('/')[0];
    let update = req.body || {};
    if (typeof update === 'string') {
      try { update = JSON.parse(update); } catch(e) {}
    }

    let realId = rawId;

    // Resolve UUID if rawId is a name or slug
    if (!isUUID(rawId)) {
      try {
        const rawClean = rawId.replace(/[^a-zA-Z0-9]/g, '');
        const nameWord = (update.name || rawId).split(' ')[0].trim();
        const [bySlug, byName, byWord] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/products?slug=eq.${encodeURIComponent(rawId)}&select=id`, { headers: sbHeaders }).catch(() => null),
          fetch(`${supabaseUrl}/rest/v1/products?name=ilike.*${encodeURIComponent(nameWord)}*&select=id`, { headers: sbHeaders }).catch(() => null),
          fetch(`${supabaseUrl}/rest/v1/products?name=ilike.*${encodeURIComponent(rawClean)}*&select=id`, { headers: sbHeaders }).catch(() => null)
        ]);

        const r1 = bySlug && bySlug.ok ? await bySlug.json() : [];
        const r2 = byName && byName.ok ? await byName.json() : [];
        const r3 = byWord && byWord.ok ? await byWord.json() : [];

        const match = (r1 && r1[0]) || (r2 && r2[0]) || (r3 && r3[0]);
        if (match && match.id) realId = match.id;
      } catch (e) {}
    }

    try {
      const prodPayload = {
        name: update.name,
        description: update.description || '',
        price: Number(update.price || 0),
        image: update.image || '',
        status: update.status || 'in_stock',
        delivery_time: update.delivery_time || '30-90 minutes delivery',
        warranty: update.warranty || 'Genuine license',
        refund_policy: update.refund_policy || 'Full refund guarantee',
        support_info: update.support_info || '24/7 WhatsApp support',
        whatsapp_message: update.whatsapp_message || ''
      };

      if (isUUID(update.category_id)) {
        prodPayload.category_id = update.category_id;
      }

      if (isUUID(realId)) {
        // PATCH existing product in Supabase
        await fetch(`${supabaseUrl}/rest/v1/products?id=eq.${realId}`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify(prodPayload)
        });

        // Plans
        if (update.plans && Array.isArray(update.plans)) {
          await fetch(`${supabaseUrl}/rest/v1/product_plans?product_id=eq.${realId}`, { method: 'DELETE', headers: sbHeaders });
          if (update.plans.length > 0) {
            const pRows = update.plans.map(p => ({
              product_id: realId,
              name: p.name || 'Standard',
              period: p.period || '1 Month',
              original_price: Number(p.original_price || p.discounted_price || update.price),
              discounted_price: Number(p.discounted_price || update.price),
              discount: p.discount || 0,
              popular: !!p.popular
            }));
            await fetch(`${supabaseUrl}/rest/v1/product_plans`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(pRows) });
          }
        }

        // Features
        if (update.features && Array.isArray(update.features)) {
          await fetch(`${supabaseUrl}/rest/v1/product_features?product_id=eq.${realId}`, { method: 'DELETE', headers: sbHeaders });
          if (update.features.length > 0) {
            const fRows = update.features.map((f, idx) => ({
              product_id: realId,
              feature: typeof f === 'string' ? f : (f.feature || ''),
              sort_order: idx
            }));
            await fetch(`${supabaseUrl}/rest/v1/product_features`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(fRows) });
          }
        }

        // FAQs
        if (update.faqs && Array.isArray(update.faqs)) {
          await fetch(`${supabaseUrl}/rest/v1/product_faqs?product_id=eq.${realId}`, { method: 'DELETE', headers: sbHeaders });
          if (update.faqs.length > 0) {
            const qRows = update.faqs.map((fq, idx) => ({
              product_id: realId,
              question: fq.question || '',
              answer: fq.answer || '',
              sort_order: idx
            }));
            await fetch(`${supabaseUrl}/rest/v1/product_faqs`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(qRows) });
          }
        }
      }
    } catch (e) {
      console.error('Supabase update error:', e);
    }

    return res.status(200).json({ success: true, tool: { ...update, id: realId } });
    } catch (globalErr) {
      console.error('PUT /tools global error:', globalErr);
      return res.status(500).json({ success: false, message: globalErr.message });
    }
  }

  // 5. Delete Tool (DELETE /tools/:id)
  if (urlPath.startsWith('/tools/') && method === 'DELETE') {
    const id = urlPath.replace('/tools/', '').split('/')[0];
    if (isUUID(id)) {
      try {
        await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/product_plans?product_id=eq.${id}`, { method: 'DELETE', headers: sbHeaders }),
          fetch(`${supabaseUrl}/rest/v1/product_features?product_id=eq.${id}`, { method: 'DELETE', headers: sbHeaders }),
          fetch(`${supabaseUrl}/rest/v1/product_faqs?product_id=eq.${id}`, { method: 'DELETE', headers: sbHeaders }),
          fetch(`${supabaseUrl}/rest/v1/products?id=eq.${id}`, { method: 'DELETE', headers: sbHeaders })
        ]);
      } catch (e) {}
    }
    return res.status(200).json({ success: true });
  }

  // === HELPER: Read current picks array from Supabase ===
  async function getCloudPicks() {
    try {
      const [setRes, prodRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=hero`, { headers: sbHeaders }),
        fetch(`${supabaseUrl}/rest/v1/products?select=id,name,slug,price,image,category_id`, { headers: sbHeaders }).catch(() => null)
      ]);
      const allProducts = (prodRes && prodRes.ok) ? await prodRes.json() : (store.products || []);
      const catMap = {};
      (store.categories || []).forEach(c => { catMap[c.id] = c.name; });

      if (setRes.ok) {
        const rows = await setRes.json();
        if (rows[0] && rows[0].hero && Array.isArray(rows[0].hero.popular_picks)) {
          const raw = rows[0].hero.popular_picks;
          // Support both formats: array of strings (old) and array of objects (new)
          return raw.map((item, idx) => {
            if (typeof item === 'object' && item !== null) {
              // Already a full object — enrich with latest product data
              const tool = allProducts.find(t => t.id === item.product_id) || {};
              return {
                id: item.id || ('pick_' + idx),
                product_id: item.product_id || tool.id || '',
                name: item.name || tool.name || 'Unknown',
                category_name: item.category_name || catMap[tool.category_id] || 'AI Tools',
                price: item.price !== undefined ? item.price : (tool.price || 0),
                badge: item.badge || '',
                icon_url: item.icon_url || tool.image || '',
                enabled: item.enabled !== undefined ? item.enabled : true
              };
            }
            // Old format: plain string ID
            const tool = allProducts.find(t => t.id === item || t.slug === item) || {};
            return {
              id: 'pick_' + idx,
              product_id: tool.id || item,
              name: tool.name || 'Unknown',
              category_name: catMap[tool.category_id] || 'AI Tools',
              price: tool.price || 0,
              badge: '',
              icon_url: tool.image || '',
              enabled: true
            };
          });
        }
      }
    } catch (e) { console.error('getCloudPicks error:', e); }
    return [];
  }

  // === HELPER: Save picks array to Supabase as full objects ===
  async function saveCloudPicks(picks) {
    try {
      const setRes = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=hero`, { headers: sbHeaders });
      if (setRes.ok) {
        const rows = await setRes.json();
        const hero = (rows[0] && rows[0].hero) || {};
        hero.popular_picks = picks.map(p => ({
          id: p.id,
          product_id: p.product_id,
          name: p.name,
          category_name: p.category_name,
          price: p.price,
          badge: p.badge || '',
          icon_url: p.icon_url || '',
          enabled: p.enabled !== false
        }));
        await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}`, {
          method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ hero })
        });
      }
    } catch (e) { console.error('saveCloudPicks error:', e); }
  }

  // 6. Popular Picks — GET
  if (urlPath === '/popular-picks' && method === 'GET') {
    const picks = await getCloudPicks();
    // Also fetch tools list for the admin "Select Tool" dropdown
    let tools = store.products || [];
    try {
      const prodRes = await fetch(`${supabaseUrl}/rest/v1/products?select=*&order=sort_order.asc,created_at.desc`, { headers: sbHeaders });
      if (prodRes && prodRes.ok) tools = await prodRes.json();
    } catch(e) {}
    return res.status(200).json({ picks, tools });
  }

  // --- Popular Picks: POST (Add New) ---
  if (urlPath === '/popular-picks' && method === 'POST') {
    try {
      const picks = await getCloudPicks();
      const body = req.body || {};
      const newPick = {
        id: 'pick_' + Date.now(),
        product_id: body.product_id || '',
        name: body.name || 'New Tool',
        category_name: body.category_name || 'AI Tools',
        price: Number(body.price || 0),
        badge: body.badge || '',
        icon_url: body.icon_url || '',
        enabled: body.enabled !== false
      };
      picks.push(newPick);
      await saveCloudPicks(picks);
      return res.status(200).json({ success: true, picks });
    } catch (e) {
      console.error('POST /popular-picks error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // --- Popular Picks: PUT (Edit) / DELETE ---
  if (urlPath.startsWith('/popular-picks/') && (method === 'PUT' || method === 'DELETE')) {
    try {
      const pId = urlPath.split('/').pop();
      let picks = await getCloudPicks();

      if (method === 'PUT') {
        const body = req.body || {};
        const idx = picks.findIndex(p => p.id === pId);
        if (idx !== -1) {
          picks[idx] = { ...picks[idx], ...body, id: pId };
        } else {
          // Fallback: try to match by index from the pId (e.g. 'pick_0' → index 0)
          const numMatch = pId.match(/pick_(\d+)/);
          if (numMatch) {
            const fallbackIdx = parseInt(numMatch[1]);
            if (fallbackIdx < picks.length) {
              picks[fallbackIdx] = { ...picks[fallbackIdx], ...body, id: pId };
            }
          }
        }
      } else if (method === 'DELETE') {
        picks = picks.filter(p => p.id !== pId);
      }

      await saveCloudPicks(picks);
      return res.status(200).json({ success: true, picks });
    } catch (e) {
      console.error('PUT/DELETE /popular-picks error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // --- Popular Picks: Reorder ---
  if (urlPath === '/popular-picks-reorder' && method === 'PUT') {
    try {
      const picks = req.body || [];
      await saveCloudPicks(picks);
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('PUT /popular-picks-reorder error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // 7. Live Cloud-Persistent Analytics Dashboard
  if (urlPath.startsWith('/analytics')) {
    try {
      const setRes = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=about`, { headers: sbHeaders });
      if (setRes.ok) {
        const rows = await setRes.json();
        if (rows[0] && rows[0].about && rows[0].about.analytics) {
          const stats = rows[0].about.analytics;
          return res.status(200).json({
            live_visitors: 1,
            total_visits: stats.total_visits || 1,
            mobile_visits: stats.mobile_visits || 0,
            desktop_visits: stats.desktop_visits || 1,
            total_clicks: stats.total_clicks || 0,
            total_tool_views: stats.total_tool_views || 0,
            tool_clicks: stats.tool_clicks || []
          });
        }
      }
    } catch(e) {}

    return res.status(200).json({
      live_visitors: 1,
      total_visits: 1,
      mobile_visits: 0,
      desktop_visits: 1,
      total_clicks: 0,
      total_tool_views: 0,
      tool_clicks: []
    });
  }

  // 8. Coupons
  if (urlPath === '/coupons' && method === 'GET') {
    try {
      const cpRes = await fetch(`${supabaseUrl}/rest/v1/coupons?select=*`, { headers: sbHeaders });
      if (cpRes.ok) {
        const data = await cpRes.json();
        return res.status(200).json({ coupons: data });
      }
    } catch(e) {}
    return res.status(200).json({ coupons: store.coupons || [] });
  }

  if (urlPath === '/coupons' && method === 'POST') {
    try {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      const newId = isUUID(body.id) ? body.id : crypto.randomUUID();
      const payload = {
        id: newId,
        code: body.code,
        discount_type: body.discount_type || 'percentage',
        discount_value: Number(body.discount_value !== undefined ? body.discount_value : 20),
        scope: body.scope || 'all',
        applicable_tools: Array.isArray(body.applicable_tools) ? body.applicable_tools : [],
        is_active: body.is_active !== false
      };
      
      const sRes = await fetch(`${supabaseUrl}/rest/v1/coupons`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify(payload)
      });
      
      if (!sRes.ok) {
        const errText = await sRes.text();
        console.error('Supabase coupon create error:', errText);
        return res.status(500).json({ success: false, message: 'Database save failed: ' + errText });
      }
      
      // Update local store fallback (try-catch because Vercel is read-only)
      try {
        store.coupons = store.coupons || [];
        store.coupons.push(payload);
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch(e) {}
      
      return res.status(200).json({ success: true, coupon: payload });
    } catch(e) {
      console.error('POST /coupons error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  if (urlPath.startsWith('/coupons/') && method === 'PUT') {
    try {
      const id = urlPath.replace('/coupons/', '').split('/')[0];
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      
      const payload = {};
      if (body.code !== undefined) payload.code = body.code;
      if (body.discount_type !== undefined) payload.discount_type = body.discount_type;
      if (body.discount_value !== undefined) payload.discount_value = Number(body.discount_value);
      if (body.scope !== undefined) payload.scope = body.scope;
      if (body.applicable_tools !== undefined) payload.applicable_tools = Array.isArray(body.applicable_tools) ? body.applicable_tools : [];
      if (body.is_active !== undefined) payload.is_active = body.is_active !== false;
      
      const sRes = await fetch(`${supabaseUrl}/rest/v1/coupons?id=eq.${id}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify(payload)
      });
      
      if (!sRes.ok) {
        const errText = await sRes.text();
        console.error('Supabase coupon update error:', errText);
        return res.status(500).json({ success: false, message: 'Database update failed: ' + errText });
      }
      
      // Update local store fallback
      try {
        store.coupons = store.coupons || [];
        const idx = store.coupons.findIndex(c => c.id === id);
        if (idx !== -1) {
          store.coupons[idx] = { ...store.coupons[idx], ...payload };
        }
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch(e) {}
      
      return res.status(200).json({ success: true });
    } catch(e) {
      console.error('PUT /coupons error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  if (urlPath.startsWith('/coupons/') && method === 'DELETE') {
    try {
      const id = urlPath.replace('/coupons/', '').split('/')[0];
      const sRes = await fetch(`${supabaseUrl}/rest/v1/coupons?id=eq.${id}`, {
        method: 'DELETE',
        headers: sbHeaders
      });
      
      if (!sRes.ok) {
        const errText = await sRes.text();
        console.error('Supabase coupon delete error:', errText);
        return res.status(500).json({ success: false, message: 'Database delete failed: ' + errText });
      }
      
      // Update local store fallback
      try {
        store.coupons = (store.coupons || []).filter(c => c.id !== id);
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch(e) {}
      
      return res.status(200).json({ success: true });
    } catch(e) {
      console.error('DELETE /coupons error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // 9. Freebies
  if (urlPath === '/freebies' && method === 'GET') {
    try {
      const fbRes = await fetch(`${supabaseUrl}/rest/v1/freebies?select=*&order=sort_order.asc`, { headers: sbHeaders });
      if (fbRes.ok) {
        const data = await fbRes.json();
        return res.status(200).json({ freebies: data });
      }
    } catch(e) {}
    return res.status(200).json({ freebies: store.freebies || [] });
  }

  if (urlPath === '/freebies' && method === 'POST') {
    try {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      const newId = isUUID(body.id) ? body.id : crypto.randomUUID();
      const payload = {
        id: newId,
        name: body.name,
        category: body.category || 'Editing Packs',
        description: body.description || '',
        image: body.image || '',
        download_url: body.download_url || '',
        features: Array.isArray(body.features) ? body.features : null,
        sort_order: Number(body.sort_order || 0)
      };
      
      const sRes = await fetch(`${supabaseUrl}/rest/v1/freebies`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify(payload)
      });
      
      if (!sRes.ok) {
        const errText = await sRes.text();
        console.error('Supabase freebie create error:', errText);
        return res.status(500).json({ success: false, message: 'Database save failed: ' + errText });
      }
      
      try {
        store.freebies = store.freebies || [];
        store.freebies.push(payload);
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch(e) {}
      
      return res.status(200).json({ success: true, freebie: payload });
    } catch(e) {
      console.error('POST /freebies error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  if (urlPath.startsWith('/freebies/') && method === 'PUT') {
    try {
      const id = urlPath.replace('/freebies/', '').split('/')[0];
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      
      const payload = {};
      if (body.name !== undefined) payload.name = body.name;
      if (body.category !== undefined) payload.category = body.category;
      if (body.description !== undefined) payload.description = body.description;
      if (body.image !== undefined) payload.image = body.image;
      if (body.download_url !== undefined) payload.download_url = body.download_url;
      if (body.features !== undefined) payload.features = Array.isArray(body.features) ? body.features : null;
      if (body.sort_order !== undefined) payload.sort_order = Number(body.sort_order);
      
      const sRes = await fetch(`${supabaseUrl}/rest/v1/freebies?id=eq.${id}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify(payload)
      });
      
      if (!sRes.ok) {
        const errText = await sRes.text();
        console.error('Supabase freebie update error:', errText);
        return res.status(500).json({ success: false, message: 'Database update failed: ' + errText });
      }
      
      try {
        store.freebies = store.freebies || [];
        const idx = store.freebies.findIndex(f => f.id === id);
        if (idx !== -1) {
          store.freebies[idx] = { ...store.freebies[idx], ...payload };
        }
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch(e) {}
      
      return res.status(200).json({ success: true });
    } catch(e) {
      console.error('PUT /freebies error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  if (urlPath.startsWith('/freebies/') && method === 'DELETE') {
    try {
      const id = urlPath.replace('/freebies/', '').split('/')[0];
      const sRes = await fetch(`${supabaseUrl}/rest/v1/freebies?id=eq.${id}`, {
        method: 'DELETE',
        headers: sbHeaders
      });
      
      if (!sRes.ok) {
        const errText = await sRes.text();
        console.error('Supabase freebie delete error:', errText);
        return res.status(500).json({ success: false, message: 'Database delete failed: ' + errText });
      }
      
      try {
        store.freebies = (store.freebies || []).filter(f => f.id !== id);
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch(e) {}
      
      return res.status(200).json({ success: true });
    } catch(e) {
      console.error('DELETE /freebies error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // 10. Reviews
  if (urlPath === '/reviews' && method === 'GET') {
    try {
      const revRes = await fetch(`${supabaseUrl}/rest/v1/reviews?select=*&order=created_at.desc`, { headers: sbHeaders });
      if (revRes.ok) {
        const data = await revRes.json();
        return res.status(200).json({ reviews: data });
      }
    } catch(e) {}
    return res.status(200).json({ reviews: store.reviews || [] });
  }

  if (urlPath === '/reviews' && method === 'POST') {
    try {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      const newId = isUUID(body.id) ? body.id : crypto.randomUUID();
      const payload = {
        id: newId,
        name: body.name,
        role: body.role || 'Content Creator',
        rating: Number(body.rating || 5),
        content: body.content,
        avatar_url: body.avatar_url || ''
      };
      
      const sRes = await fetch(`${supabaseUrl}/rest/v1/reviews`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify(payload)
      });
      
      if (!sRes.ok) {
        const errText = await sRes.text();
        console.error('Supabase review create error:', errText);
        return res.status(500).json({ success: false, message: 'Database save failed: ' + errText });
      }
      
      try {
        store.reviews = store.reviews || [];
        store.reviews.push(payload);
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch(e) {}
      
      return res.status(200).json({ success: true, review: payload });
    } catch(e) {
      console.error('POST /reviews error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  if (urlPath.startsWith('/reviews/') && method === 'PUT') {
    try {
      const id = urlPath.replace('/reviews/', '').split('/')[0];
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      
      const payload = {};
      if (body.name !== undefined) payload.name = body.name;
      if (body.role !== undefined) payload.role = body.role;
      if (body.rating !== undefined) payload.rating = Number(body.rating);
      if (body.content !== undefined) payload.content = body.content;
      if (body.avatar_url !== undefined) payload.avatar_url = body.avatar_url;
      
      const sRes = await fetch(`${supabaseUrl}/rest/v1/reviews?id=eq.${id}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify(payload)
      });
      
      if (!sRes.ok) {
        const errText = await sRes.text();
        console.error('Supabase review update error:', errText);
        return res.status(500).json({ success: false, message: 'Database update failed: ' + errText });
      }
      
      try {
        store.reviews = store.reviews || [];
        const idx = store.reviews.findIndex(r => r.id === id);
        if (idx !== -1) {
          store.reviews[idx] = { ...store.reviews[idx], ...payload };
        }
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch(e) {}
      
      return res.status(200).json({ success: true });
    } catch(e) {
      console.error('PUT /reviews error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  if (urlPath.startsWith('/reviews/') && method === 'DELETE') {
    try {
      const id = urlPath.replace('/reviews/', '').split('/')[0];
      const sRes = await fetch(`${supabaseUrl}/rest/v1/reviews?id=eq.${id}`, {
        method: 'DELETE',
        headers: sbHeaders
      });
      
      if (!sRes.ok) {
        const errText = await sRes.text();
        console.error('Supabase review delete error:', errText);
        return res.status(500).json({ success: false, message: 'Database delete failed: ' + errText });
      }
      
      try {
        store.reviews = (store.reviews || []).filter(r => r.id !== id);
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch(e) {}
      
      return res.status(200).json({ success: true });
    } catch(e) {
      console.error('DELETE /reviews error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  res.status(200).json({ success: true });
};