-- Migration 0001: Extensões e Enums
-- Bué de Mestres — Fase 0

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

create type user_role           as enum ('client','provider','admin');
create type verification_status as enum ('none','pending','approved','rejected');
create type doc_type            as enum ('bi','passaporte','carta_conducao','dire');
create type request_status      as enum ('open','in_negotiation','accepted','in_progress','completed','cancelled','expired');
create type quote_status        as enum ('sent','accepted','rejected','withdrawn');
create type job_status          as enum ('scheduled','in_progress','completed','cancelled','disputed');
create type price_type          as enum ('fixed','hourly','from','quote');
create type tx_type             as enum ('topup','plan_purchase','boost_purchase','bonus','commission_payout','refund','adjustment');
create type tx_status           as enum ('pending','completed','failed','reversed');
create type payment_method      as enum ('mpesa','emola','bank_transfer','manual');
create type payment_status      as enum ('pending','completed','failed','expired');
create type boost_type          as enum ('featured','priority_search');
create type sub_status          as enum ('active','expired','cancelled');
create type report_status       as enum ('open','reviewing','resolved','dismissed');
create type report_target       as enum ('provider','review','message','request');
create type commission_status   as enum ('pending','paid');
