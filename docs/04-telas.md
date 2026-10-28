# MEL — Mapa de telas (rotas)

Legenda: 🌐 pública/indexável · 👤 requer login · 👻 permite sessão anônima · 🛡️ admin

## Público
| Rota | Tela | |
|---|---|---|
| `/` | Home: 4 ações, alertas próximos, mapa resumo, CTA Guardião | 🌐 |
| `/mapa` | Radar/mapa com filtros (tipo, espécie, período, raio) + lista alternativa | 🌐 |
| `/perdidos` | Lista de alertas ativos próximos (paginada) | 🌐 |
| `/encontrados` | Lista de animais encontrados | 🌐 |
| `/alerta/[code]` | **Página do Alerta MEL** (OG, QR, timeline, mapa, ações) | 🌐 (`noindex` se tutor não autorizar) |
| `/alerta/[code]/cartaz` | Gerador de cartaz (formatos, prévia, baixar/imprimir) | 🌐 |
| `/encontrado/[code]` | Página do animal encontrado | 🌐 |
| `/pet/[melId]` | Página pública do pet (MEL ID) | 🌐 se `is_public` |
| `/adocao` | MEL Adota — lista com filtros | 🌐 |
| `/adocao/[id]` | Página do animal para adoção | 🌐 |
| `/parceiros` | Diretório + mapa de parceiros | 🌐 |
| `/parceiros/[slug]` | Perfil do parceiro | 🌐 |
| `/ongs/[slug]` | Perfil de ONG | 🌐 |
| `/historias` | Reencontros (Fase 2 — não exibido no MVP) | — |
| `/sobre`, `/privacidade`, `/termos`, `/seguranca` (dicas antigolpe) | Institucional | 🌐 |

## Publicar
| Rota | | |
|---|---|---|
| `/publicar` | Sheet: Perdi · Encontrei · Avistamento · Adoção | — |
| `/publicar/perdido` | Wizard 6 passos (rascunho salvo automaticamente) | 👤 (login rápido no passo 1) |
| `/publicar/encontrado` | Wizard rápido | 👻 |
| `/avistamento/[code]` | Avistamento ligado a um alerta | 👻 |
| `/avistamento/novo` | Avistamento solto (sem alerta) | 👻 |
| `/publicar/adocao` | Cadastro de animal para adoção | 👤 |
| `/alerta/[code]/reencontro` | Marcar como encontrado | 👤 dono |
| `/alerta/[code]/editar` | Editar alerta | 👤 dono |

## Conta
| Rota | | |
|---|---|---|
| `/entrar` | E-mail (magic link/senha), Google | — |
| `/onboarding` | Nome, cidade/UF, foto opcional (1 tela) | 👤 |
| `/perfil` | Meus pets, meus alertas, minhas publicações | 👤 |
| `/perfil/pets/novo`, `/perfil/pets/[id]` | Cadastro/edição de pet (+ campos privados) | 👤 |
| `/perfil/correspondencias` | Possíveis correspondências (Radar) | 👤 |
| `/perfil/adocao` | Meus anúncios e interesses recebidos/enviados | 👤 |
| `/perfil/privacidade` | Exportar dados, excluir conta, consentimentos | 👤 |
| `/guardiao` | Ativar Guardião, raio, tipos, limites | 👤 |
| `/notificacoes` | Central de notificações | 👤/👻 |
| `/conversas`, `/conversas/[id]` | Chat | 👤/👻 |

## Empresa / ONG
| Rota | | |
|---|---|---|
| `/empresa` | Painel do parceiro (perfil, endereços, ofertas) | 👤 |
| `/empresa/novo` | Cadastro (vai para aprovação) | 👤 |
| `/empresa/metricas` | Métricas reais por `events` (Fase 2) | — |
| `/ong` | Painel ONG (Fase 2 — verificação manual) | — |

## Admin 🛡️
`/admin` (dashboard com contagens reais) · `/admin/denuncias` · `/admin/conteudo` (pendentes) · `/admin/usuarios` · `/admin/empresas` · `/admin/planos` · `/admin/auditoria`

## Navegação mobile (bottom bar)
`Início` · `Mapa` · **`Publicar` (botão central destacado)** · `Adoção` · `Perfil`
