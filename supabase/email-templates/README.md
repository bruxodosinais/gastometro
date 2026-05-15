# E-mails de autenticação (Supabase Auth)

O e-mail de **confirmação de cadastro** é enviado pelo próprio Supabase Auth
(GoTrue) — não passa pelo nosso código Resend. Por isso ele é configurado no
**Supabase Dashboard**, do mesmo jeito que as migrations (arquivo versionado
aqui no repo + aplicação manual no dashboard).

## Como aplicar (`confirm-signup.html`)

Dashboard → **Authentication → Emails → Templates → Confirm signup**

1. **Subject (assunto):**

   ```
   Confirme seu e-mail — TôOrganizado
   ```

2. **Message body:** colar o conteúdo de `confirm-signup.html` (manter a
   variável `{{ .ConfirmationURL }}` exatamente como está).

## Remetente

Dashboard → **Authentication → Emails → SMTP Settings** (ou Project Settings →
Auth, conforme a versão do painel):

- **Sender name:** `TôOrganizado`
- **Sender email:** `noreply@toorganizado.com.br`

Resultado no cliente de e-mail: `TôOrganizado <noreply@toorganizado.com.br>`.

## Por que não está em código

- Não existe `supabase/config.toml` / Supabase CLI neste projeto (ver memória
  do projeto: migrations e config são aplicadas manualmente no dashboard).
- O fluxo de confirmação usa GoTrue diretamente; só um *Send Email Hook*
  customizado moveria isso pro Resend — mudança grande e fora do escopo desta
  correção defensiva.

## Notas de design (P8)

- Layout só com `<table>` + CSS inline (compat Gmail/Outlook — mesma lição do
  relatório semanal, sem flexbox).
- Fundo `#F7F7F5`, card branco `border-radius:16px`, marca em `#5B5BD6`,
  botão `#5B5BD6` com texto branco e `border-radius:8px`.
- O link `/auth/callback` continua sendo o `emailRedirectTo` (allowlist de
  Redirect URLs do Supabase já cobre). Após o clique, o nosso callback
  redireciona para `/auth/confirmado` (página amigável — P1).
