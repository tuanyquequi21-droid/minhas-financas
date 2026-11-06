# Minhas Finanças

Aplicação web de controle financeiro pessoal com Supabase.

## Configuração

O arquivo `config.js` fornece a URL do projeto Supabase e a chave pública (anon/publishable). Ele é carregado antes de `app.js`.

- Nunca use a chave `service_role` ou uma secret key no navegador.
- As tabelas financeiras precisam manter RLS habilitado e políticas por usuário autenticado.
- Para ajustar a configuração em outra instalação, copie `config.exemplo.js` para `config.js` e preencha os dados públicos do projeto.

## Demonstração

Abra `index.html?demo=1` para testar com dados fictícios mantidos somente na memória do navegador. A demonstração não grava no Supabase.

## Testes

Com Node.js 22 ou superior, execute:

```bash
node --test tests/*.test.js
```
