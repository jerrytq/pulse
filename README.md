# Pulse

Google sign-in, one editable 1–5 score per local calendar day, and a graph of your Firestore entries. No analytics or example mood data.

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

- Graph ranges: seven, thirty, ninety days, or all time; the scale stays fixed at 1–5.
- Missing days break the line rather than counting as zero or neutral.
- Hover a point for its date and score, or open the recorded-scores table.
- Counts and averages only include recorded days in the selected range.
- Saving waits for Firestore acknowledgement. New saves are disabled while the browser reports it is offline; pending saves wait for reconnection. Keep the page open until saving is confirmed.
- Sign-out clears mood data from the UI. Persistent Firestore disk caching is not enabled.

Google sign-in and production database access require verification in a real user session after the domain and rules setup. A successful build does not verify them.
