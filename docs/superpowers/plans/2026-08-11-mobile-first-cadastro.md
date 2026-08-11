# Mobile-first no fluxo de cadastro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar instalável (PWA) e mobile-first as telas realmente usadas no celular — cadastro rápido, lista/criação de cadastros, e o link público de complementação — sem tocar em admin/relatórios.

**Architecture:** Mudança puramente de apresentação (Tailwind classes, marcação, um `manifest.json` novo e metadata do Next.js). Nenhuma lógica de negócio, chamada a Supabase, schema ou API muda.

**Tech Stack:** Next.js 14.2 (App Router, metadata API), Tailwind CSS, ImageMagick (`convert`, já disponível no ambiente) para gerar os ícones PNG.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-mobile-first-cadastro-design.md` — leia se algo abaixo não estiver claro.
- Não existe suíte de testes automatizada neste projeto. Verificação é `npm run build` + `npm run lint`, e checagem manual redimensionando o navegador (ou DevTools "device toolbar") para 375px/390px/414px de largura.
- Build/lint precisam do Node 20, não o Node do sistema (v12, incompatível): prefixe comandos com `export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH" &&`.
- Se `npm run build` falhar de um jeito que parece flakiness do ambiente (páginas diferentes falhando a cada rodada, erro referenciando internals do bundler em vez do seu código) — rode de novo uma ou duas vezes antes de concluir que é um bug real.
- Cor de marca usada nos ícones/tema: `#35638C` (equivalente a `rgb(var(--brand-600))` = `rgb(53 99 140)`, já usada em toda a UI).
- Não criar testes automatizados novos — este projeto não tem suíte, e não é escopo desta mudança introduzir uma.

---

### Task 1: PWA instalável — manifest, ícones e metadata

**Files:**
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/apple-touch-icon.png`
- Create: `public/manifest.json`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `public/manifest.json` referenciado por `src/app/layout.tsx`'s `metadata.manifest`; ícones referenciados tanto pelo manifest quanto por `metadata.icons`.

- [ ] **Step 1: Gerar os três ícones com ImageMagick**

Run:
```bash
mkdir -p public/icons
convert -size 512x512 xc:"#35638C" -gravity center -pointsize 220 -fill white -annotate 0 "CM" public/icons/icon-512.png
convert public/icons/icon-512.png -resize 192x192 public/icons/icon-192.png
convert public/icons/icon-512.png -resize 180x180 public/icons/apple-touch-icon.png
```
Expected: três arquivos PNG criados em `public/icons/`. Confirme com `file public/icons/*.png` — cada um deve reportar `PNG image data` com as dimensões corretas (512x512, 192x192, 180x180).

- [ ] **Step 2: Criar o manifest**

Create `public/manifest.json`:
```json
{
  "name": "Casados com a Madureira",
  "short_name": "CCM",
  "start_url": "/acesso-interno",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#35638C",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: Ligar o manifest e o theme-color no layout raiz**

Current `src/app/layout.tsx`:
```typescript
import "@/app/globals.css";
import { ReactNode } from "react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata = {
  title: "Casados com a Madureira",
  description:
    "SaaS para gestão de integração, batismo e voluntariado da comunidade Casados com a Madureira."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-surface text-text">{children}</body>
    </html>
  );
}
```

Replace with:
```typescript
import "@/app/globals.css";
import { ReactNode } from "react";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Casados com a Madureira",
  description:
    "SaaS para gestão de integração, batismo e voluntariado da comunidade Casados com a Madureira.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#35638C"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-surface text-text">{children}</body>
    </html>
  );
}
```

`themeColor` vive num export `viewport` separado (não dentro de `metadata`) porque o Next.js 14 move esse campo pra lá — colocá-lo em `metadata` gera um warning de build em versões 14.x.

- [ ] **Step 4: Build e checagem do manifest**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
rm -rf .next
npm run build
```
Expected: build passa sem novos warnings/erros (em particular, nenhum warning sobre `themeColor` em `metadata`).

Depois, rode `npm run dev` (ou sirva o build) e abra qualquer página no navegador com DevTools → Application → Manifest: confirme que "Casados com a Madureira" aparece, os dois ícones (192/512) carregam sem erro, e `theme_color`/`background_color` batem com o JSON. Pare o servidor dev depois de conferir.

- [ ] **Step 5: Commit**

```bash
git add public/icons public/manifest.json src/app/layout.tsx
git commit -m "Add PWA manifest and icons so the app is installable on mobile"
```

---

### Task 2: Alvos de toque e teclado correto em `/cadastro/completar`

**Files:**
- Modify: `src/app/(public)/cadastro/completar/page.tsx`

**Interfaces:** nenhuma — só marcação/classes dentro do mesmo componente, sem mudança de props ou lógica.

- [ ] **Step 1: Confirmar as ocorrências antes de editar**

Run: `grep -n "px-3 py-2\|px-4 py-2" "src/app/(public)/cadastro/completar/page.tsx"`
Expected: 10 ocorrências de `px-3 py-2` no total — mas só 7 delas (linhas 187, 199, 210, 222, 233, 244, 256) são os campos de input/textarea, todas com a classe completa idêntica `"w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"`. As outras 3 (linhas 150, 273, 278) são as faixas de erro/sucesso ("Link inválido", mensagens de erro/sucesso do formulário) — **não mexa nelas**, ficam fora do escopo. Separadamente, uma ocorrência de `px-4 py-2` na linha 265 é o botão de submit — essa sim precisa mudar. Se os números de linha tiverem mudado, use o texto das classes (não os números) para localizar os trechos certos.

- [ ] **Step 2: Aumentar o alvo de toque dos 7 campos**

Use `replace_all` na string completa (não só `px-3 py-2`, para não afetar as faixas de erro/sucesso que compartilham esse padrão de padding):

Old string (aparece 7 vezes, uma por campo — CPF, RG, Foto URL, Data de nascimento, E-mail, Endereço, Observações):
```
"w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
```

New string:
```
"w-full rounded-lg border border-border px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
```

- [ ] **Step 3: Aumentar o alvo de toque do botão de submit**

Current (linha ~265):
```typescript
                      className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
```

Replace with:
```typescript
                      className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
```

- [ ] **Step 4: Adicionar `inputMode`/`autoComplete` nos campos que se beneficiam**

No campo CPF (linha ~182-189 antes da Step 2):
```typescript
                    <input
                      required
                      name="cpf"
                      value={cpf}
                      onChange={(event) => setCpf(formatCpfInput(event.target.value))}
                      inputMode="numeric"
                      autoComplete="off"
                      className="w-full rounded-lg border border-border px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                      placeholder="000.000.000-00"
                    />
```

No campo E-mail:
```typescript
                    <input
                      name="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      className="w-full rounded-lg border border-border px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                      placeholder="voce@email.com"
                    />
```

No campo Endereço:
```typescript
                    <input
                      name="endereco"
                      value={endereco}
                      onChange={(event) => setEndereco(event.target.value)}
                      autoComplete="street-address"
                      className="w-full rounded-lg border border-border px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                      placeholder="Rua, número, complemento"
                    />
```

- [ ] **Step 5: Build e lint**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
npm run build
npm run lint
```
Expected: ambos passam sem erros novos.

- [ ] **Step 6: Checagem manual em largura de celular**

Abra `npm run dev`, acesse `/cadastro/completar?token=qualquer-coisa` (vai cair no estado "Link inválido" sem um token real — tudo bem, o objetivo aqui é só visual/layout, não o fluxo funcional) e, com o DevTools em modo responsivo a 375px de largura, confirme visualmente que os campos e o botão ocupam altura maior que antes. Se quiser conferir o formulário preenchido de verdade, gere um token real seguindo o fluxo existente de "Gerar link completo" em `/cadastros` (não é obrigatório para este passo).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(public)/cadastro/completar/page.tsx"
git commit -m "Increase touch targets and set inputMode/autoComplete on the public completion form"
```

---

### Task 3: Reorganizar a barra de ações em `/cadastros` (ações secundárias colapsadas no mobile)

**Files:**
- Modify: `src/app/(app)/cadastros/page.tsx`

**Interfaces:**
- Consumes: nenhum novo. Usa o mesmo `toolbarButtonClass` já definido no topo do arquivo (`src/app/(app)/cadastros/page.tsx:23`).
- Produces: novo estado local `showMoreActions: boolean` — não é consumido por nenhum outro arquivo.

- [ ] **Step 1: Adicionar o estado do menu "Mais ações"**

Find (já existe, logo abaixo do `showGroupAdd` adicionado anteriormente):
```typescript
  const [showGroupAdd, setShowGroupAdd] = useState(false);
```

Replace with:
```typescript
  const [showGroupAdd, setShowGroupAdd] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
```

- [ ] **Step 2: Reestruturar a barra de botões**

Current block (dentro do `return`, dentro da `div` de cabeçalho):
```typescript
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            onClick={openCreate}
            className={`${toolbarButtonClass} bg-brand-600 text-white hover:bg-brand-700`}
          >
            {isCadastradorOnly ? "Novo cadastro rápido (Cadastrador)" : "Novo cadastro completo"}
          </button>
          <button
            onClick={() => setShowGroupAdd(true)}
            className={`${toolbarButtonClass} border border-emerald-300 text-emerald-900 hover:bg-emerald-50`}
          >
            Adicionar do grupo
          </button>
          <button
            onClick={handleExport}
            className={`${toolbarButtonClass} border border-brand-300 text-brand-900 hover:bg-brand-50`}
          >
            Exportar CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`${toolbarButtonClass} border border-dashed border-brand-300 text-brand-900 hover:bg-brand-50`}
          >
            Importar CSV/XLSX
          </button>
          <Link
            href="/cadastros_import_modelo.csv"
            className={`${toolbarButtonClass} block text-center border border-brand-200 text-brand-900 hover:bg-brand-50`}
          >
            Baixar modelo CSV
          </Link>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
```

Replace with:
```typescript
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            onClick={openCreate}
            className={`${toolbarButtonClass} bg-brand-600 text-white hover:bg-brand-700`}
          >
            {isCadastradorOnly ? "Novo cadastro rápido (Cadastrador)" : "Novo cadastro completo"}
          </button>
          <button
            onClick={() => setShowGroupAdd(true)}
            className={`${toolbarButtonClass} border border-emerald-300 text-emerald-900 hover:bg-emerald-50`}
          >
            Adicionar do grupo
          </button>
          <button
            type="button"
            onClick={() => setShowMoreActions((prev) => !prev)}
            className={`${toolbarButtonClass} border border-border text-text-muted hover:border-brand-200 hover:text-brand-900 sm:hidden`}
          >
            {showMoreActions ? "Menos ações" : "Mais ações"}
          </button>
          <div
            className={`${showMoreActions ? "flex" : "hidden"} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap`}
          >
            <button
              onClick={handleExport}
              className={`${toolbarButtonClass} border border-brand-300 text-brand-900 hover:bg-brand-50`}
            >
              Exportar CSV
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`${toolbarButtonClass} border border-dashed border-brand-300 text-brand-900 hover:bg-brand-50`}
            >
              Importar CSV/XLSX
            </button>
            <Link
              href="/cadastros_import_modelo.csv"
              className={`${toolbarButtonClass} block text-center border border-brand-200 text-brand-900 hover:bg-brand-50`}
            >
              Baixar modelo CSV
            </Link>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
```

O botão "Mais ações" some em `sm:` e acima (`sm:hidden`) porque nessas larguras a `div` das ações secundárias já é sempre `sm:flex` — visível sem precisar do toggle. No mobile, essa mesma `div` alterna entre `hidden`/`flex` conforme `showMoreActions`.

- [ ] **Step 3: Build e lint**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
npm run build
npm run lint
```
Expected: ambos passam sem erros novos.

- [ ] **Step 4: Checagem manual**

Com `npm run dev` rodando e DevTools em 375px de largura, abra `/cadastros`: confirme que só "Novo cadastro completo"/"Novo cadastro rápido", "Adicionar do grupo" e "Mais ações" aparecem inicialmente; clicar em "Mais ações" revela "Exportar CSV", "Importar CSV/XLSX" e "Baixar modelo CSV" empilhados, e o texto do botão vira "Menos ações". Depois alargue para 1024px+ e confirme que os 5 botões originais aparecem lado a lado sem o botão "Mais ações" (que deve estar `sm:hidden`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/cadastros/page.tsx"
git commit -m "Collapse secondary cadastros actions behind 'Mais ações' on mobile"
```

---

### Task 4: Modal compartilhado seguro por padrão (altura máxima + scroll)

**Files:**
- Modify: `src/components/ui/modal.tsx`

**Interfaces:** nenhuma mudança de props (`ModalProps` continua igual); só a classe do painel interno muda.

- [ ] **Step 1: Confirmar a linha atual**

Run: `grep -n "w-full max-w-md rounded-2xl" src/components/ui/modal.tsx`
Expected: uma ocorrência, dentro do `className={clsx(...)}` do `<div ref={panelRef} ...>`.

- [ ] **Step 2: Adicionar altura máxima e scroll**

Current:
```typescript
        className={clsx(
          "w-full max-w-md rounded-2xl border border-border bg-bg p-6 shadow-xl focus:outline-none",
          className
        )}
```

Replace with:
```typescript
        className={clsx(
          "flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-bg p-6 shadow-xl focus:outline-none",
          className
        )}
```

- [ ] **Step 3: Build e lint**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
npm run build
npm run lint
```
Expected: ambos passam sem erros novos.

- [ ] **Step 4: Checagem manual**

Com `npm run dev` rodando, logue no app, clique em "Alterar senha" no cabeçalho (usa este `Modal`) — confirme visualmente que o modal continua centralizado e com a mesma aparência de antes (o conteúdo desse modal específico é curto, então `max-h`/`overflow-y-auto` não devem mudar nada visível; a mudança é uma proteção para conteúdo futuro mais alto).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/modal.tsx
git commit -m "Cap shared modal height and add scroll so tall content never gets clipped"
```

---

### Task 5: Confirmar que `/cadastro` e os modais de criação já atendem ao padrão, e checagem final

**Files:** nenhum esperado a mudar — este task é verificação, não implementação. Só edite se a checagem abaixo encontrar uma classe fora do padrão.

**Interfaces:** nenhuma.

- [ ] **Step 1: Confirmar que `/cadastro` (formulário rápido do CADASTRADOR) já usa alvos de toque adequados**

Run: `grep -n "px-4 py-3\|px-3 py-2" "src/app/(app)/cadastro/page.tsx"`
Expected: só ocorrências de `px-4 py-3` (o `fieldClass`/`primaryButtonClass` já definidos no topo do arquivo), nenhuma de `px-3 py-2`. Se aparecer `px-3 py-2`, aplique a mesma troca do Task 2 Step 2 nesse trecho antes de prosseguir.

- [ ] **Step 2: Confirmar `CadastroForm.tsx` e `AdicionarDoGrupoModal.tsx`**

Run: `grep -n "px-4 py-3\|px-3 py-2" src/components/cadastros/CadastroForm.tsx src/components/cadastros/AdicionarDoGrupoModal.tsx`
Expected: só `px-4 py-3` nos dois arquivos, nenhuma ocorrência de `px-3 py-2`. Se aparecer, aplique a mesma troca do Task 2 Step 2 no arquivo correspondente e rode build+lint de novo antes de seguir.

- [ ] **Step 3: Build final completo**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
rm -rf .next
npm run build
npm run lint
```
Expected: ambos passam sem erros, sem warnings novos (em particular nenhum warning de `metadata.themeColor`).

- [ ] **Step 4: Passe manual final nas 3 telas alteradas**

Com `npm run dev` rodando e DevTools em modo responsivo (375px, depois 414px), visite `/cadastro`, `/cadastros` (com "Mais ações" aberto e fechado) e `/cadastro/completar` (estado "Link inválido" já é suficiente pra ver o layout do cabeçalho/card; se quiser ver o formulário completo, use um link real gerado em `/cadastros`). Confirme que nada ficou cortado, sobreposto, ou com texto ilegível nessas larguras. Pare o `npm run dev` ao terminar.

- [ ] **Step 5: Nenhum commit adicional necessário**

Se o Step 1 ou 2 não encontrou nada para corrigir, este task não gera mudanças de código — é só a verificação final do plano. Se algo foi corrigido, commit normalmente:
```bash
git add -A
git commit -m "Fix remaining touch targets found during final mobile-first review"
```
