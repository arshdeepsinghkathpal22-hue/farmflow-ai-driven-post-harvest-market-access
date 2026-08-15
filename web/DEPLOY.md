# Getting a live URL

The prototype is a static site, so hosting it is free and takes about three minutes. Everything on
this side is already done: the build works, the commit is made, and the GitHub Actions workflow is
in place. What is left needs your GitHub account, which is why it cannot be done for you.

---

## GitHub Pages (recommended)

The resulting URL is permanent, free, and served over HTTPS - which the receipt signing needs, since
WebCrypto only runs in a secure context.

### 1. Create an empty repository

Go to <https://github.com/new> and create a repository named **`farmflow`**.

Do **not** add a README, .gitignore or licence - the repository must be empty, otherwise the first
push is rejected.

### 2. Push

From this folder:

```bash
git remote add origin https://github.com/YOUR-USERNAME/farmflow.git
```

```bash
git push -u origin main
```

Git will ask for credentials. Use your GitHub username, and a **personal access token** as the
password - GitHub stopped accepting account passwords for this. Create one at
<https://github.com/settings/tokens> with the `repo` scope.

### 3. Turn Pages on

In the repository: **Settings → Pages → Build and deployment → Source → GitHub Actions**.

That is the whole configuration. The workflow in `.github/workflows/deploy.yml` builds and publishes
on every push to `main`.

### 4. Wait for the first run

Open the **Actions** tab. The first run takes about a minute. When it goes green, the site is at:

```
https://YOUR-USERNAME.github.io/farmflow/
```

If the Actions tab shows nothing, push once more - Pages sometimes needs the setting saved before it
will accept a run.

---

## Checking it worked

Open the URL on a phone as well as a laptop. Four things should be true:

1. The first-run guide appears, then dismisses.
2. **Speak to Book** produces a QR receipt.
3. On the receipt, **Verify this receipt** reports *genuine*; changing one digit reports *altered*.
   If verification fails on the live site but works locally, the page is not on HTTPS - WebCrypto is
   unavailable in an insecure context.
4. The Storage Owner Dashboard opens from the Profile tab.

---

## Updating it later

Every push to `main` redeploys. Nothing else to do:

```bash
git add -A
```

```bash
git commit -m "your message"
```

```bash
git push
```

---

## If you would rather not use GitHub

The `dist/` folder produced by `npm run build` is a complete static site. It can be dropped into
Netlify, Cloudflare Pages, Vercel or any static host without modification - Vite is configured with
a relative base path and the app uses a hash router, so it works from any subpath.
