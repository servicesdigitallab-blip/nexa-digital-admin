const fs = require('fs');
const path = require('path');

const ADMIN_EMAIL = 'nexadigitaltoools@gmail.com';
const ADMIN_PASS = 'fahad3344';
const JWT_TOKEN = 'nexa_jwt_token_fahad_3344_secure';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ydbkvjgotjsjjfvruoei.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_5jsN-ZSP1YLw4Tu_mBg2Jw_5hv0HgOv';
const sbHeaders = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

function getLocalStore() {
  try {
    const p = path.join(__dirname, '..', 'data', 'store.json');
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

  // 1. Login Endpoint
  if (urlPath === '/login' && method === 'POST') {
    const { email, password } = req.body || {};
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

  // 2. Tools List
  if (urlPath === '/tools' && method === 'GET') {
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/products?select=*&order=sort_order.asc,created_at.desc`, { headers: sbHeaders }).catch(() => null),
        fetch(`${supabaseUrl}/rest/v1/categories?select=*`, { headers: sbHeaders }).catch(() => null)
      ]);

      let tools = store.products || [];
      let categories = store.categories || [];

      if (prodRes && prodRes.ok) {
        const sbProds = await prodRes.json();
        if (sbProds.length > 0) tools = sbProds;
      }
      if (catRes && catRes.ok) {
        const sbCats = await catRes.json();
        if (sbCats.length > 0) categories = sbCats;
      }

      return res.status(200).json({ tools, categories });
    } catch (e) {
      return res.status(200).json({ tools: store.products || [], categories: store.categories || [] });
    }
  }

  // 3. Update Tool
  if (urlPath.startsWith('/tools/') && method === 'PUT') {
    const id = urlPath.replace('/tools/', '').split('/')[0];
    const update = req.body || {};

    try {
      // Sync to Supabase
      const payload = {
        name: update.name,
        description: update.description || '',
        price: Number(update.price || 0),
        image: update.image || '',
        status: update.status || 'in_stock',
        delivery_time: update.delivery_time || '30-90 minutes delivery',
        warranty: update.warranty || 'Genuine license',
        refund_policy: update.refund_policy || 'Full refund guarantee',
        support_info: update.support_info || '24/7 WhatsApp support'
      };

      await fetch(`${supabaseUrl}/rest/v1/products?id=eq.${id}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify(payload)
      }).catch(() => {});

      // Plans
      if (update.plans && Array.isArray(update.plans)) {
        await fetch(`${supabaseUrl}/rest/v1/product_plans?product_id=eq.${id}`, { method: 'DELETE', headers: sbHeaders }).catch(() => {});
        if (update.plans.length > 0) {
          const pRows = update.plans.map(p => ({
            product_id: id,
            name: p.name || 'Standard',
            period: p.period || '1 Month',
            original_price: Number(p.original_price || p.discounted_price || update.price),
            discounted_price: Number(p.discounted_price || update.price),
            discount: p.discount || 0,
            popular: !!p.popular
          }));
          await fetch(`${supabaseUrl}/rest/v1/product_plans`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(pRows) }).catch(() => {});
        }
      }

      // Features
      if (update.features && Array.isArray(update.features)) {
        await fetch(`${supabaseUrl}/rest/v1/product_features?product_id=eq.${id}`, { method: 'DELETE', headers: sbHeaders }).catch(() => {});
        if (update.features.length > 0) {
          const fRows = update.features.map((f, idx) => ({
            product_id: id,
            feature: typeof f === 'string' ? f : (f.feature || ''),
            sort_order: idx
          }));
          await fetch(`${supabaseUrl}/rest/v1/product_features`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(fRows) }).catch(() => {});
        }
      }

      // FAQs
      if (update.faqs && Array.isArray(update.faqs)) {
        await fetch(`${supabaseUrl}/rest/v1/product_faqs?product_id=eq.${id}`, { method: 'DELETE', headers: sbHeaders }).catch(() => {});
        if (update.faqs.length > 0) {
          const qRows = update.faqs.map((fq, idx) => ({
            product_id: id,
            question: fq.question || '',
            answer: fq.answer || '',
            sort_order: idx
          }));
          await fetch(`${supabaseUrl}/rest/v1/product_faqs`, { method: 'POST', headers: sbHeaders, body: JSON.stringify(qRows) }).catch(() => {});
        }
      }
    } catch (e) {
      console.error('Supabase update error:', e);
    }

    return res.status(200).json({ success: true, tool: update });
  }

  // 4. Popular Picks
  if (urlPath === '/popular-picks' && method === 'GET') {
    return res.status(200).json({ picks: store.popular_picks || [], tools: store.products || [] });
  }

  if (urlPath === '/popular-picks' && method === 'POST') {
    const newPick = { id: 'pick_' + Date.now(), ...req.body };
    return res.status(200).json({ success: true, pick: newPick });
  }

  if (urlPath.startsWith('/popular-picks/') && method === 'PUT') {
    return res.status(200).json({ success: true });
  }

  if (urlPath.startsWith('/popular-picks/') && method === 'DELETE') {
    return res.status(200).json({ success: true });
  }

  if (urlPath === '/popular-picks-reorder' && method === 'PUT') {
    return res.status(200).json({ success: true });
  }

  // 5. Coupons, Freebies, Reviews, Analytics
  if (urlPath === '/coupons') return res.status(200).json({ coupons: store.coupons || [] });
  if (urlPath === '/freebies') return res.status(200).json({ freebies: store.freebies || [] });
  if (urlPath === '/reviews') return res.status(200).json({ reviews: store.reviews || [] });
  if (urlPath.startsWith('/analytics')) {
    return res.status(200).json({
      live_visitors: 1,
      total_visits: 12,
      mobile_visits: 8,
      desktop_visits: 4,
      total_clicks: 3,
      total_tool_views: 18,
      tool_clicks: []
    });
  }

  res.status(200).json({ success: true });
};