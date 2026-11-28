# Create a YouTube Data API v3 key

This guide creates a server-side API key for Dibus. The key must be stored in Vercel and must never be committed to GitHub or included in browser code.

## 1. Create a Google Cloud project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with your Google account.
3. Open the project selector near the top of the page and choose **New Project**.
4. Give it a name such as `Dibus YouTube Search` and create it.
5. Select the new project.

## 2. Enable YouTube Data API v3

1. Open **APIs & Services → Library**.
2. Search for **YouTube Data API v3**.
3. Open it and select **Enable**.

## 3. Create an API key

1. Open **APIs & Services → Credentials**.
2. Select **Create Credentials → API key**.
3. Copy the generated key and keep it private.
4. Open the key's settings. Under **API restrictions**, choose **Restrict key** and select **YouTube Data API v3**.
5. Save the restriction.

For this server-side Vercel Function, do not add browser HTTP-referrer restrictions: requests originate from Vercel's server environment, not the visitor's browser. API restriction to YouTube Data API v3 is still recommended. If you later add an appropriate server-side IP restriction, make sure it matches the deployment's actual egress setup.

## 4. Add the key to Vercel

1. Open your Dibus project in [Vercel](https://vercel.com/dashboard).
2. Go to **Settings → Environment Variables**.
3. Add a variable named exactly `YOUTUBE_API_KEY`.
4. Paste the API key as its value.
5. Select the environments you use (Preview and Production; Development if you use Vercel CLI).
6. Save the variable.
7. Redeploy the project so the function receives the new environment variable.

Do not put the key in `index.html`, `src/`, `README.md`, `.env.example`, or any other file committed to Git. `.env` is ignored by Git; keep any local secret there only if needed.

## 5. Verify

After deployment, open the Dibus site and search for a common term. The browser should call the same-origin `/api/search` endpoint. Inspect the request and response: the API key must not appear in the browser URL, response body, or page source. The request to Google's API happens only inside the Vercel Function.

## Quota

The YouTube Data API has a daily quota. A `search.list` request has a quota cost, so Dibus intentionally searches only after the user submits the form and caches successful responses at Vercel's edge for one hour. If the API reports quota exhaustion, Dibus shows a message and direct video-link playback remains available.

Check current quota and project usage in Google Cloud Console under **APIs & Services → YouTube Data API v3 → Metrics** (the exact console navigation may change).
