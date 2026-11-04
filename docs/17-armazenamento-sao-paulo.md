# 17 — Armazenamento do backup em São Paulo (2L)

Decisões do proprietário (04/11/2026): backups **fisicamente em São Paulo**; Amazon S3
descartado; custo zero ou muito baixo e previsível; nada contratado sem aprovação.
Isso **substitui o Backblaze B2** (docs 15 e 16): o B2 não tem região no Brasil.

Fontes oficiais consultadas em 04/11/2026. "Não verificado" = não confirmado em página oficial.
Volume considerado: 1–10 GB, poucos milhares de objetos, ~6 mil gravações/mês, uma
listagem por dia e uma leitura completa por mês (conferência mensal).

## Comparação

| Provedor (região) | Evidência de São Paulo | Custo/mês 1 · 5 · 10 GB | Grátis | Cartão | Teto de gasto | Proteção contra exclusão | Chave mínima | rclone |
|---|---|---|---|---|---|---|---|---|
| **Oracle OCI** (`sa-saopaulo-1`) | "Brazil East (Sao Paulo) \| sa-saopaulo-1 \| Sao Paulo, Brazil" (docs.oracle.com, Regions) | **US$ 0 · 0 · 0** | Always Free: 20 GB de Object Storage (10 GB Standard em conta paga) + 50 mil requisições/mês, sem prazo | sim (não cobra sem upgrade) | não: orçamento só alerta | regras de retenção (bloqueáveis); não combinam com versões | política por bucket; **criar sem apagar** possível (`OBJECT_DELETE` separado) | `oracleobjectstorage` ou API compatível S3 |
| **Magalu Cloud** (`br-se1`) | "São Paulo (Brasil - Sudeste): SE1" (docs.magalu.cloud, arquitetura); a página de preços só diz "Sudeste" | **R$ 0,20 · 1,00 · 2,00** (armazenamento R$ 0,10/GiB + 1 download completo R$ 0,10/GiB; impostos inclusos) | R$ 100 em créditos (2 × R$ 50, expiram no mês) | sim (validação até R$ 9,99) | não verificado | versões + Object Lock (compliance) | chaves "só ler / só criar / ambos" (se "só criar" impede apagar: não verificado) | s3 `Magalu` |
| Azure Blob (Brazil South) | "Sao Paulo State" — **só o estado**, não a cidade | US$ 0,08 · 0,21 · 0,38 (Hot LRS; saída grátis até 100 GB) | US$ 200 por 30 dias | sim (só crédito no Brasil) | não no pay-as-you-go | não verificado | não verificado | `azureblob` |
| Google Cloud Storage (`southamerica-east1`) | "SOUTHAMERICA-EAST1 \| São Paulo" | US$ 0,19 · 0,81 · 1,59 (saída US$ 0,12/GiB) | franquia grátis **só nos EUA** | sim | não (só alerta) | soft delete 7 dias (cobrado) | IAM por bucket (não verificado) | `googlecloudstorage` |
| Akamai/Linode (`br-gru-1`) | "Sao Paulo, BR (br-gru-1)" — endpoint legado | US$ 5 fixo | US$ 100 / 60 dias (promoção) | sim | não | versões + Object Lock (só pela API) | por bucket, sem "escrever sem apagar" | s3 `Linode` |
| Tencent COS (`sa-saopaulo`) | endpoint `cos.sa-saopaulo` | não verificado | 50 GB por 6 meses (novos usuários) | não verificado | — | — | — | s3 `TencentCOS` |
| Huawei OBS (`sa-brazil-1`) | endpoint `obs.sa-brazil-1` | não verificado (saída US$ 0,135/GB) | não verificado | não verificado | — | — | — | s3 `HuaweiOBS` |
| ~~Cloudflare R2~~ | **sem garantia**: dicas de localização sem América do Sul, "best effort and not a guarantee"; jurisdições só UE/EUA | — | — | — | — | — | — | — |
| ~~Vultr~~ | lista oficial de clusters de Object Storage **sem São Paulo** | — | — | — | — | — | — | — |

## Recomendação: Oracle Cloud (OCI), região São Paulo

- **Custo zero** no volume da MEL (até 10 GB Standard e 50 mil requisições/mês), sem prazo.
- **São Paulo, cidade,** na documentação oficial.
- **Única opção com chave que grava sem poder apagar**, pelo painel de políticas: o passo do
  backup diário usa um usuário só com criar/ler/listar; a retenção usa outro, com apagar,
  e cada passo do workflow só recebe o seu segredo.

**Condições e riscos (decidir antes):**
1. **Cartão** obrigatório no cadastro (não cobra sem upgrade). Sem **teto rígido** de
   gasto: configurar orçamento com alerta em US$ 0,01.
2. A **home region** é escolhida no cadastro e é **definitiva**: tem de ser **Brazil East
   (Sao Paulo)**. Se o painel não oferecer São Paulo como home region, **pare**.
3. Ao fim do trial de 30 dias, objetos acima de 20 GB são apagados se não houver upgrade
   (a MEL fica muito abaixo, mas o teto existe).
4. Saída grátis para a internet na América do Sul: **não verificada** (a leitura mensal
   de até 10 GB custaria, no pior caso, centavos).
5. Painel da Oracle é mais complexo que o do B2: o guia (doc 16) precisa ser refeito para a
   OCI antes da configuração.
6. Antes de dados reais: rodar o ensaio sintético **contra o bucket real da OCI** (mesmo
   código, só muda o destino do rclone), para provar o acesso e as permissões.

**Alternativa: Magalu Cloud (`br-se1`)**, se a Oracle for recusada: empresa brasileira,
cobrança em reais com impostos, ~R$ 2/mês a 10 GB, Object Lock. Pendentes: preço de
requisições, teto de gasto e se a chave "só criar" impede apagar.

Azure fica fora do critério "cidade de São Paulo" (a Microsoft informa só o estado).

## Plano temporário, só se nenhuma opção for aprovada

Backup local cifrado no computador do proprietário: rodar `backup.sh` manualmente com
`BACKUP_REPO` numa pasta local (mesmo formato, cifrado com age) e copiar a pasta para um
disco externo guardado desligado.

**Não é equivalente a backup externo automatizado:** depende de alguém lembrar de rodar
(sem agendamento nem alerta); exige Docker e as credenciais do banco no computador do
proprietário (mais exposição); o disco pode ser perdido, roubado ou queimar junto com o
computador; e sem restauração testada periodicamente não há garantia.
