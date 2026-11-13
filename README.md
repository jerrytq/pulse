# Pulse

Google sign-in, one editable 1–5 score per local calendar day, and a graph of your Firestore entries. No analytics.

On localhost (including `127.0.0.1` and IPv6 loopback), click **Show demo data** beside the graph to preview fictional scores across 90 days, including gaps for missed days. The demo button is hidden on hosted domains. No sign-in is needed for the preview, and sample scores are never written to Firestore. Click **Show my data** to return to your real history.

## Firebase setup

1. In Firebase Console → Firestore Database → Rules, replace the rules with `firestore.rules` and click Publish. The app cannot read or save until these rules are published. Alternatively, with an authenticated Firebase CLI: `firebase deploy --only firestore:rules --project pulse-cf829`.
2. In Authentication → Settings → Authorized domains, add `localhost` for development and the deployed app hostname (hostname only, no scheme or path).
3. Google sign-in must be enabled in Authentication → Sign-in method.

The web config for `pulse-cf829` is in `lib/firebase.ts`. These are public project identifiers. Rules restrict each user to `users/{their Firebase UID}/moods/{YYYY-MM-DD}`, validate integer scores from 1 through 5, reject extra fields, and require a server update timestamp. Other paths are denied. Any Google user can use their own isolated account; this is not a single-email allowlist.

Each mood document stores `date`, `score`, and `updatedAt`. The date uses the device’s local calendar at submission. Saving the same date replaces that day’s score. The UI only offers today’s entry; rules do not restrict writes to the current date because local dates vary by timezone.

## Local development

Requires Node.js 22.13+ (a current Node 22 release is recommended).

```sh
npm.cmd ci
npm.cmd run dev
```

Open the Local URL printed by the dev server. On macOS/Linux, use `npm` instead of `npm.cmd`. On Windows, `npm.cmd` also works when PowerShell blocks `npm.ps1`.

## Vercel deployment

This is a standard Next.js app. No deployment is performed by this repository.

Import the Pulse repository into Vercel and leave **Root Directory** at the repository root (`./`). Use the **Next.js** framework preset with the default build and output settings, and Node.js 22.x.

After deployment, add the Vercel hostname to Firebase Authentication → Settings → Authorized domains. Publish `firestore.rules` in your Firebase project before using the tracker. No server keys or Vercel environment variables are needed for the included public Firebase web configuration.

Local checks: `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`.

## Behavior

- Click any recorded graph point (or its **Add note / Edit note** button in the score table) to add, edit, or remove a note of up to 500 characters. Notes are shown on hover, marked on the graph, and included in full in backups. Saving a note only updates that existing day’s note and update timestamp; changing today’s mood score preserves its note. Clear the note and save to remove it. Demo notes stay in memory and are never exported or written to Firestore.
- After updating to the notes feature, publish the updated `firestore.rules` in Firebase Console → Firestore Database → Rules. Existing records remain valid without a `note` field; an optional `note` must be a string no longer than 500 characters. The account ownership rules are unchanged.

- **Export backup** appears when signed in. It downloads the entire real mood collection as a dated JSON file, regardless of the graph range or demo mode. It requires an online server read and waits for pending writes to finish; offline or failed reads never fall back to cached or demo data. An empty account produces an explicit zero-document backup.

- Graph ranges: seven, thirty, ninety days, or all time; the scale stays fixed at 1–5.
- Missing days break the line rather than counting as zero or neutral.
- Hover a point for its date and score, or open the recorded-scores table.
- Counts and averages only include recorded days in the selected range.
- Saving waits for Firestore acknowledgement. New saves are disabled while the browser reports it is offline; pending saves wait for reconnection. Keep the page open until saving is confirmed.
- Sign-out clears mood data from the UI. Persistent Firestore disk caching is not enabled.

Google sign-in and production database access require verification in a real user session after the domain and rules setup. A successful build does not verify them.

## Backup format and future restoration

Keep the JSON file as downloaded. This is the app’s portable data export, not a Firebase managed-export file. No import feature is included.

`format: "pulse-mood-backup"` and `schemaVersion: 1` identify the format. Each export includes a UTC export timestamp, source Firebase project/database, account UID/email/display name, source collection path, the mood scale and descriptions, a document count, and every mood document’s exact ID, path, and fields. Records are read directly from the server without ordering/filtering by date, so even records the graph cannot display are included. No authentication tokens or API keys are exported. Firestore rules, Firebase configuration, and Firebase Authentication accounts are not part of this mood-data backup.

Within `documents[].data`, JSON primitives are stored directly. Firestore timestamps are represented as `{ "type": "timestamp", "seconds": ..., "nanoseconds": ... }`, preserving original precision. Arrays use `{ "type": "array", "values": [...] }`; ordinary nested maps use `{ "type": "map", "fields": {...} }` to avoid ambiguity with typed objects. Geographic points, base64 bytes, document references (including project/database/path), and non-JSON numeric values have explicit type tags. Unsupported values stop the export instead of silently dropping data. See `lib/backup.ts` and `tests/backup.test.mjs` for the format and tested reconstruction examples.

A future restoration tool can decode the fields and write each document using its saved ID (or map the source UID to a replacement account). Preserve local calendar date strings as-is. Entry timezones were never recorded and cannot be reconstructed from an export. Current client security rules require `updatedAt` to be the current server time when writing; restoring original update timestamps unchanged requires a trusted administrative restore or a deliberate rules change. This file preserves those original values for that purpose. Retain dated copies outside Firebase to keep multiple recovery points.
