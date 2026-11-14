-- Create the first administrator SECURELY:
-- 1. Register normally on the website with the email you want to use, and verify it.
-- 2. Open Supabase Dashboard → SQL Editor (only project owners can access it).
-- 3. Replace the email below and run this script.
-- Admin can never be self-assigned from the website: sign-up only allows client/freelancer,
-- and the profiles_guard trigger blocks role changes to/from admin from the API.
-- After this, existing admins can promote others from Admin → Users.

update public.profiles
set role = 'admin', profile_completed = true
where id = (select id from auth.users where email = 'hncreativeagencyhr@gmail.com');

select p.full_name, p.role, u.email from public.profiles p join auth.users u on u.id = p.id where p.role = 'admin';
