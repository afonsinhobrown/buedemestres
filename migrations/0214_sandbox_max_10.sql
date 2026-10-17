-- 0214: sandbox rejeita valores acima de 10 MT.
insert into app_settings(key, value, updated_at)
values ('sandbox_max_price', '10'::jsonb, now())
on conflict (key) do update set value = '10'::jsonb, updated_at = now();

insert into app_settings(key, value, updated_at)
values ('sandbox_min_price', '1'::jsonb, now())
on conflict (key) do update set value = '1'::jsonb, updated_at = now();
