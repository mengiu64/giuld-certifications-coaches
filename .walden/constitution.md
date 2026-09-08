# Project Constitution

This file captures stable project-wide context that applies across all features. It is optional and does not participate in the approval workflow.

## Project Summary

AWS SAP Exam Agent e un sistema agent-based che genera, valida e serve simulazioni d'esame AWS SAP-C02 (75 domande) utilizzando contesto documentale AWS recuperato via MCP e inferenza LLM su Amazon Bedrock.

## Tech Stack

- TypeScript monorepo con npm workspaces
- `packages/shared`: tipi, schema, registry certificazioni, costanti
- `packages/backend`: Node.js + Express API + orchestration Exam Agent
- `packages/frontend`: React SPA + React Router
- `packages/mcp-server`: MCP server TypeScript (JSON-RPC 2.0 su stdio)
- AWS SDK v3 (Bedrock Runtime), credenziali AWS SSO profile
- Testing: Jest + ts-jest, fast-check (property-based testing)

## Conventions

- Single Source of Truth per metadata certificazioni in `CertificationRegistry` (`packages/shared`)
- Riuso obbligatorio di tipi e schemi condivisi; evitare duplicazioni frontend/backend
- Nessuna credenziale hardcoded; configurazione via environment variables
- Pipeline di generazione robusta con retry/backoff e validazione schema

## Sanity Checks

```bash
npm run test
npm run test:unit
```

## Key Files

- `packages/backend/src/server.ts` (entry point API Express)
- `packages/frontend/src/main.tsx` (routing SPA)
- `packages/mcp-server/src/server.ts` (entry point MCP)
- `packages/shared/src/types.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/certification-registry.ts`

## Hard Rules

- Accesso LLM vincolato ad Amazon Bedrock (modello configurabile via `BEDROCK_MODEL_ID`)
- Integrazione documentale vincolata a MCP (`@modelcontextprotocol/sdk`, trasporto stdio)
- Nessuna credenziale in codice; usare `AWS_PROFILE`
- Preservare compatibilita dei contratti JSON e validazione schema
- Non introdurre dipendenze che violano il disegno monorepo shared-first
