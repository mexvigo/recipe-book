# Recipe Book

A personal, mobile-friendly recipe app. No accounts, no server, no database — just
static files. Works offline and installs to your phone's home screen.

## Run it locally

You have Node installed, so from this folder:

```
node server.js
```

Then open **http://localhost:5178** in your browser.

(You can also just double-click `index.html` to open it directly — everything works
except offline caching and "install to home screen," which need the server.)

## Use it on your phone

1. Host these files anywhere static (Netlify, Cloudflare Pages, GitHub Pages — all free),
   or run the server on your computer and visit its address from your phone on the same Wi-Fi.
2. Open the site in your phone browser → **Share → Add to Home Screen**.
3. It now behaves like an app and works offline.

## Features

- Instant search across titles **and** ingredients
- Filter by category, plus a ★ Favorites view
- Tap ingredients to check them off while cooking
- "Keep awake" button so your screen doesn't sleep mid-recipe
- Light & dark themes (follows your device)

## Editing recipes

All recipes live in **`recipes.js`** — one object each, in plain readable form.
To add a recipe, copy an existing block and edit the fields (there's a field guide
at the top of the file). No build step: save the file and refresh.

## Files

| File | What it is |
|------|------------|
| `recipes.js` | Your recipe data — the only file you'll normally edit |
| `index.html` | Page shell |
| `styles.css` | Styling (light/dark) |
| `app.js` | Search, routing, favorites, wake-lock |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | PWA / offline / home-screen icon |
| `server.js` | Tiny local dev server |
