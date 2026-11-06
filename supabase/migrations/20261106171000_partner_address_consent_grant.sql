-- MEL — O parceiro grava a própria autorização de endereço público (inscrição).
-- As permissões de businesses são por coluna: sem isto a inscrição com a nova
-- coluna falharia. A VALIDAÇÃO (address_public_verified_*) continua sem permissão
-- para usuários: só admin_set_business_public_address (administrador) a grava.
grant insert (address_public_consent), update (address_public_consent) on public.businesses to authenticated;
