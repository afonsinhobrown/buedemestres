-- Executar alter type ... add value de forma isolada
alter type job_status add value if not exists 'requested';
alter type job_status add value if not exists 'accepted';
alter type job_status add value if not exists 'en_route';
alter type job_status add value if not exists 'arrived';
alter type job_status add value if not exists 'price_proposed';
alter type job_status add value if not exists 'awaiting_confirmation';
alter type job_status add value if not exists 'expired';

alter type payment_method add value if not exists 'cash';

alter type tx_type add value if not exists 'job_payout';
alter type tx_type add value if not exists 'job_commission';
alter type tx_type add value if not exists 'withdrawal';
alter type tx_type add value if not exists 'verification_fee';
