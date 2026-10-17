-- 0205: estado explícito para tentativas de pagamento que o cliente cancelou
-- ou que o provedor recusou. Sem isto, a linha ficava em 'pending_payment'
-- para sempre e o ecrã do mestre continuava a mostrar "a processar".
alter type escrow_status add value if not exists 'failed';
