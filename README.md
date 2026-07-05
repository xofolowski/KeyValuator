# KeyValuator

A Confluence Forge app that lets you define named key-value stores on any page and look up individual values from those stores inline anywhere else in your Confluence space.

## Overview

KeyValuator provides two macros that work together:

| Macro | Role | Rendering |
|---|---|---|
| **LookupTable** | Define and edit a key-value store on a page | Block |
| **LookupKey** | Display a single value from any LookupTable inline | Inline |

**Example use case:** You maintain a "Team Directory" page with a LookupTable listing each team member's on-call rotation slot, Slack handle, or cost centre code. Anywhere else in your space — runbooks, project pages, release notes — you drop a LookupKey macro pointing at that table. When the value changes on the source page, every LookupKey referencing it automatically reflects the new value.

---

## How It Works

### LookupTable

The LookupTable macro stores its data as a [Confluence page content property](https://developer.atlassian.com/cloud/confluence/content-properties/) (a key-value JSON blob attached to the page). The property key is the Table ID you configure. The property value is a JSON object mapping your entry keys to their values.

The macro renders an editable table directly on the page. Authors can add and delete entries without leaving the page or opening any external tool.

### LookupKey

The LookupKey macro reads the content property from the target page at render time and extracts the value for the configured key. It renders the result as an inline element, sitting naturally within surrounding paragraph text.

All data access goes through a Forge backend resolver using the Confluence REST API v2 (`/wiki/api/v2/pages/{id}/properties`). No data is stored outside of Confluence — there is no external database.

---

## Prerequisites

- Node.js 18 or later
- [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/) installed and logged in (`forge login`)
- Confluence Cloud site with admin access for installation

---

## Project Structure

```
KeyValuator/
├── manifest.yml                  # Forge app manifest (modules, scopes, resources)
├── src/
│   ├── resolvers/
│   │   └── index.js              # Backend: Confluence API calls via asApp()
│   ├── lookupTable/
│   │   ├── index.jsx             # LookupTable entry point + config form
│   │   └── LookupTable.jsx       # LookupTable view component
│   └── lookupKey/
│       ├── index.jsx             # LookupKey entry point + config form
│       └── LookupKey.jsx         # LookupKey view component
└── icon.svg                      # App icon (convert to PNG for the developer console)
```

---

## Deployment

### First-time setup

Install dependencies:

```bash
npm install
```

### Deploy to development

```bash
forge deploy --non-interactive -e development
forge install --non-interactive --site <your-site>.atlassian.net --product confluence --environment development
```

### Deploy to production

```bash
forge deploy --non-interactive -e production
forge install --non-interactive --site <your-site>.atlassian.net --product confluence --environment production
```

### Upgrading after scope changes

If you add or change OAuth scopes in `manifest.yml`, redeploy and then upgrade the installation:

```bash
forge deploy --non-interactive -e production
forge install --non-interactive --upgrade --site <your-site>.atlassian.net --product confluence --environment production
```

### Uninstalling the development version

Once you are running in production you may want to remove the development installation. This is done through the Confluence UI:

1. Go to **Confluence Settings** → **Manage apps**
2. Locate **KeyValuator (development)**
3. Expand the entry and click **Uninstall**

---

## Usage

### Step 1 — Create a LookupTable

1. Open (or create) the Confluence page that will act as your data source.
2. Insert the **LookupTable** macro via the macro browser or the `/` command.
3. In the macro configuration panel, enter a **Table ID** — a short, unique identifier for this store on this page (e.g. `team-contacts`). The ID can contain letters, numbers, and hyphens.
4. Save the macro. An empty table is shown on the page.

> The Table ID is the property key used to store data in Confluence. Each LookupTable on a page must have a unique Table ID. The ID is not shown to end readers — only the table contents are.

### Step 2 — Add entries to the table

With the page in view mode, the LookupTable macro renders an editable interface:

- **Adding an entry:** type a key and a value into the fields at the bottom of the table, then click **Add**.
- **Deleting an entry:** click **Delete** on the row you want to remove.

Changes are saved to the page property immediately on each action — there is no separate save step.

### Step 3 — Reference a value with LookupKey

1. On any Confluence page, position your cursor inline in a paragraph where the value should appear.
2. Insert the **LookupKey** macro.
3. In the configuration panel:
   - **Page** — select the page that contains the LookupTable you want to query. The dropdown is pre-populated with pages from the current space.
   - **Lookup Table ID** — select the Table ID from the chosen page. The options are populated automatically once a page is selected.
   - **Key** — type the exact key whose value you want to display (e.g. `oncall`).
4. Save the macro. The looked-up value renders inline within your text.

#### Example

Given a LookupTable on page "Team Directory" with Table ID `contacts`:

| Key | Value |
|---|---|
| `oncall` | Alice |
| `slack` | #team-eng |
| `cost-centre` | CC-4021 |

A LookupKey macro configured as:
- Page: _Team Directory_
- Lookup Table ID: `contacts`
- Key: `oncall`

…renders as: `Alice` — inline, within whatever sentence surrounds it.

---

## Configuration Reference

### LookupTable

| Field | Description |
|---|---|
| **Table ID** | Unique identifier for this key-value store on this page. Used as the Confluence content property key. Required. |

### LookupKey

| Field | Description |
|---|---|
| **Page** | The Confluence page that hosts the target LookupTable. Select from pages in the current space. |
| **Lookup Table ID** | The Table ID of the LookupTable on the selected page. Options are loaded automatically after a page is selected. |
| **Key** | The key whose value should be displayed. Must exactly match an entry in the table (case-sensitive). |

---

## Data Storage

Data is stored exclusively as [Confluence content properties](https://developer.atlassian.com/cloud/confluence/content-properties/) on the page hosting the LookupTable macro. No external database or Forge storage is used.

Each LookupTable writes one property to its host page:

- **Property key:** the Table ID configured in the macro
- **Property value:** a JSON object, e.g. `{ "oncall": "Alice", "slack": "#team-eng" }`

Data is scoped to the Confluence page. Deleting the page also deletes all associated LookupTable data. There is no built-in export or backup — use standard Confluence page export if you need a snapshot.

---

## Permissions

The app requests the minimum scopes needed to read and write page content properties:

| Scope | Purpose |
|---|---|
| `read:page:confluence` | Read page properties (load table data, list tables on a page) |
| `write:page:confluence` | Write page properties (save table data) |
| `read:confluence-props` | Legacy scope retained for compatibility |
| `write:confluence-props` | Legacy scope retained for compatibility |

The app runs as the app identity (`asApp()`), not as the current user. All users who can view the page can see LookupTable data; the macro does not enforce per-user access control beyond Confluence's own page permissions.

---

## Troubleshooting

**LookupTable shows "Failed to load data"**
Check that the macro is on a published page (not a draft). Verify the Table ID in the macro config is set.

**LookupKey shows "Key not found"**
Confirm the key exists in the LookupTable with exactly the same spelling and case. Open the source page to verify.

**LookupKey shows "Invalid page ID"**
The macro config was saved with an invalid page reference. Re-open the LookupKey config, re-select the page, and save again.

**Viewing app logs**

```bash
forge logs -e production --since 15m
```

---

## Operational Costs

KeyValuator is a private Forge app. Hosting is included with your Confluence Cloud subscription — there are no per-invocation charges. Forge's free tier limits (1,000,000 function invocations/month) are far above what a single-site installation will consume under normal usage.
