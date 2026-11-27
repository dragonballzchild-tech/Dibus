# Get a YouTube API key and add it to Vercel (T4)

This takes about 10 minutes and costs nothing. The key lets Dibus's server ask YouTube for search results.
The free daily allowance is 10,000 units, and one search costs 100 units, so about 100 uncached searches per day.

**Keep the key secret.** Never paste it into a chat, a GitHub file, or the website's code. It only goes into Vercel (Part 2).

## Part 1: Create the key in Google Cloud

1. Go to https://console.cloud.google.com and sign in with a Google account. Accept the terms if asked.
2. Click the project picker at the top of the page (it may say "Select a project"), then **New project**.
3. Name it `dibus` and click **Create**. Wait for the notification, then make sure `dibus` is the selected project in the picker.
4. Open the menu (☰) → **APIs & Services** → **Library**.
5. Search for **YouTube Data API v3**, open it, and click **Enable**.
6. Open the menu (☰) → **APIs & Services** → **Credentials**.
7. Click **Create credentials** → **API key**. A key appears. Copy it somewhere private for the next part (a password manager or a private note).
8. Restrict the key so it can only be used for YouTube:
   - Click **Edit API key** (or the key's name in the list).
   - Under **Application restrictions**, leave **None** (Vercel's server addresses change, so an address restriction would break the site).
   - Under **API restrictions**, choose **Restrict key**, tick **YouTube Data API v3**, and click **OK**.
   - Click **Save**.

If Google asks you to add a billing account or a credit card at any step, stop and tell me. The basic YouTube quota should not need one.

## Part 2: Add the key to Vercel

1. In Vercel, open your **dibus** project → **Settings** → **Environment Variables**.
2. Add a variable:
   - **Key:** `YOUTUBE_API_KEY` (exactly this, capital letters)
   - **Value:** paste the key
   - **Environments:** leave all ticked (Production, Preview, Development)
   - If you see a **Sensitive** option, turn it on.
3. Click **Save**.
4. Variables only apply to new deployments, so redeploy: **Deployments** → the latest one → the **⋯** menu → **Redeploy**.

## Part 3: Check that it works (after T5 is uploaded)

Open `https://YOUR-SITE.vercel.app/api/search?q=cars` in your browser. You should see a block of text starting with `{"query":"cars","results":[` followed by video titles.

| What you see | Meaning |
|---|---|
| Video results | It works |
| `server_not_configured` | The key isn't set, or you haven't redeployed since adding it |
| `upstream_error` | Google rejected the key. Check that the YouTube Data API v3 is enabled and the key isn't mistyped |
| `quota_exceeded` | The daily free allowance is used up. It resets once a day |

## If the key ever leaks
In Google Cloud → Credentials, delete the key, create a new one, and update it in Vercel (Part 2).
