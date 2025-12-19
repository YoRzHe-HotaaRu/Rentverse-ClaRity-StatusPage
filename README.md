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

## ⚙️ Setup Instructions

### 1. Create Cloudflare KV Namespace

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages → KV**
3. Click **Create a namespace**
4. Name it: `STATUS_HISTORY`
5. Copy the **Namespace ID**

### 2. Bind KV to Pages Project

1. Go to **Workers & Pages → rentverse-clarity-status**
2. Click **Settings → Functions**
3. Scroll to **KV namespace bindings**
4. Click **Add binding**:
   - Variable name: `STATUS_HISTORY`
   - KV namespace: Select `STATUS_HISTORY`
5. Click **Save**

### 3. Add GitHub Secret

1. Go to your GitHub repo **Settings → Secrets → Actions**
2. Click **New repository secret**
3. Name: `CRON_SECRET`
4. Value: Generate a random string (e.g., `openssl rand -hex 32`)

### 4. Add Environment Variable to Cloudflare

1. Go to **Workers & Pages → rentverse-clarity-status**
2. Click **Settings → Environment variables**
3. Add variable:
   - Name: `CRON_SECRET`
   - Value: Same value as GitHub secret
4. Click **Save**

### 5. Deploy & Test

1. Commit and push changes
2. Wait for Cloudflare Pages to deploy
3. Manually trigger the GitHub Action to test:
   - Go to **Actions → Status Check Cron → Run workflow**

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

## 📊 Services Monitored

| Service | Endpoint |
|---------|----------|
| Frontend | https://rentverse-frontend-nine.vercel.app |
| Backend | https://rentverse-backend.onrender.com/health |
| Database | Via backend `/health` response |

## 🎨 Features

- ✅ Real-time status checks
- ✅ 30-day uptime history
- ✅ Light/Dark theme
- ✅ Auto-refresh (30s)
- ✅ Response time tracking
- ✅ Cloudflare KV storage

---

Powered by **ClaRity**
