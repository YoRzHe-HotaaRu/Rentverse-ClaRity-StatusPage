/**
 * GET /api/status - Returns uptime history from KV
 * POST /api/status - Records a new check result (called by GitHub Actions)
 */

export async function onRequest(context) {
    const { request, env } = context;

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        if (request.method === 'GET') {
            return await getStatus(env, corsHeaders);
        } else if (request.method === 'POST') {
            return await recordCheck(request, env, corsHeaders);
        }

        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Get uptime history for all services
 */
async function getStatus(env, corsHeaders) {
    const services = ['frontend', 'backend', 'database'];
    const history = {};

    for (const service of services) {
        const data = await env.STATUS_HISTORY.get(`uptime:${service}`, 'json');
        history[service] = data || [];
    }

    // Get latest check results
    const latest = await env.STATUS_HISTORY.get('latest', 'json') || {};

    return new Response(JSON.stringify({ history, latest }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

/**
 * Record a new check result (called by cron)
 */
async function recordCheck(request, env, corsHeaders) {
    // Verify auth token
    const authHeader = request.headers.get('Authorization');
    const expectedToken = env.CRON_SECRET;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { checks, timestamp } = body;

    // Store latest check
    await env.STATUS_HISTORY.put('latest', JSON.stringify({
        ...checks,
        timestamp
    }));

    // Update history for each service (keep last 30 days)
    const services = ['frontend', 'backend', 'database'];
    const today = new Date(timestamp).toISOString().split('T')[0];

    for (const service of services) {
        const historyKey = `uptime:${service}`;
        let history = await env.STATUS_HISTORY.get(historyKey, 'json') || [];

        // Check if we already have an entry for today
        const existingIndex = history.findIndex(h => h.date === today);

        const entry = {
            date: today,
            status: checks[service]?.status || 'unknown',
            responseTime: checks[service]?.responseTime || null,
            checks: 1
        };

        if (existingIndex >= 0) {
            // Update existing entry - aggregate status
            const existing = history[existingIndex];
            entry.checks = existing.checks + 1;

            // If any check today was down, mark as down; else if any degraded, mark as partial
            if (existing.status === 'down' || checks[service]?.status === 'down') {
                entry.status = 'down';
            } else if (existing.status === 'partial' || checks[service]?.status === 'degraded') {
                entry.status = 'partial';
            }

            // Average response time
            if (existing.responseTime && entry.responseTime) {
                entry.responseTime = Math.round((existing.responseTime + entry.responseTime) / 2);
            }

            history[existingIndex] = entry;
        } else {
            // Add new entry
            history.push(entry);
        }

        // Keep only last 30 days
        history = history.slice(-30);

        await env.STATUS_HISTORY.put(historyKey, JSON.stringify(history));
    }

    return new Response(JSON.stringify({ success: true, timestamp }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
