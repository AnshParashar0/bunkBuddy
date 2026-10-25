# Bunk Buddy

Verify → Go Available → Bunk Now → Get Matched → Chat → Meet → End Match.

Stack: React + TypeScript (Vite) · Supabase (Postgres, Auth, Realtime, Storage, pg_cron) · Vercel.
No custom server: all rules live in Postgres functions + RLS.

## 1. Supabase setup

1. Create a project at supabase.com. Pick the region closest to your students (Mumbai `ap-south-1` for India). Save the DB password.
2. SQL Editor → run, in order: `0001_schema.sql`, `0002_functions.sql`, `0003_rls.sql`, `0004_storage_realtime_cron.sql`.
   (Or with the CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
3. Run `supabase/seed.sql` after editing the college name and email domain.
4. **Auth → Providers → Email**: enable. **Auth → Email Templates → Magic Link**: put `{{ .Token }}` in the body so students get a 6-digit code (the app uses code entry, not links).
5. **Auth → URL Configuration**: set Site URL to your Vercel URL; add `http://localhost:5173` to Redirect URLs.
6. **Auth → SMTP Settings**: add custom SMTP (Resend, Brevo, SES). The built-in mailer is limited to a few emails per hour and will break at launch.
7. **Auth → Attack Protection**: enable CAPTCHA (Cloudflare Turnstile) before launch. Add the captcha token to `signInWithOtp` options when you do.
8. Make yourself admin (after signing in once):
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```
9. Check **Database → Extensions**: `pg_cron` enabled. **Database → Replication**: the 5 tables from 0004 appear under `supabase_realtime`.
10. Project Settings → API: copy URL and anon key.

Phone OTP (PRD "mobile login"): Auth → Providers → Phone, connect Twilio or MessageBird. SMS costs money, so start with email.

## 2. Run locally

```bash
cp .env.example .env     # paste URL + anon key
npm install
npm run dev
```
Test with two browsers (one normal, one private) using two emails. For both to count as "verified" instantly, use emails on the college `domain` you seeded, or approve them from the admin dashboard.

## 3. How it works

| Piece | Where |
|---|---|
| Matching (same college, available, online in last 30 min, compatible duration, block/report filter) | `create_bunk_request()` |
| Notifications | inserts into `request_inbox` → Realtime → Home screen + browser notification |
| First-accept-wins | `accept_request()` locks the request row |
| Expiry (10 min request, availability end, stale matches) | `expire_stale()` via pg_cron + client timer |
| Privacy | recipients never see requester id; `public_profiles` view hides student ID; ID images deleted after review |
| Moderation | `submit_report()`, 3 distinct reporters in 30 days flags the user, admin can suspend |
| Integration layers | `src/services/integrations.ts` (OCR, college API, notifications) |

## 4. Deploy

1. Push to GitHub. Import in Vercel. Framework: Vite.
2. Add env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. `vercel.json` handles SPA routing.
3. Add the Vercel URL to Supabase Auth URL settings.

## 5. Production checklist

Security
- [ ] Only the anon key in the frontend. `service_role` never in client code or git.
- [ ] RLS test: sign in as student A, try `select * from profiles`, `insert into bunk_requests`, reading another match's messages. All should fail or return only your rows.
- [ ] Run Supabase **Database → Advisors** (security + performance) and fix warnings. The `public_profiles` view will show a "security definer view" warning; it is intentional, it exposes only safe columns.
- [ ] CAPTCHA on auth, custom SMTP, OTP expiry 10 min or less.
- [ ] Add Privacy Policy + Terms, link them on Login. ID photos and student data are personal data (India DPDP Act): collect consent, allow account deletion, state retention.
- [ ] Add an account-delete flow (Edge Function using the service role to call `auth.admin.deleteUser`).

Reliability
- [ ] Separate **staging** and **production** Supabase projects. Apply migrations to staging first.
- [ ] Upgrade to Pro before launch: daily backups + PITR, no auto-pause, higher Realtime limits (free tier has a low concurrent-connection cap).
- [ ] Keep every schema change as a new numbered file in `supabase/migrations/`. Do not edit the dashboard by hand.
- [ ] Error tracking: add Sentry to the frontend. Uptime check on the Vercel URL.
- [ ] Load test matching with ~500 fake profiles in one college. Indexes are in place; `limit 50` caps fan-out.

Product
- [ ] Add a "Report a problem" email and an admin on-call for reports.
- [ ] Real push notifications (Phase 2): service worker + Edge Function triggered by a DB webhook on `request_inbox` inserts.

## 6. Not built yet (next iterations)

- Landing page sections (How it works, FAQ, College network). Login screen carries the hero for now.
- "Until next class" duration (needs timetable data), activity-preference matching, proximity.
- Discover, friends, groups, events (Phase 2).
- Real OCR provider and college ERP verification (plug into `integrations.ts`).
- Admin: user search, per-department management.
