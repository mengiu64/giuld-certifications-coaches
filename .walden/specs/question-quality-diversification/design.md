---
walden_schema_version: v1alpha1
status: approved
approved_at: 2026-09-08T12:40:52Z
last_modified: 2026-09-08T12:40:52Z
approved_fingerprint: sha256:23782f5b9e4375a493f1b06abb2569704878fd93fe9fc481f9e87aa8da48a96a
source_requirements_approved_at: 2026-09-08T12:38:08Z
source_requirements_fingerprint: sha256:acd7c878e55624c98671b623b7d841c324f3641d8a74230c09ffbeec1a7eb33d
---

# Feature Design

## Overview

Il design introduce un quality pipeline modulare nel backend che estende il flusso esistente di generazione senza cambiare i contratti principali di sessione esame. L'obiettivo e aumentare varieta realistica e qualita psicometrica delle domande con gate deterministici e metriche misurabili.

<!-- assumed: nessuna modifica breaking ai payload principali esistenti; estensioni additive di metadata -->

## Architecture

Pipeline proposta nel backend (`QuestionGenerator` + `QuestionValidator`):

1. ScenarioProfileBuilder costruisce profilo scenario strutturato.
2. DomainUseCasePlanner compone piano dominio/use-case per bank.
3. PromptComposer applica style pattern ruotati e vincoli anti-ripetizione.
4. CandidateGenerator produce domanda candidata via Bedrock + contesto MCP.
5. MultiPassReviewer applica 3 pass (writer, technical, exam).
6. DistractorQualityValidator applica regole misconception-driven.
7. NoveltyGate confronta stem/explanation con storico certificazione.
8. ExplanationRubricValidator verifica motivazione per opzioni corrette/errate.
9. QualityKpiAggregator computa KPI per bank e QualityFlagger segnala rischio review.

## Options Considered

### Option A

- Summary: Pipeline quality-first in-process nel backend con moduli dedicati e metadata additivi su Question.
- Why chosen: massimizza riuso dell'architettura attuale, minimizza coupling cross-package, evita nuove dipendenze infrastrutturali obbligatorie.

### Option B

- Summary: Servizio separato esterno di post-processing qualità (microservizio dedicato).
- Why rejected: aumenta complessita operativa, latenza e failure surface, senza vantaggi proporzionati in questa iterazione.

## Simplicity And Elegance Review

- Simplest viable shape: un unico quality pipeline nel backend con componenti coesi e interfacce pure.
- Coupling check: shared contiene solo tipi/schemi/enum e policy config; backend implementa logica; frontend consuma KPI/status in sola lettura.
- Future-proofing: vector store esterno e modelli aggiuntivi restano differiti; design mantiene adapter per novelty backend sostituibile.

## Components And Interfaces

### ScenarioProfileBuilder

- Purpose: genera profilo scenario realistico per ogni domanda.
- Inputs/Outputs: input `GenerationContext`; output `ScenarioProfile`.
- Dependencies: policy config condivisa.
- Requirements: `R1`, `R5`

### DomainUseCasePlanner

- Purpose: traduce blueprint dominio in allocazione use-case family.
- Inputs/Outputs: input `CertificationConfig` + bank size; output `DomainUseCasePlan`.
- Dependencies: `CertificationRegistry` shared.
- Requirements: `R2`

### MultiPassReviewer

- Purpose: orchestrazione pass writer/technical/exam con feedback bloccante/non-bloccante.
- Inputs/Outputs: input `QuestionCandidate`; output `ReviewOutcome`.
- Dependencies: regole qualità e rubric.
- Requirements: `R6`, `R7`

### DistractorQualityValidator

- Purpose: valida plausibilita distrattori e misconception mapping.
- Inputs/Outputs: input `QuestionCandidate`; output `ValidationResult`.
- Dependencies: misconception taxonomy.
- Requirements: `R3`, `R7`

### NoveltyGate

- Purpose: blocca ripetizioni semantiche su stem/explanation.
- Inputs/Outputs: input `QuestionCandidate` + corpus certificazione; output `NoveltyDecision`.
- Dependencies: similarity adapter e storage question bank.
- Requirements: `R4`, `R8`

### StyleEntropyGuard

- Purpose: applica rotazione pattern narrativi e anti-repetition locale per bank.
- Inputs/Outputs: input storico bank corrente; output policy decision.
- Dependencies: style policy config.
- Requirements: `R5`, `R8`

### QualityKpiAggregator

- Purpose: calcolo KPI bank-level e segnali di review.
- Inputs/Outputs: input stream decisioni quality gate; output `QualityKpiReport`.
- Dependencies: generation status endpoint.
- Requirements: `R8`, `NFR3`

## Data Models

Estensioni additive principali in `packages/shared`:

- `ScenarioProfile`: industry, orgSize, geoCompliance, migrationMaturity, businessObjective.
- `UseCaseFamily`: enum controllato per dominio SAP-C02.
- `DistractorMisconception`: taxonomy id + human-readable reason.
- `QualityGateDecision`: gateId, result, reasonCode, severity.
- `NoveltyScores`: stemSimilarity, explanationSimilarity, thresholdVersion.
- `StyleSignature`: openingPattern, decisionIntent, rhetoricalShape.
- `QualityKpiReport`: diversityIndex, serviceRepetitionRatio, styleEntropyScore, noveltyRejectRate, reviewFlag.

Persistenza:

- Question bank mantiene formato compatibile con campi nuovi opzionali.
- Storico per novelty costruito da bank esistenti per stessa certificazione.

## Error Handling

- Fail-fast su invalid schema/config.
- Regeneration loop bounded per gate non soddisfatti.
- Fail-closed per novelty service unavailable (`R4.AC3`) con errore esplicito.
- Logging strutturato per ogni reject (`reasonCode`, `gateId`, `questionId`, `attempt`).
- Circuit-breaker leggero sull'adapter similarity per evitare retry storm.

## Security Considerations

- Nessun secret in payload o log applicativi.
- Configurazione runtime via env vars esistenti (`AWS_PROFILE`, `BEDROCK_MODEL_ID`).
- Nessun cambio alla boundary di autenticazione admin; output KPI disponibile solo su endpoint/status gia protetti.

## Failure Modes And Tradeoffs

- Failure mode: novelty false positive (scarta troppo).
  - Mitigation: threshold calibrabili e override per dry-run diagnostico.
  - Tradeoff: maggiore complessita di tuning iniziale.
- Failure mode: novelty false negative (ripetizioni residue).
  - Mitigation: combinazione stem+explanation score e style signature.
  - Tradeoff: costo computazionale maggiore per domanda.
- Failure mode: multi-pass rallenta la generazione.
  - Mitigation: early-reject e caching contesto.
  - Tradeoff: aumento latenza ma migliore qualita.
- Failure mode: taxonomy distractor troppo rigida.
  - Mitigation: classi estendibili e fallback di revisione manuale.
  - Tradeoff: governance contenuti aggiuntiva.

## Testing Strategy

- Unit test su ogni nuovo componente qualità (builder/planner/validators/gates).
- Property-based test su distribuzione scenario/use-case, style entropy, novelty threshold invariants.
- Integration test backend su pipeline completa con fixture bank storiche.
- Regression test compatibilita schema su lettura/scrittura bank esistenti.
- API test su endpoint status con KPI e quality flags.

## Verification Plan

- Requirement proof: mapping 1:1 AC critici a test unit/integration con assertion su reasonCode e decisioni gate.
- Test evidence: test runner esistente (`jest`/`ts-jest`) + proprietà `fast-check` per invarianti di diversita e non-ripetizione.
- Operational evidence: log strutturati reject-rate, dashboard status generation con KPI report, conteggio bank flagged.

## Requirement Coverage

| Requirement | Covered By |
| --- | --- |
| `R1` | ScenarioProfileBuilder + GenerationPolicy allocator |
| `R2` | DomainUseCasePlanner + plan validator |
| `R3` | DistractorQualityValidator + misconception taxonomy |
| `R4` | NoveltyGate + similarity adapter + fail-closed policy |
| `R5` | PromptComposer + StyleEntropyGuard |
| `R6` | MultiPassReviewer orchestration |
| `R7` | ExplanationRubricValidator + DistractorQualityValidator |
| `R8` | QualityKpiAggregator + QualityFlagger + status projection |
| `NFR1` | Bounded retries + early reject + perf budget tests |
| `NFR2` | Deterministic policies/config versioning + invariant tests |
| `NFR3` | Structured logging contract + status KPI exposure |
