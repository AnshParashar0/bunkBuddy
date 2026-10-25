-- All writes that matter go through these functions (security definer + checks).
-- Clients cannot insert requests/matches/reports directly (see 0003 RLS).
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function my_college() returns uuid language sql stable security definer set search_path = public as $$
  select college_id from profiles where id = auth.uid();
$$;

create function is_blocked_between(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create function has_active_match(u uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from matches where status = 'active' and u in (user1_id, user2_id));
$$;

create function touch_activity() returns void language sql security definer set search_path = public as $$
  update profiles set last_active = now() where id = auth.uid();
$$;

create function set_availability(p_status availability_status, p_minutes int default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status = 'available' and p_minutes is null then raise exception 'Choose how long you are free'; end if;
  if p_minutes is not null and (p_minutes < 15 or p_minutes > 480) then raise exception 'Duration must be 15 to 480 minutes'; end if;
  update profiles
     set availability_status = p_status,
         availability_until = case when p_minutes is null then null else now() + make_interval(mins => p_minutes) end,
         last_active = now()
   where id = auth.uid() and not suspended;
end $$;

-- Onboarding: set college once, auto-verify if the login email matches the college domain.
create function complete_onboarding(p_college uuid, p_name text, p_course text, p_department text, p_year int) returns void
language plpgsql security definer set search_path = public as $$
declare v_col colleges; v_email text;
begin
  select * into v_col from colleges where id = p_college and status = 'active';
  if not found then raise exception 'College not available'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'Enter your name'; end if;

  update profiles
     set college_id = p_college, name = trim(p_name), course = trim(p_course),
         department = trim(p_department), year = p_year
   where id = auth.uid() and not suspended
     and (verification_status <> 'verified' or college_id = p_college);
  if not found then raise exception 'Cannot change college after verification'; end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_col.domain is not null and lower(split_part(coalesce(v_email, ''), '@', 2)) = lower(v_col.domain) then
    update profiles set verification_status = 'verified' where id = auth.uid();
  end if;
end $$;

create function submit_verification(p_front text, p_back text default null, p_ocr jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_front is null or p_front not like auth.uid()::text || '/%' then raise exception 'Invalid upload'; end if;
  if p_back is not null and p_back not like auth.uid()::text || '/%' then raise exception 'Invalid upload'; end if;
  update profiles set verification_status = 'pending'
   where id = auth.uid() and verification_status in ('unverified','rejected');
  if not found then raise exception 'Verification already submitted'; end if;
  insert into verification_requests (user_id, front_path, back_path, ocr_data) values (auth.uid(), p_front, p_back, p_ocr);
end $$;

-- BUNK NOW: create request + fan out to eligible students (the matching algorithm).
create function create_bunk_request(p_activity text, p_duration int, p_visibility text default 'college') returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; rid uuid; ttl interval := interval '10 minutes';
begin
  select * into me from profiles where id = auth.uid();
  if me.verification_status <> 'verified' or me.suspended or me.college_id is null then
    raise exception 'Verify your college ID first';
  end if;
  if has_active_match(me.id) then raise exception 'You already have an active match'; end if;
  if (select count(*) from bunk_requests where user_id = me.id and created_at > now() - interval '1 hour') >= 6 then
    raise exception 'Too many requests. Try again in a while';
  end if;

  delete from request_inbox where request_id in (select id from bunk_requests where user_id = me.id and status = 'open');
  update bunk_requests set status = 'cancelled' where user_id = me.id and status = 'open';

  insert into bunk_requests (user_id, college_id, activity, duration_minutes, visibility, expires_at)
  values (me.id, me.college_id, p_activity, p_duration, p_visibility, now() + ttl)
  returning id into rid;

  insert into request_inbox (request_id, recipient_id, activity, duration_minutes, expires_at)
  select rid, p.id, p_activity, p_duration, now() + ttl
    from profiles p
   where p.college_id = me.college_id                       -- same college
     and p.id <> me.id
     and p.verification_status = 'verified' and not p.suspended
     and p.availability_status = 'available'                -- currently available
     and (p.availability_until is null or p.availability_until > now() + interval '10 minutes')  -- compatible duration
     and p.last_active > now() - interval '30 minutes'      -- online recently
     and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
     and not exists (select 1 from reports r where (r.reporter_id = me.id and r.reported_user_id = p.id) or (r.reporter_id = p.id and r.reported_user_id = me.id))
     and not has_active_match(p.id)
   order by p.last_active desc
   limit 50;
  return rid;
end $$;

create function cancel_request(p_request_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update bunk_requests set status = 'cancelled' where id = p_request_id and user_id = auth.uid() and status = 'open';
  get diagnostics n = row_count;
  if n > 0 then delete from request_inbox where request_id = p_request_id; end if;
  return n > 0;
end $$;

-- Race-safe accept: first accepter wins (row lock on the request).
create function accept_request(p_request_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare r bunk_requests; mid uuid;
begin
  select * into r from bunk_requests where id = p_request_id for update;
  if not found or r.status <> 'open' or r.expires_at <= now() then raise exception 'This request is no longer available'; end if;
  if not exists (select 1 from request_inbox where request_id = r.id and recipient_id = auth.uid()) then raise exception 'Not allowed'; end if;
  if is_blocked_between(r.user_id, auth.uid()) then raise exception 'Not allowed'; end if;
  if has_active_match(auth.uid()) or has_active_match(r.user_id) then raise exception 'Someone is already in a match'; end if;

  insert into matches (request_id, user1_id, user2_id) values (r.id, r.user_id, auth.uid()) returning id into mid;
  update bunk_requests set status = 'matched' where id = r.id;
  delete from request_inbox where request_id = r.id;
  return mid;
end $$;

create function end_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update matches set status = 'ended', ended_at = now(), ended_by = auth.uid()
   where id = p_match and status = 'active' and auth.uid() in (user1_id, user2_id);
end $$;

create function set_meeting_spot(p_match uuid, p_spot text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from campus_locations where college_id = my_college() and name = p_spot) then
    raise exception 'Unknown location';
  end if;
  update matches set meeting_spot = p_spot
   where id = p_match and status = 'active' and auth.uid() in (user1_id, user2_id);
end $$;

create function block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user = auth.uid() then raise exception 'Invalid'; end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  update matches set status = 'ended', ended_at = now(), ended_by = auth.uid()
   where status = 'active' and user1_id in (auth.uid(), p_user) and user2_id in (auth.uid(), p_user);
end $$;

create function submit_report(p_user uuid, p_reason text, p_description text default null, p_match uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user = auth.uid() then raise exception 'Invalid'; end if;
  insert into reports (reporter_id, reported_user_id, reason, description, match_id)
  values (auth.uid(), p_user, p_reason, p_description, p_match);
  -- 3+ different reporters in 30 days -> flag for moderation review
  if (select count(distinct reporter_id) from reports where reported_user_id = p_user and created_at > now() - interval '30 days') >= 3 then
    update profiles set flagged = true where id = p_user;
  end if;
end $$;

create function submit_feedback(p_match uuid, p_rating int, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from matches where id = p_match and status = 'ended' and auth.uid() in (user1_id, user2_id)) then
    raise exception 'Match not found';
  end if;
  insert into feedback (match_id, user_id, rating, note) values (p_match, auth.uid(), p_rating, p_note)
  on conflict (match_id, user_id) do update set rating = excluded.rating, note = excluded.note;
end $$;

-- Housekeeping (called by pg_cron every minute, see 0004)
create function expire_stale() returns void language plpgsql security definer set search_path = public as $$
begin
  update bunk_requests set status = 'expired' where status = 'open' and expires_at <= now();
  delete from request_inbox where expires_at <= now();
  update profiles set availability_status = 'busy', availability_until = null
   where availability_status <> 'busy' and availability_until is not null and availability_until <= now();
  update matches set status = 'ended', ended_at = now() where status = 'active' and created_at < now() - interval '6 hours';
end $$;
revoke execute on function expire_stale() from authenticated;

-- ---------- Admin ----------
create function admin_stats() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Forbidden'; end if;
  return jsonb_build_object(
    'total_students',    (select count(*) from profiles where role = 'student'),
    'verified_students', (select count(*) from profiles where role = 'student' and verification_status = 'verified'),
    'active_users',      (select count(*) from profiles where last_active > now() - interval '15 minutes'),
    'requests_today',    (select count(*) from bunk_requests where created_at >= date_trunc('day', now())),
    'matches_today',     (select count(*) from matches where created_at >= date_trunc('day', now())),
    'open_reports',      (select count(*) from reports where status in ('open','reviewing'))
  );
end $$;

-- Returns the old file paths so the admin UI can delete the ID images from storage.
create function admin_review_verification(p_id uuid, p_approve boolean, p_note text default null, p_student_id text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v verification_requests;
begin
  if not is_admin() then raise exception 'Forbidden'; end if;
  select * into v from verification_requests where id = p_id and status = 'pending' for update;
  if not found then raise exception 'Already reviewed'; end if;
  update verification_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         note = p_note, reviewed_by = auth.uid(), reviewed_at = now(), front_path = null, back_path = null
   where id = p_id;
  update profiles
     set verification_status = case when p_approve then 'verified'::verification_status else 'rejected'::verification_status end,
         student_id = case when p_approve then coalesce(nullif(trim(p_student_id), ''), student_id) else student_id end
   where id = v.user_id;
  return jsonb_build_object('front', v.front_path, 'back', v.back_path);
end $$;

create function admin_set_suspended(p_user uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Forbidden'; end if;
  update profiles set suspended = p_suspended, availability_status = 'busy', availability_until = null where id = p_user and role = 'student';
  if p_suspended then
    update bunk_requests set status = 'cancelled' where user_id = p_user and status = 'open';
    delete from request_inbox where recipient_id = p_user;
    update matches set status = 'ended', ended_at = now() where status = 'active' and p_user in (user1_id, user2_id);
  end if;
end $$;

create function admin_set_report_status(p_id uuid, p_status report_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Forbidden'; end if;
  update reports set status = p_status where id = p_id;
end $$;
