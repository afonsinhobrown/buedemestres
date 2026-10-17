-- 0218: permitir leitura dos termos atuais antes do login (no ecrã de registo).
create policy "terms_versions_select_anon" on terms_versions for select to anon using (is_current);
