const supabaseUrl = process.env.SUPABASE_URL || 'https://ydbkvjgotjsjjfvruoei.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_5jsN-ZSP1YLw4Tu_mBg2Jw_5hv0HgOv';
const sbHeaders = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const SETTINGS_ID = '066a4027-9df8-45ee-ac41-32f26f11a507';

// Ephemeral memory cache for 45-second heartbeat
let liveSessions = {}; // { sid: timestamp }

async function getCloudAnalytics() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}&select=about`, { headers: sbHeaders });
    if (res.ok) {
      const rows = await res.json();
      if (rows[0] && rows[0].about && rows[0].about.analytics) {
        return rows[0].about.analytics;
      }
    }
  } catch (e) {}
  return {
    total_visits: 1,
    mobile_visits: 0,
    desktop_visits: 1,
    total_clicks: 0,
    total_tool_views: 0,
    tool_clicks: []
  };
}

async function saveCloudAnalytics(stats) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.${SETTINGS_ID}`, {
      method: 'PATCH',
      headers: sbHeaders,
      body: JSON.stringify({ about: { analytics: stats } })
    });
  } catch (e) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlPath = (req.url || '').split('?')[0].replace('/api/track', '');
  const now = Date.now();

  // Clean stale live sessions older than 45 seconds
  for (const [sid, ts] of Object.entries(liveSessions)) {
    if (now - ts > 45000) delete liveSessions[sid];
  }

  if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }

    const sid = body.sessionId || req.headers['x-forwarded-for'] || 'sess_' + Math.random().toString(36).slice(2, 8);
    liveSessions[sid] = now;

    // 1. Visit
    if (urlPath === '/visit' || urlPath === '') {
      const stats = await getCloudAnalytics();
      stats.total_visits = (stats.total_visits || 0) + 1;
      if (body.device === 'mobile') {
        stats.mobile_visits = (stats.mobile_visits || 0) + 1;
      } else {
        stats.desktop_visits = (stats.desktop_visits || 0) + 1;
      }
      stats.last_updated = new Date().toISOString();
      await saveCloudAnalytics(stats);
      return res.status(200).json({ success: true });
    }

    // 2. Heartbeat
    if (urlPath === '/heartbeat') {
      return res.status(200).json({ success: true, live: Math.max(1, Object.keys(liveSessions).length) });
    }

    // 3. View Tool
    if (urlPath === '/view') {
      const stats = await getCloudAnalytics();
      stats.total_tool_views = (stats.total_tool_views || 0) + 1;
      stats.last_updated = new Date().toISOString();
      await saveCloudAnalytics(stats);
      return res.status(200).json({ success: true });
    }

    // 4. WhatsApp / Order Click
    if (urlPath === '/click') {
      const stats = await getCloudAnalytics();
      stats.total_clicks = (stats.total_clicks || 0) + 1;
      if (!Array.isArray(stats.tool_clicks)) stats.tool_clicks = [];
      stats.tool_clicks.push({
        id: 'c_' + now,
        toolId: body.toolId,
        toolName: body.toolName || 'Tool',
        planName: body.planName || 'Standard',
        device: body.device || 'desktop',
        timestamp: now
      });
      if (stats.tool_clicks.length > 500) stats.tool_clicks = stats.tool_clicks.slice(-500);
      stats.last_updated = new Date().toISOString();
      await saveCloudAnalytics(stats);
      return res.status(200).json({ success: true });
    }
  }

  // GET stats (for Admin Panel)
  const stats = await getCloudAnalytics();
  const liveCount = Math.max(1, Object.keys(liveSessions).length);

  res.status(200).json({
    live_visitors: liveCount,
    total_visits: stats.total_visits || 1,
    mobile_visits: stats.mobile_visits || 0,
    desktop_visits: stats.desktop_visits || 1,
    total_clicks: stats.total_clicks || 0,
    total_tool_views: stats.total_tool_views || 0,
    tool_clicks: stats.tool_clicks || []
  });
};