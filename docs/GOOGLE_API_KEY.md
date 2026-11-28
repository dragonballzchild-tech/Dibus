# Creating a YouTube Data API v3 Key for Dibus

Dibus uses the official YouTube Data API v3 (`search.list`) on the server side (`api/search.js`) so your API key is never exposed to browsers.

## 1. Create a Google Cloud Project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project selector at the top left and choose **New Project**.
3. Name it `dibus` (or any name you prefer) and click **Create**.
4. Make sure the new project is selected in the top bar.

## 2. Enable YouTube Data API v3

1. Open **APIs & Services → Library** from the left menu.
2. Search for **YouTube Data API v3**.
3. Click it and press **Enable**.

## 3. Create and Restrict the API Key

1. Go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials → API key**.
3. Copy the generated key, then click **Edit API key** (recommended):
   - Under **API restrictions**, select **Restrict key**.
   - Choose **YouTube Data API v3** and click **Save**.

## 4. Add the Key to Vercel

1. Open your Dibus project in the [Vercel Dashboard](https://vercel.com/dashboard).
2. Go to **Settings → Environment Variables**.
3. Add a variable named `YOUTUBE_API_KEY` with your API key as the value (apply to Production, Preview, and Development).
4. Redeploy the project so the function picks up the new variable.

## Quota Notes

- Each uncached search (`search.list`) costs **100 quota units**.
- Google Cloud gives a default free quota of **10,000 units/day** (~100 uncached searches/day).
- Repeated searches for the same query within 1 hour are served from Vercel's edge cache and cost **0 units**.
