-- Complemento da migration 52 (revisão automática de segurança, 2026-11-17).
-- A 52 barra endereços NOVOS fora dos serviços oficiais de push, mas inscrições
-- antigas com qualquer endereço https continuariam recebendo envios do servidor.
-- Aqui: apaga as que não seguem a regra e trava a tabela com CHECK, para que
-- nenhum caminho (função, painel, service role) grave endereço fora da lista.
-- A fila (`push_outbox`) aponta para a notificação e a pessoa, não para a
-- inscrição: o aviso continua no app; só o envio para aquele endereço some.
-- Mesma regra em `isAllowedPushEndpoint` (@mel/core), usada também no despacho.

delete from public.push_subscriptions
 where length(endpoint) > 1000
    or endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/';

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_official
  check (
    length(endpoint) <= 1000
    and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
  );
