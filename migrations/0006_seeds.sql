-- Migration 0006: Seeds — Províncias, Distritos, Categorias, Planos, Preços de destaque
-- Bué de Mestres — Fase 0

-- ===== PROVÍNCIAS =====
insert into provinces (id, name) values
  (1,  'Maputo Cidade'),
  (2,  'Maputo Província'),
  (3,  'Gaza'),
  (4,  'Inhambane'),
  (5,  'Sofala'),
  (6,  'Manica'),
  (7,  'Tete'),
  (8,  'Zambézia'),
  (9,  'Nampula'),
  (10, 'Cabo Delgado'),
  (11, 'Niassa');

-- ===== DISTRITOS / CIDADES =====
insert into districts (province_id, name) values
  -- Maputo Cidade
  (1, 'KaMpfumo'),
  (1, 'Nlhamankulu'),
  (1, 'KaMaxakeni'),
  (1, 'KaMavota'),
  (1, 'KaMubukwana'),
  (1, 'KaTembe'),
  (1, 'KaNyaka'),
  -- Maputo Província
  (2, 'Matola'),
  (2, 'Boane'),
  (2, 'Marracuene'),
  -- Sofala
  (5, 'Beira'),
  -- Nampula
  (9, 'Nampula'),
  -- Zambézia
  (8, 'Quelimane'),
  -- Tete
  (7, 'Tete'),
  -- Manica
  (6, 'Chimoio'),
  -- Gaza
  (3, 'Xai-Xai'),
  -- Inhambane
  (4, 'Inhambane'),
  -- Cabo Delgado
  (10, 'Pemba'),
  -- Niassa
  (11, 'Lichinga');

-- ===== CATEGORIAS (pai → filhos) =====

-- Automóvel
insert into categories (slug, name, icon, sort_order) values
  ('automovel', 'Automóvel', '🚗', 10);

insert into categories (parent_id, slug, name, sort_order)
select id, slug_filho, nome_filho, ord from
  (select id from categories where slug='automovel') c,
  (values
    ('mecanico', 'Mecânico', 1),
    ('electricista-auto', 'Electricista Auto', 2),
    ('chapeiro-pintor-auto', 'Chapeiro/Pintor Auto', 3),
    ('pneus-balanceamento', 'Pneus e Balanceamento', 4),
    ('lavagem-auto', 'Lavagem', 5)
  ) as t(slug_filho, nome_filho, ord);

-- Construção e Reparações
insert into categories (slug, name, icon, sort_order) values
  ('construcao-reparacoes', 'Construção e Reparações', '🔨', 20);

insert into categories (parent_id, slug, name, sort_order)
select id, slug_filho, nome_filho, ord from
  (select id from categories where slug='construcao-reparacoes') c,
  (values
    ('pedreiro', 'Pedreiro', 1),
    ('carpinteiro', 'Carpinteiro', 2),
    ('canalizador', 'Canalizador', 3),
    ('electricista', 'Electricista', 4),
    ('pintor', 'Pintor', 5),
    ('serralheiro', 'Serralheiro', 6),
    ('ladrilhador', 'Ladrilhador', 7),
    ('soldador', 'Soldador', 8),
    ('vidraceiro', 'Vidraceiro', 9)
  ) as t(slug_filho, nome_filho, ord);

-- Educação
insert into categories (slug, name, icon, sort_order) values
  ('educacao', 'Educação', '📚', 30);

insert into categories (parent_id, slug, name, sort_order)
select id, slug_filho, nome_filho, ord from
  (select id from categories where slug='educacao') c,
  (values
    ('explicador-matematica', 'Explicador de Matemática', 1),
    ('explicador-fisica', 'Explicador de Física', 2),
    ('explicador-quimica', 'Explicador de Química', 3),
    ('explicador-portugues', 'Explicador de Português', 4),
    ('explicador-ingles', 'Explicador de Inglês', 5),
    ('aulas-musica', 'Aulas de Música', 6),
    ('preparacao-exames', 'Preparação de Exames', 7)
  ) as t(slug_filho, nome_filho, ord);

-- Tecnologia
insert into categories (slug, name, icon, sort_order) values
  ('tecnologia', 'Tecnologia', '💻', 40);

insert into categories (parent_id, slug, name, sort_order)
select id, slug_filho, nome_filho, ord from
  (select id from categories where slug='tecnologia') c,
  (values
    ('tecnico-computadores', 'Técnico de Computadores', 1),
    ('tecnico-telemoveis', 'Técnico de Telemóveis', 2),
    ('redes-cctv', 'Redes e CCTV', 3),
    ('design-web', 'Design e Web', 4)
  ) as t(slug_filho, nome_filho, ord);

-- Casa e Limpeza
insert into categories (slug, name, icon, sort_order) values
  ('casa-limpeza', 'Casa e Limpeza', '🏠', 50);

insert into categories (parent_id, slug, name, sort_order)
select id, slug_filho, nome_filho, ord from
  (select id from categories where slug='casa-limpeza') c,
  (values
    ('limpezas', 'Limpezas', 1),
    ('jardinagem', 'Jardinagem', 2),
    ('mudancas', 'Mudanças', 3),
    ('dedetizacao', 'Dedetização', 4)
  ) as t(slug_filho, nome_filho, ord);

-- Beleza e Bem-estar
insert into categories (slug, name, icon, sort_order) values
  ('beleza-bem-estar', 'Beleza e Bem-estar', '💅', 60);

insert into categories (parent_id, slug, name, sort_order)
select id, slug_filho, nome_filho, ord from
  (select id from categories where slug='beleza-bem-estar') c,
  (values
    ('cabeleireiro', 'Cabeleireiro', 1),
    ('barbeiro', 'Barbeiro', 2),
    ('manicure', 'Manicure', 3),
    ('maquilhagem', 'Maquilhagem', 4),
    ('massagens', 'Massagens', 5)
  ) as t(slug_filho, nome_filho, ord);

-- Eventos
insert into categories (slug, name, icon, sort_order) values
  ('eventos', 'Eventos', '🎉', 70);

insert into categories (parent_id, slug, name, sort_order)
select id, slug_filho, nome_filho, ord from
  (select id from categories where slug='eventos') c,
  (values
    ('fotografia-video', 'Fotografia e Vídeo', 1),
    ('dj-som', 'DJ e Som', 2),
    ('decoracao', 'Decoração', 3),
    ('catering', 'Catering', 4),
    ('bolos', 'Bolos', 5)
  ) as t(slug_filho, nome_filho, ord);

-- Frio e Electrodomésticos
insert into categories (slug, name, icon, sort_order) values
  ('frio-electrodomesticos', 'Frio e Electrodomésticos', '❄️', 80);

insert into categories (parent_id, slug, name, sort_order)
select id, slug_filho, nome_filho, ord from
  (select id from categories where slug='frio-electrodomesticos') c,
  (values
    ('refrigeracao', 'Refrigeração', 1),
    ('reparacao-electrodomesticos', 'Reparação de Electrodomésticos', 2),
    ('paineis-solares', 'Painéis Solares', 3)
  ) as t(slug_filho, nome_filho, ord);

-- Moda
insert into categories (slug, name, icon, sort_order) values
  ('moda', 'Moda', '👗', 90);

insert into categories (parent_id, slug, name, sort_order)
select id, slug_filho, nome_filho, ord from
  (select id from categories where slug='moda') c,
  (values
    ('alfaiate-costureira', 'Alfaiate/Costureira', 1),
    ('sapateiro', 'Sapateiro', 2)
  ) as t(slug_filho, nome_filho, ord);

-- ===== PLANOS =====
insert into plans (code, name, price, duration_days, max_services, max_photos, max_categories, can_quote_unlimited, monthly_quotes, featured_days_included, badge, sort_order) values
  ('free',    'Grátis',  0,     30, 3,  5,  1, false,  5,   0, null,          0),
  ('pro',     'Pro',     500,   30, 10, 20, 3, false, 30,   0, 'PRO',         10),
  ('premium', 'Premium', 1500,  30, 30, 50, 5, true,  null, 3, 'PREMIUM',    20);

-- ===== PREÇOS DE DESTAQUE =====
insert into boost_prices (type, days, price) values
  ('featured',        3,  150),
  ('featured',        7,  300),
  ('featured',       30, 1000),
  ('priority_search', 7,  200),
  ('priority_search', 30, 600);
