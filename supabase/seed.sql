-- Demo data. Replace the domain with your real college email domain.
with c as (
  insert into colleges (name, location, domain, verification_method)
  values ('Demo College', 'Indore', 'demo-college.edu', 'id_admin') returning id
), d as (
  insert into departments (college_id, name)
  select id, unnest(array['Computer Science','Management','Mechanical','Civil','Electronics']) from c
)
insert into campus_locations (college_id, name)
select id, unnest(array['Canteen','Library','Ground','Main Gate','Cafeteria','Parking','Department Block']) from c;
