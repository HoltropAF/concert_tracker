# Online artist photos

1. Create an account at https://serpapi.com/users/sign_up and select the Free plan.
2. Copy your private API key from https://serpapi.com/manage-api-key.
3. In the SetTracker Vercel project, open Settings → Environment Variables.
4. Add `SERPAPI_API_KEY` as a secret for Production (and Preview if needed). Paste the key as its value. Do not use a `VITE_` prefix or commit the key.
5. Redeploy the app so the server receives the new variable.
6. Open an artist → Edit → Add photo / Change photo → Search online. Search, preview a result, then select Use this photo and reposition it.

The free SerpApi plan currently includes 250 searches per month. Searches run only when submitted. The server caches repeated queries for 30 minutes per warm instance and coalesces simultaneous identical searches. Its short per-instance rate limit is not a global monthly quota; keep the account on the free plan to avoid paid usage.

Photo imports use signed, expiring selections and public HTTPS addresses with DNS validation on every redirect. Unsupported, blocked or over-4MB originals show an error so another photo can be selected. Source links are retained; search availability does not grant image reuse rights. Phone/Google Photos upload remains available without SerpApi.
