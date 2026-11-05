# Law Agent v2

Personal case desk for one lawyer: one account, one matter, one record. Built with Next.js, SQLite, DeepSeek, and PKULaw.

## What it does

- **Legal Q&A** — look up current statutes and cases, or retrieve then draft a short answer. Desk answers stay off matters; in-matter answers stay on that matter.
- **Find** — search matters and materials by text.
- **New matter** — create by form, or drop a complaint, name the client, then confirm filing.
- **Contract review** — read a contract, generate review cards, verify named articles, accept into an opinion, and ask about that contract.
- **Judges** — judge contact directory.
- **Elements and focuses** — extract issues from materials; confirmed focuses unlock research and drafting.
- **Research** — search PKULaw statutes and similar cases for one focus; accept selected sources into the matter.
- **Drafting** — draft opinions, complaints, answers, appeals, and second-instance answers from elements and accepted sources; check citations; lawyer finalizes.
- **Tasks** — evidence, hearing, appeal, and other deadlines; confirmed tasks appear on the desk.
- **Closing** — record outcome, archive for read-only review, unarchive to correct.

## Requirements

- Node.js 22+
- Your own DeepSeek API key
- Your own PKULaw MCP token (optional until you use research, Q&A, or article verification)

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` with your keys only:

```env
DEEPSEEK_API_KEY=your_deepseek_key
PKULAW_TOKEN=your_pkulaw_token
```

```bash
npm run dev
```

Open http://localhost:3000

## Secrets and access

- API keys live only in `.env.local` on your machine.
- `.env*` is gitignored. Case files under `data/` are gitignored.
- Keys are read only on the server in `lib/model.ts` and `lib/pkulaw.ts`. They are not exposed to the browser.
- Without your keys, someone else who clones this repo cannot call your model or PKULaw account.
- If a key was ever pasted into chat or a public place, rotate it in the DeepSeek and PKULaw consoles.

## Notes

- Chinese planning docs in the repo describe the original build order. This README is the public English overview.
- Closing PKULaw and the model still leaves create → archive working for local case records.
