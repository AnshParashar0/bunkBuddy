-- Row Level Security: deny by default, open only what each role needs.
alter table colleges enable row level security;
alter table departments enable row level security;
alter table campus_locations enable row level security;
alter table profiles enable row level security;
alter table verification_requests enable row level security;
alter table bunk_requests enable row level security;
alter table request_inbox enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;
alter table feedback enable row level security;

-- Reference data
create policy colleges_read  on colleges for select to authenticated using (status = 'active' or is_admin());
create policy colleges_admin on colleges for all    to authenticated using (is_admin()) with check (is_admin());
create policy dept_read  on departments for select to authenticated using (true);
create policy dept_admin on departments for all    to authenticated using (is_admin()) with check (is_admin());
create policy loc_read   on campus_locations for select to authenticated using (true);
create policy loc_admin  on campus_locations for all    to authenticated using (is_admin()) with check (is_admin());

-- Profiles: you see your own full row (admins see all). Others only via public_profiles view.
create policy profiles_self_read on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update to authenticated
  using (id = auth.uid() and not suspended) with check (id = auth.uid());
-- Column-level lock: users may only edit these columns directly.
revoke update on profiles from authenticated;
grant update (name, photo_url, course, department, year, bio, interests) on profiles to authenticated;

-- Safe, same-college, no student_id / no verification internals.
create view public_profiles as
  select p.id, p.name, p.photo_url, p.college_id, p.course, p.department, p.year, p.bio, p.interests,
         (p.verification_status = 'verified') as verified
    from profiles p
   where p.id = auth.uid()
      or (p.college_id = my_college() and p.verification_status = 'verified' and not p.suspended
          and not is_blocked_between(auth.uid(), p.id));
revoke all on public_profiles from anon;
grant select on public_profiles to authenticated;

create policy verif_read on verification_requests for select to authenticated using (user_id = auth.uid() or is_admin());
create policy req_read on bunk_requests for select to authenticated using (user_id = auth.uid() or is_admin());

create policy inbox_read   on request_inbox for select to authenticated using (recipient_id = auth.uid());
create policy inbox_ignore on request_inbox for delete to authenticated using (recipient_id = auth.uid());

create policy match_read on matches for select to authenticated using (auth.uid() in (user1_id, user2_id));

create policy msg_read on messages for select to authenticated
  using (exists (select 1 from matches m where m.id = match_id and auth.uid() in (m.user1_id, m.user2_id)));
create policy msg_send on messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (
    select 1 from matches m where m.id = match_id and m.status = 'active' and auth.uid() in (m.user1_id, m.user2_id)));

create policy blocks_read   on blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_delete on blocks for delete to authenticated using (blocker_id = auth.uid());

create policy reports_read on reports for select to authenticated using (reporter_id = auth.uid() or is_admin());

-- No direct writes on these; only the security-definer functions in 0002.
revoke insert, update, delete on verification_requests, bunk_requests, request_inbox, matches, blocks, reports, feedback from authenticated;
grant delete on request_inbox, blocks to authenticated;
revoke update, delete on messages from authenticated;
