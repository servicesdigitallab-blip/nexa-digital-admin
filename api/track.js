const fs = require('fs');
const path = require('path');

// In-memory telemetry cache for high-speed tracking
let liveSessions = {}; // { sessionId: timestamp }
let visits = [];
let toolViews = {}; // { toolId: count }
let clicks = []; // [ { toolId, toolName, planName, device, timestamp } ]

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlPath = (req.url || '').split('?')[0].replace('/api/track', '');
  const now = Date.now();

  // Cleanup sessions older than 60 seconds
  for (const [sid, ts] of Object.entries(liveSessions)) {
    if (now - ts > 60000) delete liveSessions[sid];
  }

  if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }

    // 1. Visit
    if (urlPath === '/visit' || urlPath === '') {
      const sid = body.sessionId || req.headers['x-forwarded-for'] || 'sess_' + Math.random().toString(36).slice(2, 8);
      liveSessions[sid] = now;
      visits.push({
        id: 'v_' + now + '_' + Math.random().toString(36).slice(2, 6),
        sessionId: sid,
        path: body.path || '/',
        device: body.device || 'desktop',
        timestamp: now
      });
      if (visits.length > 500) visits = visits.slice(-500);
      return res.status(200).json({ success: true });
    }

    // 2. Heartbeat
    if (urlPath === '/heartbeat') {
      const sid = body.sessionId || 'sess_' + Math.random().toString(36).slice(2, 8);
      liveSessions[sid] = now;
      return res.status(200).json({ success: true, live: Object.keys(liveSessions).length });
    }

    // 3. Tool View
    if (urlPath === '/view') {
      const tid = body.toolId || body.slug;
      if (tid) toolViews[tid] = (toolViews[tid] || 0) + 1;
      return res.status(200).json({ success: true });
    }

    // 4. WhatsApp / Order Click
    if (urlPath === '/click') {
      clicks.push({
        id: 'c_' + now,
        toolId: body.toolId,
        toolName: body.toolName || 'Tool',
        planName: body.planName || 'Standard',
        device: body.device || 'desktop',
        timestamp: now
      });
      if (clicks.length > 500) clicks = clicks.slice(-500);
      return res.status(200).json({ success: true });
    }
  }

  // GET stats (used internally)
  const activeCount = Math.max(1, Object.keys(liveSessions).length);
  const mobCount = visits.filter(v => v.device === 'mobile').length;
  const deskCount = visits.filter(v => v.device === 'desktop').length;

  res.status(200).json({
    live_visitors: activeCount,
    total_visits: Math.max(activeCount, visits.length),
    mobile_visits: mobCount,
    desktop_visits: deskCount,
    total_clicks: clicks.length,
    total_tool_views: Object.values(toolViews).reduce((a, b) => a + b, 0),
    tool_clicks: clicks
  });
};