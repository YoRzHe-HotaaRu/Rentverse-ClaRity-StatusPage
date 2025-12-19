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
 * Generate uptime bars from history
 */
function generateUptimeBars() {
  ['frontend', 'backend', 'database'].forEach(service => {
    const container = elements[`${service}Uptime`];
    const history = uptimeHistory[service] || [];

    // Create 30-day array with defaults
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const historyItem = history.find(h => h.date === dateStr);

      days.push({
        date: dateStr,
        status: historyItem?.status || 'empty',
        displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }

    container.innerHTML = days.map(day => {
      const statusClass = day.status === 'operational' ? '' : day.status;
      return `<div class="uptime-day ${statusClass}" title="${day.displayDate}: ${day.status}"></div>`;
    }).join('');

    // Calculate uptime percentage
    const withData = days.filter(d => d.status !== 'empty');
    if (withData.length > 0) {
      const operational = withData.filter(d => d.status === 'operational').length;
      const percent = ((operational / withData.length) * 100).toFixed(2);
      elements[`${service}Percent`].textContent = `${percent}%`;
    } else {
      elements[`${service}Percent`].textContent = '--';
    }
  });
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
