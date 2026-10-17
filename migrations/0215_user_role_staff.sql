-- 0215: papéis de staff no enum user_role.
alter type user_role add value if not exists 'superadmin';
alter type user_role add value if not exists 'finance';
alter type user_role add value if not exists 'support';
alter type user_role add value if not exists 'moderator';
