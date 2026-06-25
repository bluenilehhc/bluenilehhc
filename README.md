# 245D Document Tracker — hosted app with logins

A small web app for tracking 245D documents (Basic, Intensive, and Program-wide)
with real email/password accounts. Your whole team shares one client list, and
only members of your team can see it — enforced at the database level. Works from
any computer once it's deployed.

Stack: React + Vite (frontend) and Supabase (login + database). Both have free tiers.

---

## READ THIS FIRST — client data & HIPAA

Client names combined with their service category and plan dates are **protected
health information (PHI)**. If you host this for a Minnesota 245D provider:

- The free tiers of Supabase, Vercel, and Netlify are **not** covered by a
  Business Associate Agreement (BAA). Storing real client names there would be a
  HIPAA violation.
- This app is built to use **client codes or initials** (e.g. `A.H.` or `C-104`),
  not full names. Keep the code-to-name key in your existing secure system, offline.
- If you must store real names, you need BAA-covered hosting: Supabase on a paid
  Team plan with its HIPAA add-on, plus a host that signs a BAA (e.g. Vercel
  Enterprise, or AWS/Google Cloud). Or use a purpose-built HIPAA-compliant
  HCBS/EHR vendor instead of self-hosting.

Treat this tool as an organizer for *deadlines*, not a record system for *PHI*.

---

## Step 1 — Create the database (Supabase)

1. Go to supabase.com, sign up, and create a new project (pick a strong database
   password and save it).
2. In the project, open **SQL Editor → New query**. Paste the entire contents of
   `supabase_schema.sql` and click **Run**. This creates the table and the
   security rules.
3. Open **Settings → API**. Copy two values:
   - Project URL
   - `anon` public key
4. (Optional, for quick internal use) Open **Authentication → Providers → Email**
   and turn **Confirm email** off so accounts work immediately without an email
   step. Leave it on if you prefer verified emails.

## Step 2 — Run it locally (optional, to test)

```
npm install
cp .env.example .env        # then edit .env with your two values from Step 1.3
npm run dev
```

Open the printed localhost URL, create an account, and try it.

## Step 3 — Deploy so any computer can reach it

Easiest path is Vercel:

1. Put this folder in a GitHub repository (or use the Vercel CLI).
2. At vercel.com, **Add New → Project**, import the repo.
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Framework preset = **Vite**. Click **Deploy**.
5. You get a URL like `https://your-app.vercel.app`. Open it on any computer,
   sign in, and your documents are there.

Netlify works the same way (build command `npm run build`, publish directory
`dist`, same two environment variables).

---

## Adding staff later

The first person to sign in creates the team (and gets an **invite code**, shown
in the app header). Everyone else signs up, then enters that code on the team
setup screen to join. From then on the whole team shares one client list and any
member can add, edit, or complete items. The database rules ensure only members
of your team can see the data — someone who signs up without the code sees nothing.

To find or share the code later: it's in the app header next to the team name —
tap it to copy.

## Notes

- **Company name & logo:** your logo is included at `public/logo.png` and shows
  on every screen (and as the browser-tab icon). To change it, replace that file
  with a new image of the same name. The company name text lives in `src/brand.js`.
- Tailwind is loaded from a CDN for simplicity. Fine for an internal tool; for a
  production build you can switch to a compiled Tailwind setup later.
- Cadences in the document library are 245D defaults and are editable per item.
  Real due dates follow each person's CSSP and service type. Not legal advice —
  verify against current 245D rules and your licensor.
