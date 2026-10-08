# Student ScamGuard AI — Complete Deployment Guide (Render + Vercel)

This guide walks you through deploying:
1. **Backend (FastAPI + Trained Scikit-Learn Model)** on **Render** (free web service).
2. **Frontend (Responsive Tailwind + Vanilla JS Web App)** on **Vercel** (free global CDN).
3. **Connecting Frontend to Backend**.

---

## Architecture Overview

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     VERCEL (Frontend CDN)       │  REST API │      RENDER (Python Service)    │
│                                 │ ────────> │                                 │
│  • HTML, CSS, JavaScript        │  /api/v1  │  • FastAPI (Uvicorn)            │
│  • Instant Global Edge Delivery │           │  • LogisticRegression + TF-IDF  │
│  • Zero-Retention Client Logic  │           │  • Rule Engine + URL Intelligence│
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## PART 1: Deploy Backend to Render

### Option A: Using Render Blueprint (`render.yaml` - 1-Click)
1. Go to **[dashboard.render.com](https://dashboard.render.com/)** and sign in (with GitHub).
2. Click **New +** > **Blueprint**.
3. Connect your repository: `https://github.com/narasimhakosam/scamalert`.
4. Render will detect `render.yaml` automatically:
   - **Service Name:** `scamalert-backend`
   - **Runtime:** `Python 3.12`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Click **Apply**.
6. Once deployed, Render will provide your public backend URL, for example:
   ```
   https://scamalert-backend.onrender.com
   ```
7. Test the health endpoint in your browser:
   `https://scamalert-backend.onrender.com/api/v1/health`
   You should see:
   ```json
   {"status": "ok", "model_loaded": true, "model_version": "spamclf-v1"}
   ```

---

### Option B: Manual Web Service Setup on Render
1. Go to **[dashboard.render.com](https://dashboard.render.com/)**.
2. Click **New +** > **Web Service**.
3. Choose **Build and deploy from a Git repository** > select `scamalert`.
4. Configure the service settings:
   - **Name:** `scamalert-backend`
   - **Region:** Any (e.g., `Oregon (US West)` or `Singapore`)
   - **Branch:** `master`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free`
5. Under **Advanced** > **Environment Variables**, add:
   - `PYTHON_VERSION` = `3.12.7`
   - `ENVIRONMENT` = `production`
   - `CORS_ORIGINS` = `*`
6. Click **Create Web Service**.

> [!NOTE]
> **Render Free Tier Cold Starts:** Free Render services spin down after 15 minutes of inactivity. The first request after idle takes approximately 30–50 seconds while the container spins up and loads the scikit-learn model. Student ScamGuard AI frontend handles this gracefully with automatic retries and visual status banners.

---

## PART 2: Deploy Frontend to Vercel

1. Go to **[vercel.com](https://vercel.com/)** and sign in with GitHub.
2. Click **Add New...** > **Project**.
3. Import Git Repository: `scamalert`.
4. In the **Configure Project** screen:
   - **Project Name:** `student-scamguard-ai` (or your choice)
   - **Framework Preset:** `Other`
   - **Root Directory:** Click **Edit** and choose `frontend` (or keep `./` — our `vercel.json` supports both).
   - **Build and Output Settings:** Leave defaults (no build step needed for vanilla web apps).
5. Click **Deploy**.
6. Within 15 seconds, your application will be live at:
   ```
   https://student-scamguard-ai.vercel.app
   ```

---

## PART 3: Connect Frontend to Render Backend

You have two easy ways to link your Vercel frontend to your Render backend:

### Method 1: Using the Interactive UI Settings (No Code Changes Needed!)
1. Open your deployed Vercel site.
2. In the top hero section, click the **Backend Status Badge** (`Backend API Ready` / `Cloud Standby`).
3. In the **Backend API Connection** modal:
   - Paste your Render URL with `/api/v1`, e.g.:
     ```
     https://scamalert-backend.onrender.com/api/v1
     ```
   - Click **Save & Connect**.
4. The frontend will test the connection, verify the model is loaded, and store the preference in your browser's `localStorage`.

### Method 2: Setting the Default in Code
In [frontend/app.js](file:///c:/Projects/secure%202/student-scamguard-ai/frontend/app.js):
```javascript
// Change this line to your Render URL:
return window.RENDER_API_BASE || "https://scamalert-backend.onrender.com/api/v1";
```
Commit and push to `master`. Vercel will automatically redeploy within seconds.

---

## PART 4: Verification & Smoke Test Checklist

Once both services are deployed:
- [ ] Open `https://<your-render-app>.onrender.com/docs` to verify Swagger interactive API documentation.
- [ ] Open `https://<your-render-app>.onrender.com/api/v1/health` and verify `"model_loaded": true`.
- [ ] Open `https://<your-vercel-app>.vercel.app/`.
- [ ] Verify the header status badge turns green (`Cloud API Live (Model Ready)`).
- [ ] Click the quick sample: **"₹499 Internship Fee (High Risk)"** and click **Analyze Message**.
- [ ] Verify the Risk Score (91/100), Scam Category tag, Detected Link with **Inspect** button, and Highlighted Evidence.
- [ ] Test the **1-Click WhatsApp Share** and **Copy Warning** buttons.
