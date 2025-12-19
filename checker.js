/**
 * Rentverse Status Checker
 * Minimalistic Professional Design
 */

// Service endpoints
const SERVICES = {
  frontend: {
    name: 'Frontend',
    url: 'https://rentverse-frontend-nine.vercel.app',
    method: 'HEAD'
  },
  backend: {
    name: 'Backend API',
    url: 'https://rentverse-backend.onrender.com/health',
    method: 'GET'
  },
  database: {
    name: 'Database',
    url: null,
    method: null
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

// Uptime history (simulated for now - will be real with backend storage)
let uptimeHistory = {
  frontend: generateUptimeData(),
  backend: generateUptimeData(),
  database: generateUptimeData()
};

// DOM Elements
const elements = {};

/**
 * Initialize the status checker
 */
function init() {
  // Cache DOM elements
  cacheElements();

  // Load saved theme
  loadTheme();

  // Set up uptime period display
  setUptimePeriod();

  // Generate uptime bars
  generateUptimeBars();

  // Set up event listeners
  elements.refreshBtn.addEventListener('click', refreshAll);
  elements.themeToggle.addEventListener('click', toggleTheme);

  // Initial check
  refreshAll();

  // Set up auto-refresh
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

  // Service elements
  ['frontend', 'backend', 'database'].forEach(service => {
    elements[`${service}Badge`] = document.getElementById(`${service}Badge`);
    elements[`${service}Time`] = document.getElementById(`${service}Time`);
    elements[`${service}Uptime`] = document.getElementById(`${service}Uptime`);
    elements[`${service}Percent`] = document.getElementById(`${service}Percent`);
  });
}

/**
 * Generate mock uptime data for 30 days
 */
function generateUptimeData() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const random = Math.random();
    let status = 'operational';
    if (random < 0.02) status = 'down';
    else if (random < 0.05) status = 'partial';
    days.push({ status, date: new Date(Date.now() - i * 24 * 60 * 60 * 1000) });
  }
  return days;
}

/**
 * Generate uptime bars UI
 */
function generateUptimeBars() {
  ['frontend', 'backend', 'database'].forEach(service => {
    const container = elements[`${service}Uptime`];
    const data = uptimeHistory[service];

    container.innerHTML = data.map((day, index) => {
      const date = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const statusClass = day.status === 'operational' ? '' : day.status;
      return `<div class="uptime-day ${statusClass}" title="${date}: ${day.status}"></div>`;
    }).join('');

    // Calculate uptime percentage
    const operational = data.filter(d => d.status === 'operational').length;
    const percent = ((operational / data.length) * 100).toFixed(2);
    elements[`${service}Percent`].textContent = `${percent}%`;
  });
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
 * Check all services
 */
async function refreshAll() {
  elements.refreshBtn.classList.add('spinning');

  await Promise.all([
    checkFrontend(),
    checkBackend()
  ]);

  updateOverallStatus();
  updateLastChecked();

  elements.refreshBtn.classList.remove('spinning');
}

/**
 * Check Frontend (Vercel)
 */
async function checkFrontend() {
  const startTime = performance.now();

  try {
    await fetch(SERVICES.frontend.url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store'
    });

    const responseTime = Math.round(performance.now() - startTime);

    serviceStatuses.frontend = {
      status: 'operational',
      responseTime
    };
  } catch (error) {
    console.error('Frontend check failed:', error);
    serviceStatuses.frontend = {
      status: 'down',
      responseTime: null
    };
  }

  updateServiceUI('frontend');
}

/**
 * Check Backend (Render) - Also retrieves database status
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
        responseTime,
        uptime: data.uptime
      };

      serviceStatuses.database = {
        status: data.database === 'Connected' ? 'operational' : 'down',
        responseTime
      };
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('Backend check failed:', error);

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

  // Update badge
  badge.className = `status-badge ${status.status}`;
  badge.textContent = getStatusLabel(status.status);

  // Update response time
  time.textContent = status.responseTime !== null ? `${status.responseTime}ms` : '--';
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status) {
  const labels = {
    operational: 'Operational',
    degraded: 'Degraded',
    down: 'Down',
    checking: 'Checking'
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
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded';
    title = 'Degraded performance';
    subtitle = 'Some services are running slowly';
  } else if (statuses.includes('checking')) {
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
