# KeyValuator — Deploy & Test Guide

## Prerequisites

- Forge CLI installed: `npm install -g @forge/cli`
- Logged in: `forge login` (uses your Atlassian API token)

---

## 1. Deploy

Run from the app root:

```bash
cd /Users/xof/playground/Projects/AtlassianForge/KeyValuator
forge deploy --non-interactive -e development
```

---

## 2. Install

First install:

```bash
forge install --non-interactive --site xof.atlassian.net --product confluence --environment development
```

If already installed and scopes have changed (e.g. after updating `manifest.yml`):

```bash
forge install --non-interactive --upgrade --site xof.atlassian.net --product confluence --environment development
```

---

## 3. Test — LookupTable macro

1. Open [xof.atlassian.net](https://xof.atlassian.net) and create a new Confluence page
2. In the editor, insert the **LookupTable** macro
3. Set the `id` parameter to any string, e.g. `my-table`
4. Publish the page
5. The macro should render an empty table with **Key** / **Value** input fields at the bottom
6. Add a few entries (e.g. `env` → `production`, `owner` → `alice`) and verify:
   - Each entry appears in the table after clicking **Add**
   - Clicking **Delete** removes the row
   - Reloading the page shows the saved data (confirming persistence via page properties)

---

## 4. Test — LookupKey macro

1. Copy the **page ID** from the URL of the page created above
   - URL format: `/wiki/spaces/SPACE/pages/123456/Page+Title`
   - The page ID is the number, e.g. `123456`
2. On any Confluence page (same or different), insert the **LookupKey** macro and set:
   - `pageId` → the page ID from step 1
   - `lookupId` → `my-table` (must match the `id` used in the LookupTable macro)
   - `key` → one of the keys you added, e.g. `env`
3. Publish the page
4. The macro should display the corresponding value inline (e.g. `production`)
5. Test an unknown key to confirm the "Key not found" warning appears

---

## 5. Debugging

View recent logs from the development environment:

```bash
cd /Users/xof/playground/Projects/AtlassianForge/KeyValuator
forge logs -e development --since 15m
```

For more history:

```bash
forge logs -e development --since 1h -n 100
```
