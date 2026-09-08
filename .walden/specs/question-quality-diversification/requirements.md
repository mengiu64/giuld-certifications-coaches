---
walden_schema_version: v1alpha1
status: approved
approved_at: 2026-09-08T12:38:08Z
last_modified: 2026-09-08T12:38:08Z
approved_fingerprint: sha256:acd7c878e55624c98671b623b7d841c324f3641d8a74230c09ffbeec1a7eb33d
---

# Requirements Document

## Introduction

Questa feature migliora la qualita delle domande d'esame AWS SAP-C02 riducendo ripetitivita di scenario, schema narrativo e spiegazioni, mantenendo compatibilita con l'architettura corrente (monorepo TypeScript con `shared`, `backend`, `frontend`, `mcp-server`) e con i formati domanda gia supportati.

<!-- assumed: la feature resta confinata al processo di generazione/validazione senza cambiare il flusso utente principale -->

## Requirements

### R1 Scenario Diversification Layer

**User Story:** As a certification candidate, I want each question to describe a different realistic project context, so that exam practice resembles real AWS certification scenarios.

#### Acceptance Criteria

1. `R1.AC1` The system SHALL build a structured scenario profile for every generated question including industry, organization size, geography/compliance, migration maturity, and primary business objective.
2. `R1.AC2` WHEN a question generation starts, the system SHALL select scenario attributes from diversified pools with per-bank distribution targets.
3. `R1.AC3` IF scenario diversification targets cannot be met with the current candidate question, THEN the system SHALL regenerate the question with a different scenario profile.

### R2 Blueprint-To-Use-Case Coverage

**User Story:** As an exam author, I want domain questions to cover multiple SAP-C02 use-case families, so that domain practice is not monolithic.

#### Acceptance Criteria

1. `R2.AC1` The system SHALL map each SAP-C02 domain to a configurable set of use-case families.
2. `R2.AC2` WHEN building the generation plan for a bank, the system SHALL allocate question counts across use-case families for each selected domain.
3. `R2.AC3` IF a generated bank violates minimum per-family coverage thresholds, THEN the system SHALL mark the bank as invalid.

### R3 Misconception-Driven Distractors

**User Story:** As a certification candidate, I want wrong options to be plausible but wrong for specific reasons, so that I can learn exam-grade tradeoffs.

#### Acceptance Criteria

1. `R3.AC1` The system SHALL attach a misconception class to each distractor.
2. `R3.AC2` WHEN validating a question, the system SHALL reject distractors that are generic, obviously incorrect, or semantically duplicated.
3. `R3.AC3` IF a distractor does not map to at least one AWS service-specific misconception, THEN the system SHALL regenerate that distractor.

### R4 Novelty Gate Against Repetition

**User Story:** As an admin, I want repeated stems and repeated explanations to be filtered out automatically, so that banks remain varied over time.

#### Acceptance Criteria

1. `R4.AC1` The system SHALL compute semantic similarity between candidate questions and previously stored questions for the same certification.
2. `R4.AC2` WHEN similarity exceeds configurable thresholds for stem or explanation, the system SHALL reject the candidate question.
3. `R4.AC3` IF similarity services are temporarily unavailable, THEN the system SHALL fail generation with an explicit novelty-check error state.

### R5 Style Entropy Constraints

**User Story:** As a certification candidate, I want varied phrasing and request patterns, so that questions do not feel templated.

#### Acceptance Criteria

1. `R5.AC1` The system SHALL support multiple prompt style patterns for openings, decision focus, and answer intent.
2. `R5.AC2` WHEN generating consecutive questions in a bank, the system SHALL enforce anti-repetition rules for opening phrases and rhetorical structure.
3. `R5.AC3` IF anti-repetition style constraints are violated, THEN the system SHALL regenerate the question text.

### R6 Multi-Pass Quality Review

**User Story:** As an exam author, I want each question to pass distinct review passes, so that correctness and exam realism are both enforced.

#### Acceptance Criteria

1. `R6.AC1` The system SHALL process every question through writer, technical-review, and exam-review passes before final acceptance.
2. `R6.AC2` WHEN any pass returns a blocking issue, the system SHALL return the question to regeneration.
3. `R6.AC3` WHILE generation is in progress, WHEN quality retries exceed configured limits, the system SHALL record the failure reason and continue with next candidate generation attempt.

### R7 Explanation Rubric And Option-Level Rationale

**User Story:** As a certification candidate, I want explanations that explicitly compare options and tradeoffs, so that I can understand why answers are correct.

#### Acceptance Criteria

1. `R7.AC1` The system SHALL require each explanation to include why the correct option set is valid for the scenario constraints.
2. `R7.AC2` The system SHALL require each explanation to include at least one rejection reason for each incorrect option.
3. `R7.AC3` IF explanation rubric checks fail, THEN the system SHALL reject the question as invalid.

### R8 Diversity And Quality KPIs

**User Story:** As an admin, I want measurable quality indicators for generated banks, so that I can monitor drift and trigger manual review only when needed.

#### Acceptance Criteria

1. `R8.AC1` The system SHALL compute per-bank metrics including scenario diversity index, service repetition ratio, style entropy score, and novelty rejection rate.
2. `R8.AC2` WHEN bank generation completes, the system SHALL expose KPI values in generation status output.
3. `R8.AC3` IF KPI values cross configured risk thresholds, THEN the system SHALL flag the bank for manual review.

## Non-Functional Requirements

- `NFR1` The system SHALL complete generation of a 75-question bank with all quality gates within an additional overhead not exceeding 35% versus baseline generation time.
- `NFR2` The system SHALL keep quality-gate outcomes deterministic for the same inputs and configuration at tolerance level of semantic metrics.
- `NFR3` The system SHALL emit structured logs for every rejection reason and every quality gate decision.

## Constraints And Dependencies

- `C1` LLM provider remains Amazon Bedrock with model selection via environment configuration.
- `C2` Context retrieval remains MCP-based and integrated through the existing MCP server process.
- `C3` Shared types and schemas in `packages/shared` remain the source of truth for backend and frontend contracts.
- `C4` The existing question formats (single-4, multi-5, multi-6) remain supported and backward compatible.
- `C5` No secrets may be hardcoded; runtime configuration must continue using environment variables (`AWS_PROFILE`, `BEDROCK_MODEL_ID`).

## Out Of Scope

- Rewriting the current exam session UX flow.
- Introducing a new external database engine in this iteration.
- Supporting certifications outside the current configured catalog.
- Changing scoring semantics for exam results.
