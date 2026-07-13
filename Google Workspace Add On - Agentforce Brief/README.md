# Agentforce Briefs — Google Calendar Workspace Add-on

A private proof-of-concept Google Calendar Workspace Add-on that surfaces an AI-generated customer brief in the Calendar right-side panel when a relevant meeting is opened.

---

## Files

| File | Purpose |
|---|---|
| `Code.gs` | All entry-point trigger functions, section builders, and utility helpers |
| `MockData.gs` | Structured mock customer brief data (`MOCK_BRIEFS`) and matching logic |
| `appsscript.json` | Apps Script manifest — add-on identity, triggers, OAuth scopes |
| `README.md` | This file |

---

## Icon — Required Manual Step

Before the add-on appears correctly in the Calendar side rail you must supply a publicly hosted icon URL.

| Property | Value |
|---|---|
| **Required format** | PNG or JPEG |
| **Recommended dimensions** | 96 × 96 px (Google recommends square; minimum 96 px) |
| **Where to enter the URL** | In `appsscript.json`, replace `"REPLACE_WITH_YOUR_PUBLIC_ICON_URL"` in the `common.logoUrl` field |
| **Manifest property** | `addOns.common.logoUrl` |

The URL **must** be publicly accessible over HTTPS. Google Calendar fetches the icon directly — a local file path will not work.

**Options for hosting the icon:**
- Upload the Agentforce icon PNG to Google Drive and use "Anyone with link" sharing (note: Drive direct-download URLs are not reliably served; prefer the next option)
- Upload to a public Google Cloud Storage bucket
- Host on any static file host (GitHub Pages, Netlify, Cloudinary, etc.)

The Agentforce icon asset is the `agent_astro` component (`1174:70`) in the Figma file. Export it from Figma as a 96 × 96 PNG, host it, then paste the URL into the manifest.

---

## Setup Instructions

### 1. Create a new standalone Apps Script project

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Name it **Agentforce Briefs**.

### 2. Enable viewing the manifest

1. Click **Project Settings** (gear icon, left sidebar).
2. Check **Show "appsscript.json" manifest file in editor**.
3. Return to the **Editor** view — `appsscript.json` now appears in the file list.

### 3. Paste the generated files

Replace the content of each file with the contents from this project:

| In Apps Script editor | Paste from |
|---|---|
| `appsscript.json` | `appsscript.json` |
| `Code.gs` (rename from `Untitled`) | `Code.gs` |
| Create new script file → name it `MockData` | `MockData.gs` |

To create `MockData`: click the **+** next to **Files** in the editor, choose **Script**, name it `MockData`.

### 4. Enable the Calendar Advanced Service

`getSelectedEventContext` uses `Calendar.Events.get()` from the Calendar Advanced Service to read the event title, times, and attendees. This service must be explicitly enabled:

1. In the Apps Script editor, click **Services** (the `+` icon next to "Services" in the left sidebar).
2. Scroll to and select **Google Calendar API**.
3. Leave the version as `v3` and the identifier as `Calendar`.
4. Click **Add**.

The `Calendar` identifier must exactly match the code — `Calendar.Events.get(calId, eventId)`.

> **Note:** If you skip this step the add-on will throw `ReferenceError: Calendar is not defined` when opening any event. The `catch` block will log the error and show the empty-state card rather than crashing.

### 6. Replace the icon URL placeholder

In `appsscript.json`, find:

```json
"logoUrl": "REPLACE_WITH_YOUR_PUBLIC_ICON_URL"
```

Replace the placeholder string with your publicly hosted HTTPS icon URL (see [Icon section](#icon--required-manual-step) above).

### 7. Save the project

Press **Ctrl+S** (or **Cmd+S**) or use **File → Save all**.

### 8. Deploy as a test deployment

1. Click **Deploy → Test deployments**.
2. In the dialog, click **Install**.
3. If prompted, review the permissions and click **Allow**.

> **Note:** If this is the first time you're deploying a Workspace Add-on in this Google account, you may need to configure a Google Cloud Platform project. See the [GCP note](#google-cloud-platform-note) below.

### 9. Authorize the requested permissions

The add-on requests these scopes:
- `calendar.addons.execute` — required to run add-on triggers
- `calendar.addons.current.event.read` — read the currently open event via the add-on event object

Click through the OAuth consent screen to grant access.

### 10. Refresh Google Calendar

Open [calendar.google.com](https://calendar.google.com) and hard-refresh the page (**Ctrl+Shift+R** / **Cmd+Shift+R**).

### 11. Find the Agentforce Briefs icon

The add-on icon appears in the right-side panel of Google Calendar. If it does not appear immediately, try refreshing again or waiting ~30 seconds.

### 12. Test the homepage card

Click the Agentforce Briefs icon without selecting any event. You should see:

> **Select a customer meeting** in Calendar to view its brief.

### 13. Test the customer brief

Create or open a calendar event with the title **Jordan Lee – Vehicle Consultation** (exact casing is not required — matching is case-insensitive). Click the Agentforce Briefs icon. The full customer brief should render in the right-side panel.

### 12. Test the empty state

Open any other calendar event. The add-on should display:

> No customer brief found for this meeting.

---

## Uninstalling the Test Deployment

1. In the Apps Script editor, click **Deploy → Test deployments**.
2. Find the deployment and click **Manage**.
3. Click **Uninstall** to remove it from your Calendar.

---

## Google Cloud Platform Note

Google Workspace Add-ons require a linked GCP project with the **Google Workspace Add-ons API** enabled.

If you see an error during test deployment:

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create (or select) a GCP project.
3. Enable the **Google Workspace Add-ons API** and **Google Calendar API**.
4. In Apps Script, go to **Project Settings → Google Cloud Platform (GCP) Project** and enter the GCP project number.

---

## Google Workspace Admin Restrictions

If your Google Workspace account is managed by an organisation, an admin may need to:

- Allow installation of **unchecked/unpublished** Workspace Add-ons (Apps Script test deployments).
- Whitelist third-party add-ons in the **Admin Console → Apps → Marketplace Apps** policy.

For a personal Google account, no admin action is required.

---

## Where Mock Data Lives

All mock data is in `MockData.gs` inside the `MOCK_BRIEFS` constant. The structure mirrors the card layout:

```
MOCK_BRIEFS.jordanLee
  ├── meeting        (title, dateLabel, timeLabel, guestCount)
  ├── summary        (at-a-glance paragraph)
  ├── currentVehicle (name, tradeInRange)
  ├── preferences    (array of tag strings)
  ├── inventory      (array: name, vin, color, location, isStaged, imageUrl)
  ├── opportunity    (string)
  └── recommendedSteps (array of strings)
```

### Vehicle image placeholders

Each inventory item contains an `imageUrl` field currently pointing to `via.placeholder.com`. Replace these with publicly hosted vehicle photo URLs (HTTPS, recommended 240 × 120 px or wider landscape crop).

---

## Replacing Mock Data with a Live Salesforce/Agentforce Endpoint

The integration seam is in `Code.gs` inside `resolveCustomerBrief()`:

```javascript
function resolveCustomerBrief(eventContext) {
  // Uncomment when ready:
  // var liveBrief = fetchBriefFromSalesforce(eventContext);
  // if (liveBrief) return liveBrief;

  return getMockCustomerBrief(eventContext);
}
```

Implement `fetchBriefFromSalesforce(eventContext)` to:

1. Obtain a Salesforce OAuth 2.0 token (store client credentials in `PropertiesService.getScriptProperties()`).
2. Call a Salesforce/Agentforce REST endpoint using `UrlFetchApp.fetch()`.
3. Map the response to the same object shape as `MOCK_BRIEFS.jordanLee`.
4. Return the structured brief (or `null` on miss/error).

No other changes are needed — the card-building functions consume the same schema regardless of the data source.

---

## Known Visual Differences: Figma vs CardService

| Figma design | CardService reality |
|---|---|
| Inter typeface | Google's native UI font (Roboto / system default) |
| Custom pill/chip tags with `#E8EEFA` background | Plain text with `·` separators |
| Rounded vehicle image card (5 px radius, border) | `Image` widget — no border radius or stroke |
| Inline SVG icons (people, checkbox outline) | Material icons via `CardService.Icon` enum or icon image URLs |
| Fixed-width 319 px frame | Full panel width (variable, ~320–360 px on most screens) |
| Exact hex colour body text `#454746` | CardService TextParagraph/DecoratedText does not support arbitrary text colour |
| `<font size>` scaling beyond "large" | CardService supports limited HTML in `TextParagraph` (b, i, u, font color, font size small/medium/large) |
| "Powered by Agentforce" Salesforce logo SVG | Plain italic text |

The card layout faithfully reproduces the content hierarchy, section labels, dividers, and information density of the Figma design within these platform constraints.

---

## Remaining Manual Steps Summary

| Step | Where |
|---|---|
| 1. Enable **Google Calendar API** (v3) in the Apps Script **Services** panel | Apps Script editor → Services |
| 2. Host the Agentforce icon (96 × 96 px PNG) publicly over HTTPS | Your choice of static host |
| 3. Paste the icon URL into `appsscript.json → addOns.common.logoUrl` | Apps Script editor |
| 4. Replace vehicle image URL placeholders in `MockData.gs` | Apps Script editor |
| 5. Link a GCP project with Workspace Add-ons API enabled (if not auto-created) | Google Cloud Console |
| 6. Grant admin policy to allow unchecked add-ons (managed Workspace accounts only) | Google Workspace Admin Console |
