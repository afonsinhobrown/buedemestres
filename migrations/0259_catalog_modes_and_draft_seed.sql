-- 0259: suporte a todos os modos de preço/entrega + seed draft por categoria
-- Não ativa preços fixos sem validação. Os itens ficam active=false.

-- ===== 1. Separação entre preço e modo de entrega =====
alter table service_catalog
  add column if not exists fulfillment_mode text not null default 'on_site';

do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'service_catalog'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%pricing_mode%'
  loop
    execute format('alter table service_catalog drop constraint %I', r.conname);
  end loop;
end $$;

alter table service_catalog
  add constraint service_catalog_pricing_mode_check
  check (pricing_mode in ('fixed', 'quote', 'hourly', 'hybrid'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_catalog_fulfillment_mode_check'
  ) then
    alter table service_catalog
      add constraint service_catalog_fulfillment_mode_check
      check (fulfillment_mode in ('on_site', 'remote', 'pickup', 'delivery'));
  end if;
end $$;

-- ===== 2. Regra global de deslocação =====
insert into pricing_rules (
  scope, kind, base_fee, per_km, included_km, min_fee, max_fee, road_factor, multiplier, active
)
select
  'global', 'travel', 100, 25, 2, 150, 600, 1.25, 1, true
where not exists (
  select 1 from pricing_rules
   where scope = 'global' and kind = 'travel' and active
);

-- ===== 3. Catálogo draft: um serviço de diagnóstico/orçamento por categoria =====
insert into service_catalog (
  category_id, slug, name, description, pricing_mode, fulfillment_mode,
  min_labor, max_labor, duration_min, active, sort_order
)
select
  c.id,
  'orcamento-' || c.slug,
  'Diagnóstico / orçamento',
  'Serviço a combinar depois de avaliar o problema. Sem preço fixo até validação.',
  'quote',
  case
    when c.slug = 'educacao' then 'remote'
    when c.slug in ('tecnologia') then 'remote'
    when c.slug = 'moda' then 'pickup'
    else 'on_site'
  end,
  null, null, 60, false, 0
from categories c
where c.parent_id is null
on conflict (slug) do nothing;

-- ===== 4. Casos adicionais por modo de entrega =====
insert into service_catalog (
  category_id, slug, name, description, pricing_mode, fulfillment_mode,
  min_labor, max_labor, duration_min, active, sort_order
)
select c.id, v.slug, v.name, v.description, v.pricing_mode, v.fulfillment_mode,
       v.min_labor, v.max_labor, v.duration_min, false, v.sort_order
from categories c
join (
  values
    ('educacao', 'explicacao-online', 'Explicação online', 'Aula por videochamada.', 'hourly', 'remote', 60, 60, 60, 1),
    ('educacao', 'explicacao-domicilio', 'Explicação ao domicílio', 'Aula em casa do aluno.', 'hourly', 'on_site', 60, 60, 60, 2),
    ('tecnologia', 'suporte-remoto', 'Suporte remoto', 'Assistência por acesso remoto.', 'hourly', 'remote', 45, 45, 45, 1),
    ('tecnologia', 'assistencia-domicilio', 'Assistência ao domicílio', 'Reparação no local.', 'quote', 'on_site', 60, 120, 60, 2),
    ('moda', 'costura-pickup', 'Costura / arranjo', 'Recolha e entrega da peça.', 'quote', 'pickup', 30, 120, 60, 1),
    ('beleza-bem-estar', 'beleza-domicilio', 'Serviço ao domicílio', 'Corte, manicure ou massagem em casa.', 'hourly', 'on_site', 60, 60, 60, 1)
) as v(category_slug, slug, name, description, pricing_mode, fulfillment_mode, min_labor, max_labor, duration_min, sort_order)
  on c.slug = v.category_slug
on conflict (slug) do nothing;

-- ===== 5. Sintoma genérico em draft por categoria =====
insert into symptoms (
  category_id, slug, label, icon, pricing_mode, diagnostic_catalog_id,
  urgency, safety_level, follow_up_schema, sort_order, active
)
select
  c.id,
  'nao-sei-' || c.slug,
  'Não sei o que preciso',
  '❓',
  'diagnostic',
  sc.id,
  'today',
  'normal',
  '[]'::jsonb,
  99,
  false
from categories c
join service_catalog sc on sc.slug = 'orcamento-' || c.slug
where c.parent_id is null
on conflict (slug) do nothing;
