# NEON DROP // Blueprint Comercial, Arquitetura Server-Authoritative & Segurança

Este documento define a arquitetura de produção para transformar o **NEON DROP** de um protótipo client-side em um **jogo comercial Free-to-Play (Web, Desktop via Electron/Steam e Mobile PWA)** com economia blindada contra trapaças (F12 / macros / injeção de pacotes) e monetização via **Pix / Stripe**.

---

## 1. Blindagem Jurídica & Modelo de Monetização (Non-Gambling Compliance)

Para operar comercialmente no Brasil (Lei nº 14.790/2023 e Marco Legal dos Jogos Eletrônicos — Lei nº 14.852/2024) e globalmente (Steam, Google Play, Stripe), o jogo deve ser classificado como **Jogo Eletrônico de Coleção & Habilidade (Idle / Aim Lab)** e **NUNCA** como cassino/aposta:

1. **Economia Fechada (Closed-Loop Economy):**
   - O saldo em `$` do jogo e as skins **não possuem saque em dinheiro real (Cash-Out)** e não podem ser vendidos para terceiros fora do jogo.
   - **Proibição de venda direta de chaves/caixas por dinheiro real** (opcional para evitar classificação de Loot Box paga em países restritos): Em vez de vender sorteios diretos, a loja vende:
     - 🎖️ **Passe de Batalha Tático (Temporadas de 60 dias):** Desbloqueia trilhas de recompensas garantidas ao subir XP Militar e cumprir missões no Gridshot.
     - ⚡ **Status Operador VIP (Assinatura 30 dias):** `+25% XP Militar`, limite de ganhos offline estendido de `12h` para `24h`, insígnia VIP dourada no Ranking Global e skins de mira exclusivas para o Treino 2D (Aim Lab).
     - 🎨 **Cosméticos de Perfil & Estande:** Banners animados no Ranking Global, efeitos sonoros de abate no Gridshot e temas de mira.
2. **Transparência de Probabilidades (Odds Disclosure):**
   - Já implementado na interface (`Padrão 75%`, `Tático 16%`, `Protótipo 5.5%`, `Relíquia 2.5%`, `★ Apex Mítico 1.0%`), cumprindo a exigência de transparência da Apple, Google e Steam.

---

## 2. Arquitetura Server-Authoritative (Zero-Trust Client)

No protótipo estático, o navegador executava `Math.random()` e alterava `state.balance` no `localStorage`. Na arquitetura comercial com **Supabase (PostgreSQL + RLS + Edge Functions)**:

```
[Navegador / Cliente (UI + Aim Lab 60fps)]
       │
       │  1. JWT Autenticado (Anon Auth -> Google/Discord OAuth)
       ▼
[Supabase API Gateway + Row-Level Security (RLS)]
       │  (Cliente tem PERMISSÃO ZERO de fazer UPDATE direto em 'profiles' ou 'inventory_items')
       ▼
[PostgreSQL SECURITY DEFINER RPCs (Transações Atômicas)]
  ├── sync_lazy_idle_income()        -> Calcula (now() - last_claimed_at) * passive_rate
  ├── open_case_rpc(case_id, count)  -> Sorteia no servidor (CSPRNG), debita saldo e insere itens
  ├── execute_tradeup_rpc(item_ids)  -> Valida 5 itens da mesma raridade, consome e forja 1 superior
  ├── start_gridshot_rpc()           -> Cria sessão assinada de 30s no banco
  ├── submit_gridshot_rpc(...)       -> Valida duração >= 28s, teto humano de CPS e paga Rank S/A/B
  └── register_unique_callsign_rpc() -> Garante unicidade CITEXT no banco e trava o nome
```

### Regra de Ouro do Banco de Dados (RLS):
- O cliente pode fazer `SELECT` no próprio perfil (`auth.uid() = id`) e `SELECT` na view pública do Ranking (`leaderboard_global_view`).
- **Nenhuma tabela aceita `INSERT`, `UPDATE` ou `DELETE` vindo diretamente do cliente.** Toda alteração de saldo, inventário, prestígio ou pontuação ocorre exclusivamente dentro das **Stored Procedures (`SECURITY DEFINER`)** no PostgreSQL.

---

## 3. Engenharia da Renda Passiva sem Sobrecarga (Lazy Timestamp Pattern)

Gravar no banco de dados 4 vezes por segundo para cada jogador online inviabilizaria o servidor. A solução comercial padrão da indústria funciona assim:

1. **No Servidor (`profiles`):**
   - Guarda `balance` (saldo consolidado), `passive_rate_per_sec` (recalculado automaticamente pelo servidor sempre que uma skin entra ou sai do inventário) e `last_claimed_at` (timestamp UTC).
2. **No Cliente (Visual 60fps):**
   - A interface soma `passive_rate_per_sec * delta_t` apenas visualmente na tela para manter a sensação fluida do jogo.
3. **Sincronização Sob Demanda (`sync_lazy_idle_income`):**
   - Sempre que o jogador chama qualquer ação que gasta ou altera saldo (`open_case_rpc`, `prestige_up_rpc`, etc.), a primeira linha da transação no PostgreSQL calcula:
     ```sql
     elapsed_sec := LEAST(43200, EXTRACT(EPOCH FROM (now() - last_claimed_at))); -- Teto de 12h (ou 24h VIP)
     earned := ROUND((elapsed_sec * passive_rate_per_sec)::numeric, 2);
     ```
   - Isso garante **precisão matemática absoluta**, **zero trapaça de relógio do Windows** (pois usa o `now()` do servidor PostgreSQL) e **custo quase zero de banco de dados**.

---

## 4. Anti-Cheat do Campo de Treino 2D (Gridshot 30s)

Como a mira 2D roda a 60fps no cliente para ter latência zero no mouse, protegemos a economia e o Ranking Global com **Validação em Duas Etapas**:

1. **`start_gridshot_rpc()` (Início da Rodada):**
   - Verifica se o jogador não está em Cooldown (`next_gridshot_allowed_at > now()`).
   - Cria um registro em `gridshot_sessions` com `id` único (UUID) e `started_at = now()`.
2. **`submit_gridshot_rpc(session_id, score, hits, shots, equipped_uid)` (Fim da Rodada):**
   - **Validação de Tempo Real:** Verifica no servidor se `now() - started_at` está entre **28 segundos e 40 segundos** (impede scripts que enviam o resultado instantaneamente em `0.1s`).
   - **Teto Biológico / Anti-Macro:**
     - Limite máximo físico de abates em 30s: **`hits <= 135`** (4.5 alvos/s sustentados por 30s).
     - Limite máximo de pontuação matemática: **`score <= hits * 150 * 2.0`**.
     - Se exceder os limites físicos humanos, a sessão é marcada como `flagged_cheat = true` e rejeitada.
   - **Uso Único & Cooldown:** Marca a sessão como `completed = true` (impede *replay attack* do mesmo pacote) e grava `next_gridshot_allowed_at = now() + interval '15 seconds'` no perfil do jogador.

---

## 5. Autenticação Sem Fricção & Pagamentos (Pix / Stripe)

### Fluxo de Identidade (Onboarding 0-Fricção)
1. **1º Acesso (`signInAnonymously`):** O jogador entra no jogo e recebe instantaneamente um `UUID` autenticado via JWT do Supabase sem ver nenhuma tela de cadastro.
2. **Upgrade de Conta (`linkIdentity` — Discord / Google / E-mail):**
   - Exigido quando o jogador clica em **`🔒 Registrar Callsign no Ranking Global`** ou **`💎 Comprar Passe / VIP`**.
   - Mantém o mesmo `UUID` e todo o inventário conquistado.

### Fluxo de Pagamento Seguro (Webhook Assinado)
1. O jogador clica em comprar **VIP / Passe de Batalha** -> Uma Supabase Edge Function cria o Checkout no **Stripe** ou **Mercado Pago / AbacatePay (Pix QR Code)** passando `metadata: { user_id: auth.uid(), product_id: 'vip_30d' }`.
2. Quando o Pix ou Cartão é pago, o gateway envia um POST para a Edge Function de Webhook.
3. A Edge Function valida a assinatura criptográfica (`Stripe-Signature` / `HMAC-SHA256`), insere o `external_tx_id` na tabela `payment_ledger` (garantindo que o mesmo pagamento nunca seja creditado duas vezes) e ativa o benefício na tabela `profiles`.

---

## 6. Status da Implementação (11/11/2026)

### O que já está no código

| Item do blueprint | Onde está | Situação |
| --- | --- | --- |
| §2 Economia no servidor: `open_case_rpc`, `execute_tradeup_rpc`, `prestige_up_rpc`, `register_unique_callsign_rpc`, `sync_lazy_idle_income`, mais `get_my_state_rpc`, `sell_items_rpc`, `sell_duplicates_rpc`, `set_heirloom_rpc`, `reset_progress_rpc` | `supabase/schema.sql` | Implementado. Sorteio (raridade, skin, float, SyncTrack), preço, XP, saldo e estatísticas são calculados só no PostgreSQL. |
| §2 RLS + `leaderboard_global_view` | `supabase/schema.sql` | Implementado. O cliente lê só o próprio perfil/inventário; nenhuma tabela aceita escrita; a view é somente leitura e não expõe saldo. |
| §3 Renda passiva por lazy timestamp (teto 12h, VIP 24h) | `sync_lazy_idle_income` | Implementado. O navegador só projeta o saldo na tela entre uma ação e outra. |
| §4 Anti-cheat do Gridshot | `start_gridshot_rpc` / `submit_gridshot_rpc` | Implementado. A recompensa, o XP e o recorde só existem se o servidor aceitar a rodada. |
| §5 `signInAnonymously` no 1º acesso | `backend-adapter.js` | Implementado (conta anônima via REST, sessão renovada automaticamente). |
| §1 VIP: +25% XP, offline 24h, selo no ranking | `schema.sql` + `app.js` | Efeitos implementados. A ativação é por `grant_vip_days_admin` (só `service_role`). |
| §5 Webhook de pagamento | `supabase/functions/payment-webhook` | Modelo genérico (HMAC) pronto, **não publicado**: depende da escolha do gateway. |

O cliente (`app.js`) funciona em dois modos. Se `get_my_state_rpc` responde, o servidor é a autoridade e o navegador só pede ações e desenha a resposta. Só quando o banco responde que não tem o schema novo (`get_my_state_rpc` inexistente) o jogo segue no modo local antigo, sem enviar nada ao ranking. Qualquer outra falha na abertura (sem conexão, cadastro anônimo recusado ou limitado, erro do servidor) mostra uma tela de "tentar novamente" em vez de abrir um jogo local, e um navegador que já jogou no modo servidor nunca volta para o modo local. Toda requisição ao Supabase tem prazo de 15 s. Com o Supabase configurado, o ranking nunca é lido do tópico público do ntfy.sh.

### Decisões que diferem do texto original

- **Contrato de Troca:** o item forjado sai da caixa de um dos 5 itens usados (sorteada entre eles), não da "caixa ativa" na tela. Do contrário, 5 itens baratos virariam um item da caixa mais cara.
- **Cooldown do Gridshot:** 12s no servidor e 15s no cliente, para a latência não transformar um clique legítimo em erro.
- **Teto de pontuação:** `score <= ((hits - crits) * 100 + crits * 150) * 2.0`, com `crits` enviado pelo cliente e limitado a `hits`. É mais apertado que `hits * 150 * 2.0`.
- **`linkIdentity` não é exigido para registrar o Callsign:** o Callsign fica preso à conta anônima. O vínculo com Discord/Google/E-mail ainda não existe (ver pendências).
- **Importação do save antigo:** por 7 dias a partir da primeira execução do schema, uma conta de servidor zerada pode importar uma única vez o save do `localStorage`. Preços são recalculados pelo catálogo do servidor e os números são limitados (saldo até $1 bilhão, Prestígio até X), mas o conteúdo do save é confiado. Para fechar a janela antes:
  `UPDATE public.app_settings SET value = now()::text WHERE key = 'legacy_import_until';`

### Catálogo e testes

- O catálogo (18 caixas, 252 skins, preços base) é gerado a partir do `app.js`: rode `node tools/build-catalog-sql.mjs` e reaplique o `schema.sql` sempre que mexer nas caixas ou nas raridades.
- `tools/tests/` roda o schema real em PGlite e o jogo real em Chromium headless, sem tocar no projeto de produção (`cd tools/tests && npm install && npx playwright install chromium-headless-shell && npm test`). Qualquer mudança de fórmula no `app.js` precisa do espelho no `schema.sql`; os testes de paridade acusam a diferença.

### Pendências (dependem de contas ou decisões externas)

1. **Ativar no Supabase:** ligar "Allow anonymous sign-ins" e executar `supabase/schema.sql` no SQL Editor.
2. **Pagamentos:** escolher o gateway (Stripe, Mercado Pago ou AbacatePay), criar a Edge Function de checkout e publicar o webhook com as chaves do gateway.
3. **Upgrade de conta (`linkIdentity`):** configurar os provedores OAuth no painel e criar a tela de vínculo. Até lá, limpar os dados do navegador perde o acesso à conta anônima.
4. **Passe de Batalha e cosméticos (§1):** falta o desenho do conteúdo (trilhas, recompensas, preços).
5. **Validação jurídica do §1** com um advogado antes de cobrar.
6. **Proteção contra abuso de cadastro anônimo:** ligar CAPTCHA/limites no Auth do Supabase antes de divulgar o jogo.
