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

## Guida Admin: Generazione Domande

Questa sezione descrive tutti i prerequisiti e i passaggi necessari per avviare, come admin, la generazione delle domande d'esame.

### Prerequisiti di sistema

| Requisito | Versione minima | Verifica |
|-----------|----------------|----------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| AWS CLI v2 | 2.x | `aws --version` |
| Accesso ad Amazon Bedrock | — | Vedi sezione credenziali |

### Configurazione credenziali AWS

Il backend usa Amazon Bedrock (Claude) per generare le domande. Devi avere un account AWS con accesso al modello configurato.

1. **Configura un profilo AWS** con permessi per `bedrock:InvokeModel`:

   ```bash
   aws configure --profile <nome-profilo>
   ```

2. **Verifica l'accesso a Bedrock** nella regione configurata:

   ```bash
   aws bedrock list-foundation-models --region eu-west-1 --profile <nome-profilo>
   ```

3. **Assicurati che il modello sia abilitato** nella console AWS Bedrock → Model access. Il modello di default è `eu.anthropic.claude-sonnet-4-5-20250929-v1:0` (regione `eu-west-1`).

> **Nota**: Se non hai credenziali AWS o Bedrock non è raggiungibile, il sistema può funzionare in modalità mock (`BEDROCK_MOCK_FALLBACK=true`) generando domande deterministiche senza chiamate AI reali. Utile per sviluppo e testing.

### Configurazione ambiente (.env)

Copia il file di esempio e personalizzalo:

```bash
cp .env.example .env
```

Parametri rilevanti per la generazione:

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `BACKEND_PORT` | `4000` | Porta del server Express |
| `AWS_REGION` | `eu-west-1` | Regione AWS per Bedrock |
| `BEDROCK_MODEL_ID` | `eu.anthropic.claude-sonnet-4-5-20250929-v1:0` | ID del modello Claude su Bedrock |
| `AWS_PROFILE` | (vuoto) | Profilo AWS CLI da usare. Se vuoto, usa la chain di default |
| `BEDROCK_MOCK_FALLBACK` | `true` | Se `true`, ricade su mock quando Bedrock fallisce |
| `VITE_API_BASE_URL` | `http://localhost:4000/api` | URL API per il frontend |

### Build del progetto

Prima di avviare qualsiasi servizio, compila tutti i workspace:

```bash
npm install
npm run build
```

Questo compila in ordine: `shared` → `mcp-server` → `backend` → `frontend`.

### Avvio dei servizi

Servono **due terminali** (backend + frontend):

```bash
# Terminale 1 — Backend (porta 4000)
npm run start --workspace @aws-exam-generator/backend

# Terminale 2 — Frontend (porta 5173)
npm run dev --workspace @aws-exam-generator/frontend
```

Verifica che il backend sia attivo:

```bash
curl http://localhost:4000/health
# → {"status":"ok"}
```

### Avviare la generazione

Dalla UI (frontend):
1. Apri `http://localhost:5173`
2. Vai al pannello Admin
3. Seleziona la certificazione (es. SAA-C03, SAP-C02)
4. Clicca "Genera domande"

Oppure via API:

```bash
# Genera per SAA-C03 (65 domande, 34% AI topics)
curl -X POST http://localhost:4000/api/exams/generate \
  -H "Content-Type: application/json" \
  -d '{"certificationId": "SAA-C03"}'

# Genera per SAP-C02 (75 domande, 34% AI topics)
curl -X POST http://localhost:4000/api/exams/generate \
  -H "Content-Type: application/json" \
  -d '{"certificationId": "SAP-C02"}'

# Controlla lo stato della generazione
curl http://localhost:4000/api/exams/generate/status
```

Oppure con lo script CLI:

```bash
npx ts-node scripts/generate-exam.ts
```

### Monitoraggio della generazione

- **Stato**: `GET /api/exams/generate/status` ritorna progresso, numero domande generate, e stato (running/completed/failed)
- **Log**: il backend stampa INFO/WARN/ERROR sul terminale con dettagli su distribuzione topic e validazione AI
- **Checkpoint**: dopo ogni domanda generata viene salvato un checkpoint in `data/question-banks/`. Se il processo si interrompe, al riavvio riparte dal checkpoint
- **Durata stimata**: ~2-5 minuti per 65 domande (dipende dalla latenza di Bedrock e dal rate limiting di 2s tra richieste)

### Distribuzione AI Topics (SAA-C03 / SAP-C02)

Per queste due certificazioni, il 34% delle domande è automaticamente dedicato a temi di AI Generativa (Amazon Bedrock, Amazon Q, PartyRock, SageMaker JumpStart, Amazon CodeWhisperer, Amazon Titan). La distribuzione:

- **SAA-C03**: ~22 domande AI su 65 totali
- **SAP-C02**: ~26 domande AI su 75 totali

Le domande AI vengono distribuite proporzionalmente tra tutti i domini d'esame e validate post-generazione. Se la validazione fallisce (il modello non include servizi AI), il sistema riprova fino a 2 volte prima di usare una domanda mock garantita.

### Troubleshooting

| Problema | Causa probabile | Soluzione |
|----------|----------------|-----------|
| `ConflictError: A generation job is already running` | Generazione già attiva | Attendi il completamento o riavvia il backend |
| `Unknown certification: XXX` | ID certificazione non valido | Usa uno degli ID supportati (SAP-C02, SAA-C03, DVA-C02, ecc.) |
| Generazione lenta/timeout | Rate limiting Bedrock | Normale — c'è un delay di 2s tra richieste per rispettare i limiti |
| Domande AI con mock fallback | Modello non produce servizi AI validi | Il sistema ricade automaticamente su mock — le domande sono comunque valide |
| `ECONNREFUSED` sul frontend | Backend non avviato | Avvia prima il backend sulla porta 4000 |

## CLI helper

`scripts/generate-exam.ts` calls `POST /api/exams/generate` for a selected certification.
