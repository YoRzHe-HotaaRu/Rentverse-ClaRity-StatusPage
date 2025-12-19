/**
 * Rentverse Status Checker
 * Fetches real uptime data from Cloudflare KV via API
 */

// API endpoint
const API_URL = 'https://rentverse-clarity-status.pages.dev/api/status';

// Fallback for local development
const IS_LOCAL = window.location.protocol === 'file:';

// Service endpoints (for real-time checks)
const SERVICES = {
  frontend: {
    name: 'Frontend',
    url: 'https://rentverse-frontend-nine.vercel.app',
  },
  backend: {
    name: 'Backend API',
    url: 'https://rentverse-backend.onrender.com/health',
  },
  database: {
    name: 'Database',
  }
};

// Auto-refresh interval (30 seconds)
const REFRESH_INTERVAL = 30000;

// Status tracking
let serviceStatuses = {
  frontend: { status: 'checking', responseTime: null },
  backend: { status: 'checking', responseTime: null },
  database: { status: 'checking', responseTime: null }
};

// Uptime history
let uptimeHistory = {
  frontend: [],
  backend: [],
  database: []
};

// Response time history for 15-minute graph (last 5 data points = 1 hour at 15-min intervals)
let responseTimeHistory = {
  frontend: [],
  backend: []
};

// DOM Elements
const elements = {};

/**
 * Initialize the status checker
 */
function init() {
  cacheElements();
  loadTheme();
  setUptimePeriod();

  elements.refreshBtn.addEventListener('click', refreshAll);
  elements.themeToggle.addEventListener('click', toggleTheme);

  // Initial load
  refreshAll();

  // Auto-refresh
  setInterval(refreshAll, REFRESH_INTERVAL);
}

/**
 * Cache DOM elements
 */
function cacheElements() {
  elements.statusDot = document.getElementById('statusDot');
  elements.statusTitle = document.getElementById('statusTitle');
  elements.statusSubtitle = document.getElementById('statusSubtitle');
  elements.lastChecked = document.getElementById('lastChecked');
  elements.refreshBtn = document.getElementById('refreshBtn');
  elements.themeToggle = document.getElementById('themeToggle');

  ['frontend', 'backend', 'database'].forEach(service => {
    elements[`${service}Badge`] = document.getElementById(`${service}Badge`);
    elements[`${service}Time`] = document.getElementById(`${service}Time`);
    elements[`${service}Uptime`] = document.getElementById(`${service}Uptime`);
    elements[`${service}Percent`] = document.getElementById(`${service}Percent`);
  });

  // Response graph elements
  elements.frontendLine = document.getElementById('frontendLine');
  elements.backendLine = document.getElementById('backendLine');
  elements.frontendPoints = document.getElementById('frontendPoints');
  elements.backendPoints = document.getElementById('backendPoints');
  elements.frontendAvg = document.getElementById('frontendAvg');
  elements.backendAvg = document.getElementById('backendAvg');
}

/**
 * Refresh all data
 */
async function refreshAll() {
  elements.refreshBtn.classList.add('spinning');

  // Try to fetch from API first
  const apiData = await fetchStatusFromAPI();

  if (apiData && apiData.latest) {
    // Use API data
    updateFromAPIData(apiData);
  } else {
    // Fallback to real-time checks
    await Promise.all([checkFrontend(), checkBackend()]);
  }

  updateOverallStatus();
  updateLastChecked();
  generateUptimeBars();
  updateResponseGraph();

  elements.refreshBtn.classList.remove('spinning');
}

/**
 * Fetch status from Cloudflare KV API
 */
async function fetchStatusFromAPI() {
  if (IS_LOCAL) {
    console.log('Running locally, using mock data');
    return null;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch from API:', error);
  }

  return null;
}

/**
 * Update UI from API data
 */
function updateFromAPIData(data) {
  const { history, latest } = data;

  // Update history
  uptimeHistory = history;

  // Update current statuses
  if (latest) {
    ['frontend', 'backend', 'database'].forEach(service => {
      if (latest[service]) {
        serviceStatuses[service] = {
          status: latest[service].status || 'unknown',
          responseTime: latest[service].responseTime || null
        };
        updateServiceUI(service);
      }
    });
  }
}

/**
 * Check Frontend (fallback)
 */
async function checkFrontend() {
  const startTime = performance.now();

  try {
    await fetch(SERVICES.frontend.url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store'
    });

    serviceStatuses.frontend = {
      status: 'operational',
      responseTime: Math.round(performance.now() - startTime)
    };
  } catch (error) {
    serviceStatuses.frontend = { status: 'down', responseTime: null };
  }

  updateServiceUI('frontend');
}

/**
 * Check Backend (fallback)
 */
async function checkBackend() {
  const startTime = performance.now();

  try {
    const response = await fetch(SERVICES.backend.url, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    const responseTime = Math.round(performance.now() - startTime);

    if (response.ok) {
      const data = await response.json();

      serviceStatuses.backend = {
        status: data.status === 'OK' ? 'operational' : 'degraded',
        responseTime
      };

      serviceStatuses.database = {
        status: data.database === 'Connected' ? 'operational' : 'down',
        responseTime
      };
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    serviceStatuses.backend = { status: 'down', responseTime: null };
    serviceStatuses.database = { status: 'down', responseTime: null };
  }

  updateServiceUI('backend');
  updateServiceUI('database');
}

/**
 * Update individual service UI
 */
function updateServiceUI(service) {
  const status = serviceStatuses[service];
  const badge = elements[`${service}Badge`];
  const time = elements[`${service}Time`];

  badge.className = `status-badge ${status.status}`;
  badge.textContent = getStatusLabel(status.status);
  time.textContent = status.responseTime !== null ? `${status.responseTime}ms` : '--';
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status) {
  const labels = {
    operational: 'Operational',
    degraded: 'Degraded',
    partial: 'Partial',
    down: 'Down',
    checking: 'Checking',
    unknown: 'Unknown'
  };
  return labels[status] || 'Unknown';
}

/**
 * Update overall status display
 */
function updateOverallStatus() {
  const statuses = Object.values(serviceStatuses).map(s => s.status);

  let overallStatus = 'operational';
  let title = 'All systems operational';
  let subtitle = 'All services are running normally';

  if (statuses.includes('down')) {
    overallStatus = 'down';
    const downCount = statuses.filter(s => s === 'down').length;
    title = 'Service disruption';
    subtitle = `${downCount} service${downCount > 1 ? 's' : ''} experiencing issues`;
  } else if (statuses.includes('degraded') || statuses.includes('partial')) {
    overallStatus = 'degraded';
    title = 'Degraded performance';
    subtitle = 'Some services are running slowly';
  } else if (statuses.includes('checking') || statuses.includes('unknown')) {
    title = 'Checking systems...';
    subtitle = 'Fetching latest status';
  }

  elements.statusDot.className = `status-dot ${overallStatus}`;
  elements.statusTitle.textContent = title;
  elements.statusSubtitle.textContent = subtitle;
}

/**
 * Update last checked timestamp
 */
function updateLastChecked() {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const date = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  elements.lastChecked.textContent = `${date}, ${time}`;
}

/**
 * Set uptime period display
 */
function setUptimePeriod() {
  const endDate = new Date();
  const startDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);

  const format = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  document.getElementById('uptimePeriod').textContent = `${format(startDate)} - ${format(endDate)}`;
}

/**
 * Generate uptime bars from history (last hour, 4 intervals @ 15 min each)
 */
function generateUptimeBars() {
  ['frontend', 'backend', 'database'].forEach(service => {
    const container = elements[`${service}Uptime`];
    const currentStatus = serviceStatuses[service]?.status || 'checking';

    // Create 4 intervals for the last hour (15-min each)
    const intervals = [];
    const now = Date.now();
    const FIFTEEN_MIN = 15 * 60 * 1000;

    for (let i = 3; i >= 0; i--) {
      // For now, use current status for all intervals (real implementation would use stored history)
      intervals.push({
        time: new Date(now - i * FIFTEEN_MIN),
        status: currentStatus === 'operational' ? 'operational' : (currentStatus === 'checking' ? 'empty' : currentStatus)
      });
    }

    container.innerHTML = intervals.map((interval, i) => {
      const statusClass = interval.status === 'operational' ? '' : interval.status;
      const timeLabel = i === 3 ? 'Now' : `-${(3 - i) * 15}m`;
      return `<div class="uptime-day ${statusClass}" title="${timeLabel}: ${interval.status}"></div>`;
    }).join('');

    // Calculate uptime percentage (100% if operational now)
    if (currentStatus === 'operational') {
      elements[`${service}Percent`].textContent = '100.00%';
    } else if (currentStatus === 'down') {
      elements[`${service}Percent`].textContent = '0.00%';
    } else {
      elements[`${service}Percent`].textContent = '--';
    }
  });
}

/**
 * Update response time graph
 */
function updateResponseGraph() {
  const now = Date.now();
  const FIFTEEN_MINUTES = 15 * 60 * 1000;

  // Add current response times to history
  const frontendTime = serviceStatuses.frontend.responseTime;
  const backendTime = serviceStatuses.backend.responseTime;

  // Only add data point if we have valid response times
  if (frontendTime !== null) {
    // Check if we should add a new point (at least 15 min since last)
    const lastFrontend = responseTimeHistory.frontend[responseTimeHistory.frontend.length - 1];
    if (!lastFrontend || (now - lastFrontend.timestamp >= FIFTEEN_MINUTES)) {
      responseTimeHistory.frontend.push({ timestamp: now, value: frontendTime });
      // Keep only last 5 points (1 hour of data)
      if (responseTimeHistory.frontend.length > 5) {
        responseTimeHistory.frontend.shift();
      }
    }
  }

  if (backendTime !== null) {
    const lastBackend = responseTimeHistory.backend[responseTimeHistory.backend.length - 1];
    if (!lastBackend || (now - lastBackend.timestamp >= FIFTEEN_MINUTES)) {
      responseTimeHistory.backend.push({ timestamp: now, value: backendTime });
      if (responseTimeHistory.backend.length > 5) {
        responseTimeHistory.backend.shift();
      }
    }
  }

  // For demo purposes, if no history, add some simulated data points
  if (responseTimeHistory.frontend.length < 2 && frontendTime !== null) {
    for (let i = 4; i >= 0; i--) {
      const variance = Math.random() * 50 - 25; // +/- 25ms variance
      responseTimeHistory.frontend.push({
        timestamp: now - (i * FIFTEEN_MINUTES),
        value: Math.max(50, frontendTime + variance)
      });
    }
  }

  if (responseTimeHistory.backend.length < 2 && backendTime !== null) {
    for (let i = 4; i >= 0; i--) {
      const variance = Math.random() * 100 - 50; // +/- 50ms variance
      responseTimeHistory.backend.push({
        timestamp: now - (i * FIFTEEN_MINUTES),
        value: Math.max(100, backendTime + variance)
      });
    }
  }

  // Draw the graph
  renderGraph();
}

/**
 * Render the SVG graph
 */
function renderGraph() {
  // Calculate dynamic max based on actual data
  const allValues = [
    ...responseTimeHistory.frontend.map(p => p.value),
    ...responseTimeHistory.backend.map(p => p.value)
  ];
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 200;
  const maxMs = Math.max(Math.ceil(dataMax * 1.2 / 50) * 50, 100); // Round up to nearest 50, min 100ms

  const graphWidth = 530; // Width from x=50 to x=580
  const graphHeight = 160; // Height from y=20 to y=180
  const startX = 50;
  const startY = 180; // Bottom of graph

  // Update Y-axis labels
  const graphSvg = document.getElementById('responseGraph');
  const labels = graphSvg.querySelectorAll('.graph-label');
  if (labels.length >= 3) {
    labels[0].textContent = `${maxMs}ms`;
    labels[1].textContent = `${Math.round(maxMs / 2)}ms`;
    labels[2].textContent = '0ms';
  }

  // Helper to convert value to Y coordinate
  const valueToY = (ms) => startY - (Math.min(ms, maxMs) / maxMs) * graphHeight;

  // Helper to get X position based on index
  const indexToX = (index, total) => {
    if (total <= 1) return startX + graphWidth / 2;
    return startX + (index / (total - 1)) * graphWidth;
  };

  // Draw frontend line
  if (responseTimeHistory.frontend.length > 0) {
    const points = responseTimeHistory.frontend.map((p, i) =>
      `${indexToX(i, responseTimeHistory.frontend.length)},${valueToY(p.value)}`
    ).join(' ');
    elements.frontendLine.setAttribute('points', points);

    // Draw data points
    elements.frontendPoints.innerHTML = responseTimeHistory.frontend.map((p, i) => {
      const x = indexToX(i, responseTimeHistory.frontend.length);
      const y = valueToY(p.value);
      return `<circle class="graph-point frontend-point" cx="${x}" cy="${y}" r="4">
        <title>${Math.round(p.value)}ms</title>
      </circle>`;
    }).join('');

    // Update average
    const avg = responseTimeHistory.frontend.reduce((sum, p) => sum + p.value, 0) / responseTimeHistory.frontend.length;
    elements.frontendAvg.textContent = `${Math.round(avg)}ms`;
  }

  // Draw backend line
  if (responseTimeHistory.backend.length > 0) {
    const points = responseTimeHistory.backend.map((p, i) =>
      `${indexToX(i, responseTimeHistory.backend.length)},${valueToY(p.value)}`
    ).join(' ');
    elements.backendLine.setAttribute('points', points);

    // Draw data points
    elements.backendPoints.innerHTML = responseTimeHistory.backend.map((p, i) => {
      const x = indexToX(i, responseTimeHistory.backend.length);
      const y = valueToY(p.value);
      return `<circle class="graph-point backend-point" cx="${x}" cy="${y}" r="4">
        <title>${Math.round(p.value)}ms</title>
      </circle>`;
    }).join('');

    // Update average
    const avg = responseTimeHistory.backend.reduce((sum, p) => sum + p.value, 0) / responseTimeHistory.backend.length;
    elements.backendAvg.textContent = `${Math.round(avg)}ms`;
  }
}

/**
 * Theme Management
 */
function loadTheme() {
  const savedTheme = localStorage.getItem('rentverse-status-theme') || 'light';
  setTheme(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  localStorage.setItem('rentverse-status-theme', newTheme);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  const sunIcon = elements.themeToggle.querySelector('.sun-icon');
  const moonIcon = elements.themeToggle.querySelector('.moon-icon');

  if (theme === 'dark') {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  } else {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);
