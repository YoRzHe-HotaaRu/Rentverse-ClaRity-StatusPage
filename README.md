# Rentverse Status Page

Real-time status monitoring for Rentverse services with Cloudflare KV storage.

## 🚀 Live Status

[https://rentverse-clarity-status.pages.dev](https://rentverse-clarity-status.pages.dev)

## 📁 Project Structure

```
├── index.html              # Status page UI
├── styles.css              # Light/dark theme styling
├── checker.js              # Client-side status checker
├── functions/
│   └── api/
│       └── status.js       # Cloudflare Pages Function (KV API)
└── .github/
    └── workflows/
        └── status-check.yml # Cron job (every 5 min)
```

## 🔧 How It Works

```
┌─────────────────┐     Every 5 min     ┌─────────────────┐
│  GitHub Actions │ ──────────────────▶ │ Check Services  │
└─────────────────┘                     └────────┬────────┘
                                                 │
                                                 ▼
┌─────────────────┐     POST /api/status ┌─────────────────┐
│  Cloudflare KV  │ ◀─────────────────── │ Record Result   │
└────────┬────────┘                      └─────────────────┘
         │
         │ GET /api/status
         ▼
┌─────────────────┐
│   Status Page   │
└─────────────────┘
```

## 🎨 Features

- ✅ Real-time status checks
- ✅ 30-day uptime history
- ✅ Light/Dark theme
- ✅ Auto-refresh (30s)
- ✅ Response time tracking
- ✅ Cloudflare KV storage

---

Powered by **ClaRity**
