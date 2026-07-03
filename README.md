# AWS SAP Exam Generator

TypeScript monorepo for generating AWS certification practice banks with filesystem persistence, an MCP documentation server, an Express backend, and a React/Vite frontend.

## Packages

- `packages/shared`: shared types, schemas, registry, scoring, session helpers
- `packages/mcp-server`: stdio MCP server returning realistic AWS documentation snippets
- `packages/backend`: Express API, generation controller, filesystem bank manager, Bedrock integration
- `packages/frontend`: React SPA for exam, study, review, and admin flows

## Storage

Question banks are saved under `data/question-banks/{certificationId}/{bankId}.json`.
Generation checkpoints are saved to `data/question-banks/generation-checkpoint.json` every 5 questions.

## Quick start

```bash
npm install
npm run build
```

Run services manually from workspace packages if needed:

```bash
npm run start --workspace @aws-exam-generator/backend
npm run dev --workspace @aws-exam-generator/frontend
```

## Environment

Copy `.env.example` to `.env` and adjust values. The backend uses Bedrock when credentials are available and falls back to a deterministic mock generator when Bedrock fails and `BEDROCK_MOCK_FALLBACK=true`.

## Tests

Backend tests cover scoring, question validation invariants, question bank persistence, and session serialization with Jest and fast-check.

## CLI helper

`scripts/generate-exam.ts` calls `POST /api/exams/generate` for a selected certification.
