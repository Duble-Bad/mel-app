# Deploy do schema no mel-prod em UM comando (Windows PowerShell).
#
#   .\scripts\prod\mel-prod.ps1            -> só a conferência (pre-flight, somente leitura)
#   .\scripts\prod\mel-prod.ps1 -Deploy    -> conferência + deploy + pós-deploy
#
# Na 1ª vez pergunta a URL do Session pooler (copiada do painel: Connect -> Session pooler, com
# [YOUR-PASSWORD] mesmo) e o caminho do certificado, e guarda em %USERPROFILE%\.mel-prod.json,
# FORA do repositório e SEM a senha. Nas próximas, só pede a senha (digitação mascarada).
# A senha vive só na memória deste processo e é apagada no fim, mesmo com erro.
# Os resultados (sem senha) ficam em %TEMP%\mel-preflight.txt e %TEMP%\mel-postdeploy.txt para conferência.
# O deploy em si continua pedindo as confirmações digitadas do deploy-schema.mjs (de propósito).
param([switch]$Deploy, [switch]$Reconfigurar)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root
$cfgFile = Join-Path $env:USERPROFILE ".mel-prod.json"
$ref = "znjhqvhgwmxqeaeptccj"

if ($Reconfigurar -or -not (Test-Path $cfgFile)) {
  Write-Host "Configuração (só na 1ª vez). Nada disso é segredo; a senha NÃO é guardada." -ForegroundColor Cyan
  $url = (Read-Host "Cole a URL do Session pooler do mel-prod (painel > Connect > Session pooler; pode deixar [YOUR-PASSWORD])").Trim()
  if ($url -notmatch "^postgres(ql)?://postgres\.$ref(:[^@]*)?@[a-z0-9-]+\.pooler\.supabase\.com:5432/postgres$" -and
      $url -notmatch "^postgres(ql)?://postgres(:[^@]*)?@db\.$ref\.supabase\.co:5432/postgres$") {
    throw "URL não reconhecida. Use a do Session pooler (porta 5432) do projeto $ref."
  }
  # Guarda o endereço sem a senha.
  $semSenha = $url -replace "^(postgres(ql)?://[^:@]+)(:[^@]*)?@", '$1:{SENHA}@'
  $ca = (Read-Host "Caminho completo do certificado .crt do mel-prod").Trim().Trim('"')
  if (-not (Test-Path $ca)) { throw "Certificado não encontrado: $ca" }
  @{ url = $semSenha; ca = $ca } | ConvertTo-Json | Set-Content -Encoding utf8 $cfgFile
  Write-Host "Guardado em $cfgFile" -ForegroundColor Green
}

$cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
$sec = Read-Host "Senha do banco do mel-prod" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try {
  $senha = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $env:MEL_PROD_PROJECT_REF = $ref
  $env:MEL_PROD_DB_URL = $cfg.url.Replace("{SENHA}", [uri]::EscapeDataString($senha))
  $env:MEL_PROD_DB_CA_FILE = $cfg.ca
  Remove-Variable senha

  node scripts/prod/preflight.mjs --production --expect-ref=$ref 2>&1 | Tee-Object -FilePath "$env:TEMP\mel-preflight.txt"
  if ($LASTEXITCODE -ne 0) { Write-Host "`nConferência reprovada: nada foi aplicado." -ForegroundColor Red; return }

  if ($Deploy) {
    # Sem pipe: o deploy exige terminal interativo para as confirmações.
    node scripts/prod/deploy-schema.mjs --production --expect-ref=$ref
    $deployExit = $LASTEXITCODE
    node scripts/prod/postdeploy-check.mjs --production --expect-ref=$ref 2>&1 | Tee-Object -FilePath "$env:TEMP\mel-postdeploy.txt"
    if ($deployExit -ne 0) { Write-Host "`nO deploy terminou com erro (código $deployExit)." -ForegroundColor Red }
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Item Env:MEL_PROD_PROJECT_REF, Env:MEL_PROD_DB_URL, Env:MEL_PROD_DB_CA_FILE -ErrorAction SilentlyContinue
}


