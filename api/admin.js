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

function getLocalStore() {
  try {
    const p1 = path.join(process.cwd(), 'data', 'store.json');
    const p2 = path.join(__dirname, '..', 'data', 'store.json');
    const p = fs.existsSync(p1) ? p1 : p2;
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
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

  // 6. Popular Picks
  if (urlPath === '/popular-picks' && method === 'GET') {
    let finalPicks = store.popular_picks || [];
    try {
      const setRes = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=hero`, { headers: sbHeaders });
      if (setRes.ok) {
        const rows = await setRes.json();
        if (rows[0] && rows[0].hero && rows[0].hero.popular_picks) {
          const pIds = rows[0].hero.popular_picks;
          // Map string IDs to full objects that the admin panel expects
          finalPicks = pIds.map((id, idx) => {
            const tool = (store.products || []).find(t => t.id === id || t.slug === id) || {};
            return {
              id: 'pick_' + idx,
              product_id: tool.id || id,
              name: tool.name || 'Unknown',
              category_name: tool.category_name || 'AI Tools',
              price: tool.price || 0,
              icon_url: tool.image || '',
              enabled: true
            };
          });
        }
      }
    } catch(e) {}
    return res.status(200).json({ picks: finalPicks, tools: store.products || [] });
  }

  
  // --- Popular Picks Management (Admin -> Storefront Sync) ---
  if (urlPath === '/popular-picks' && method === 'POST') {
    let picks = store.popular_picks || [];
    const newPick = { ...req.body, id: 'pick_' + Date.now() };
    picks.push(newPick);
    store.popular_picks = picks;
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
    
    // Sync to Supabase site_settings
    try {
      const pIds = picks.map(p => p.product_id).filter(Boolean);
      const setRes = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=hero`, { headers: sbHeaders });
      if (setRes.ok) {
        const rows = await setRes.json();
        const hero = (rows[0] && rows[0].hero) || {};
        hero.popular_picks = pIds;
        await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}`, {
          method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ hero })
        });
      }
    } catch(e) {}
    
    return res.status(200).json({ success: true, picks });
  }

  if (urlPath.startsWith('/popular-picks/') && (method === 'PUT' || method === 'DELETE')) {
    const pId = urlPath.split('/').pop();
    let picks = store.popular_picks || [];
    
    if (method === 'PUT') {
      const idx = picks.findIndex(p => p.id === pId);
      if (idx !== -1) {
        picks[idx] = { ...picks[idx], ...req.body, id: pId };
      }
    } else if (method === 'DELETE') {
      picks = picks.filter(p => p.id !== pId);
    }
    
    store.popular_picks = picks;
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
    
    try {
      const pIds = picks.map(p => p.product_id).filter(Boolean);
      const setRes = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=hero`, { headers: sbHeaders });
      if (setRes.ok) {
        const rows = await setRes.json();
        const hero = (rows[0] && rows[0].hero) || {};
        hero.popular_picks = pIds;
        await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}`, {
          method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ hero })
        });
      }
    } catch(e) {}
    
    return res.status(200).json({ success: true, picks });
  }

  if (urlPath === '/popular-picks-reorder' && method === 'PUT') {
    store.popular_picks = req.body;
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
    
    try {
      const pIds = req.body.map(p => p.product_id).filter(Boolean);
      const setRes = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=hero`, { headers: sbHeaders });
      if (setRes.ok) {
        const rows = await setRes.json();
        const hero = (rows[0] && rows[0].hero) || {};
        hero.popular_picks = pIds;
        await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}`, {
          method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ hero })
        });
      }
    } catch(e) {}
    
    return res.status(200).json({ success: true });
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

  // 8. Coupons, Freebies, Reviews
  if (urlPath === '/coupons') {
    try {
      const cpRes = await fetch(`${supabaseUrl}/rest/v1/coupons?select=*`, { headers: sbHeaders });
      if (cpRes.ok) {
        const data = await cpRes.json();
        if (data.length > 0) return res.status(200).json({ coupons: data });
      }
    } catch(e) {}
    return res.status(200).json({ coupons: store.coupons || [] });
  }

  if (urlPath === '/freebies') {
    try {
      const fbRes = await fetch(`${supabaseUrl}/rest/v1/freebies?select=*&order=sort_order.asc`, { headers: sbHeaders });
      if (fbRes.ok) {
        const data = await fbRes.json();
        if (data.length > 0) return res.status(200).json({ freebies: data });
      }
    } catch(e) {}
    return res.status(200).json({ freebies: store.freebies || [] });
  }

  if (urlPath === '/reviews') {
    try {
      const revRes = await fetch(`${supabaseUrl}/rest/v1/reviews?select=*&order=created_at.desc`, { headers: sbHeaders });
      if (revRes.ok) {
        const data = await revRes.json();
        if (data.length > 0) return res.status(200).json({ reviews: data });
      }
    } catch(e) {}
    return res.status(200).json({ reviews: store.reviews || [] });
  }

  res.status(200).json({ success: true });
};