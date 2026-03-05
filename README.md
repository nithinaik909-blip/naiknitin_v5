# PCB Finder App — Deployment Guide

## Deploy to Vercel (Recommended)

### Option A: GitHub + Vercel (easiest)
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Vercel auto-detects Next.js — just click **Deploy**
4. Go to **Settings → Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com

### Option B: Vercel CLI
```bash
npm i -g vercel
vercel          # follow prompts
vercel env add ANTHROPIC_API_KEY   # paste your key
vercel --prod
```

## Run Locally
```bash
npm install
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
# Open http://localhost:3000
```

## Project Structure
```
pages/
  index.jsx          → renders the main app
  api/claude.js      → secure API proxy (never exposes key to browser)
components/
  vision_ai_studio_v4.jsx  → main PCB finder UI
```
