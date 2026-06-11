DELETE FROM auth.users WHERE id = 'bf438319-ed11-45eb-82ae-139d967dd861';

UPDATE auth.users
SET email = 'ohall@medikong.pro',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now(),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', 'ohall@medikong.pro')
WHERE id = '18231518-7e56-406c-9375-d3c25d9c463d';

UPDATE auth.identities
SET identity_data = identity_data || jsonb_build_object('email', 'ohall@medikong.pro'),
    updated_at = now()
WHERE user_id = '18231518-7e56-406c-9375-d3c25d9c463d' AND provider = 'email';