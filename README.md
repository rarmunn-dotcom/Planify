# Planify: Planning Applications Simplified

Add the documents from a planning application and get a plain-language summary of what it could mean for people nearby, with every point linked to the page it came from. Nothing here scores or recommends. It reports what the documents say.

The site is one file (`index.html`). The Analyse button and the chat call Claude through a small relay (`worker/`) so visitors don't need an account and your API key stays private.

## Set it up (about 20 minutes)

### 1. Get an Anthropic API key
1. Go to console.anthropic.com and sign in.
2. Add a little credit and set a **monthly spend limit** in the billing settings. This is your real safety net against surprise costs.
3. Create an API key and copy it. Never paste it into `index.html` or commit it to GitHub.

### 2. Deploy the relay on Cloudflare (free plan is fine)
You need Node.js installed. In a terminal, from this folder:

```
cd worker
npm install -g wrangler
wrangler login
```

Open `wrangler.toml` and change `ALLOWED_ORIGINS` to your GitHub Pages address, which for you is `https://rarmunn-dotcom.github.io` (no trailing slash and no repo name). Then:

```
wrangler secret put ANTHROPIC_API_KEY     # paste your key when asked
wrangler deploy
```

Wrangler prints your relay address, like `https://planning-simplified-proxy.your-name.workers.dev`. Copy it.

### 3. Point the page at the relay
Open `index.html` in GitHub's editor (pencil icon) and find this line near the top of the script:

```
const PROXY_URL = "PASTE-YOUR-WORKER-URL-HERE";
```

Replace the text in quotes with your relay address and commit.

### 4. Publish on GitHub Pages
1. Make a new public repository and upload `index.html` and this README (and the `worker` folder if you want the code on show).
2. Settings, then Pages. Source: "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
3. After a minute your site is live at `https://rarmunn-dotcom.github.io/Planify/`.

## What protects it
- Only the addresses in `ALLOWED_ORIGINS` can use the relay.
- Each visitor location is limited to 6 requests a minute (change it in `wrangler.toml`).
- Prompts over about 300 KB are refused.
- Your Anthropic spend limit caps the total.

## Privacy
Text from the uploaded PDFs is sent from the visitor's browser to the relay, then to Claude, to write the summary. The relay doesn't store or log it. PDFs are read in the browser. A postcode, if given, goes to postcodes.io and OpenStreetMap to find an address list.

## If something breaks
- "The connection to Claude dropped": check `PROXY_URL`, and that `ALLOWED_ORIGINS` matches your site address exactly.
- "Too many requests": wait a minute, or raise the limit.
- Nothing happens on Analyse: open the browser console and look for a red error about CORS, which means the origin doesn't match.
