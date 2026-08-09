# Remover referência a hero-community.jpg (asset inexistente)

## Why

A auditoria `streamline-app` encontrou `heroImageSrc="/hero-community.jpg"`
passado para `<PortalBackground>` em 5 telas públicas, mas
`public/hero-community.jpg` não existe no repositório. Como é usado como
`background-image` via CSS (não `<img>`), o navegador não mostra ícone de
imagem quebrada — mas é uma referência morta a um asset que nunca foi
adicionado, com um comentário ("Substitua pela imagem final do mock") que
confirma que era um placeholder esquecido.

## What Changes

- Remover a prop `heroImageSrc="/hero-community.jpg"` (mantendo `heroHeight`)
  em: `login/page.tsx`, `acesso-interno/page.tsx`, `agenda/page.tsx`,
  `conta/page.tsx`, `cadastro/completar/page.tsx` (2 ocorrências).
- Remover os comentários "Substitua .../hero-community.jpg..." associados.
- `/conta`: confirmado que nenhum link no app aponta para essa rota hoje —
  decisão do usuário de "remover o link" já está satisfeita, nada a fazer
  além disso. A rota continua existindo.

## Impact

- Sem mudança visual perceptível (o asset nunca carregava). `PortalBackground`
  já trata `heroImageSrc` como opcional.
- Nenhuma rota removida, nenhuma mudança de comportamento.
