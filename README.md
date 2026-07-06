# AWS Certification Practice Exam Agent

An AI-powered practice exam generator for **multiple AWS certifications** across Professional, Associate, and Specialty levels. TypeScript monorepo with filesystem persistence, an MCP documentation server, an Express backend using Amazon Bedrock (Claude) for question generation, and a React/Vite frontend.

## Supported Certifications

| Level | Certification | Exam Code | Questions | Time |
|-------|--------------|-----------|-----------|------|
| Professional | Solutions Architect Professional | SAP-C02 | 75 | 180 min |
| Associate | Solutions Architect Associate | SAA-C03 | 65 | 130 min |
| Associate | Developer Associate | DVA-C02 | 65 | 130 min |
| Associate | SysOps Administrator Associate | SOA-C02 | 65 | 130 min |
| Specialty | Machine Learning Specialty | MLS-C01 | 65 | 180 min |
| Specialty | Security Specialty | SCS-C02 | 65 | 180 min |
| Specialty | Advanced Networking Specialty | ANS-C01 | 65 | 170 min |

## Packages

- `packages/shared`: shared types, schemas, certification registry, scoring, session helpers
- `packages/mcp-server`: stdio MCP server returning realistic AWS documentation snippets
- `packages/backend`: Express API, generation controller, filesystem bank manager, Bedrock integration
- `packages/frontend`: React SPA for exam, study, review, and admin flows

## Features

- **Multi-certification support**: select which AWS exam to practice from the admin panel
- **Certification-specific generation**: each exam uses the correct domains, question count, format distribution, and time limit
- **Three question formats**: 4 options (1 correct), 5 options (2 correct), 6 options (3 correct)
- **Study Mode**: select answers, press "Check answers" to reveal correctness and explanations, then advance
- **Exam Mode**: timed exam simulation matching the real exam duration, with a finish-time summary grid and auto-submit when the timer expires
- **Review workspace**: post-exam/study review with filtering (correct/incorrect/incomplete/unanswered/marked)
- **Resumable sessions**: any interrupted exam or study session (any bank, any mode) can be resumed or deleted from the landing page
- **Checkpoint & Resume for generation**: progress is checkpointed after every generated question (per certification), so an interrupted generation (crash, restart, network failure) resumes automatically from where it left off instead of losing progress
- **Selection persistence**: your certification choice is remembered via localStorage

## Prerequisites

- Node.js 18+
- npm 9+
- AWS Account with Amazon Bedrock access (optional — falls back to a mock generator without it)
- AWS CLI v2 (if using real AWS credentials)

## Storage

Question banks are saved under `data/question-banks/{certificationId}/{bankId}.json`.
Generation checkpoints are saved per certification to `data/question-banks/generation-checkpoint-{certificationId}.json` and are cleared automatically once generation completes successfully.

## Quick start

```bash
npm install
npm run build
```

## Running

Run services manually from workspace packages:

```bash
# Backend
npm run start --workspace @aws-exam-generator/backend

# Frontend (separate terminal)
npm run dev --workspace @aws-exam-generator/frontend
```

## Environment

Copy `.env.example` to `.env` and adjust values. The backend uses Bedrock when credentials are available and falls back to a deterministic mock generator when Bedrock fails/times out and `BEDROCK_MOCK_FALLBACK=true`.

## Tests

Backend tests cover scoring, question validation invariants, question bank persistence, and session serialization with Jest and fast-check.

```bash
npm test
```

## CLI helper

`scripts/generate-exam.ts` calls `POST /api/exams/generate` for a selected certification.
