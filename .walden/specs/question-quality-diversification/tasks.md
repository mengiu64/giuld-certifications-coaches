---
walden_schema_version: v1alpha1
status: approved
approved_at: 2026-09-08T12:42:28Z
last_modified: 2026-09-08T14:26:56Z
approved_fingerprint: sha256:d41881f501f0e20dab4c617a4d67a7ae258efbace97a5675abd3c0bc6ef1ede0
source_design_approved_at: 2026-09-08T12:40:52Z
source_design_fingerprint: sha256:23782f5b9e4375a493f1b06abb2569704878fd93fe9fc481f9e87aa8da48a96a
---

# Implementation Plan

- [x] 1. Estendere contratti condivisi e configurazione quality pipeline
  - [x] 1.1 Aggiungere nuovi tipi shared per scenario, novelty, style signature, misconception taxonomy e KPI
    - Requirements: `R1.AC1`, `R3.AC1`, `R4.AC1`, `R5.AC1`, `R8.AC1`, `C3`, `C4`
    - Design: Data Models; Components And Interfaces
    - Verification:
      - command: ["npm", "run", "test", "--", "shared"]
        expect_output: "PASS"
        covers: ["R1.AC1", "R3.AC1", "R4.AC1", "R5.AC1", "R8.AC1"]
  - [x] 1.2 Aggiornare schema e validatori mantenendo backward compatibility del formato question bank
    - Requirements: `R2.AC3`, `R7.AC3`, `C3`, `C4`
    - Design: Data Models; Error Handling
    - Verification:
      - command: ["npm", "run", "test", "--", "shared", "question-bank-schema"]
        expect_output: "PASS"
        covers: ["R2.AC3", "R7.AC3"]

- [x] 2. Implementare diversificazione scenario e copertura use-case
  - [x] 2.1 Implementare ScenarioProfileBuilder con pool diversificati e target di distribuzione per bank
    - Requirements: `R1.AC1`, `R1.AC2`, `R1.AC3`, `NFR2`
    - Design: Architecture; ScenarioProfileBuilder; Failure Modes And Tradeoffs
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "scenario-profile-builder"]
        expect_output: "PASS"
        covers: ["R1.AC1", "R1.AC2", "R1.AC3"]
  - [x] 2.2 Implementare DomainUseCasePlanner e allocazione per famiglia use-case su ogni dominio
    - Requirements: `R2.AC1`, `R2.AC2`, `R2.AC3`, `NFR2`
    - Design: DomainUseCasePlanner; Data Models
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "domain-usecase-planner"]
        expect_output: "PASS"
        covers: ["R2.AC1", "R2.AC2", "R2.AC3"]
  - [x] 2.3 Implementare StyleEntropyGuard e PromptComposer con anti-ripetizione su domande consecutive
    - Requirements: `R5.AC1`, `R5.AC2`, `R5.AC3`, `R8.AC1`
    - Design: StyleEntropyGuard; Architecture
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "style-entropy"]
        expect_output: "PASS"
        covers: ["R5.AC1", "R5.AC2", "R5.AC3"]

- [x] 3. Implementare quality gates su candidati domanda
  - [x] 3.1 Implementare MultiPassReviewer (writer, technical, exam) con ritorno a rigenerazione su blocchi
    - Requirements: `R6.AC1`, `R6.AC2`, `R6.AC3`, `NFR1`
    - Design: MultiPassReviewer; Error Handling
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "multi-pass-reviewer"]
        expect_output: "PASS"
        covers: ["R6.AC1", "R6.AC2", "R6.AC3"]
  - [x] 3.2 Implementare DistractorQualityValidator con misconception class e reject su distractor deboli/duplicati
    - Requirements: `R3.AC1`, `R3.AC2`, `R3.AC3`, `R7.AC2`
    - Design: DistractorQualityValidator; Data Models
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "distractor-quality-validator"]
        expect_output: "PASS"
        covers: ["R3.AC1", "R3.AC2", "R3.AC3", "R7.AC2"]
  - [x] 3.3 Implementare ExplanationRubricValidator con confronto opzioni corrette/errate
    - Requirements: `R7.AC1`, `R7.AC2`, `R7.AC3`
    - Design: ExplanationRubricValidator; Error Handling
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "explanation-rubric-validator"]
        expect_output: "PASS"
        covers: ["R7.AC1", "R7.AC2", "R7.AC3"]
  - [x] 3.4 Implementare NoveltyGate con similarity threshold e fail-closed su unavailable dependency
    - Requirements: `R4.AC1`, `R4.AC2`, `R4.AC3`, `NFR2`
    - Design: NoveltyGate; Error Handling; Failure Modes And Tradeoffs
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "novelty-gate"]
        expect_output: "PASS"
        covers: ["R4.AC1", "R4.AC2", "R4.AC3"]

- [x] 4. Esporre KPI qualità e segnali operativi
  - [x] 4.1 Implementare QualityKpiAggregator e QualityFlagger con soglie configurabili
    - Requirements: `R8.AC1`, `R8.AC3`, `NFR3`
    - Design: QualityKpiAggregator; Data Models; Verification Plan
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "quality-kpi-aggregator"]
        expect_output: "PASS"
        covers: ["R8.AC1", "R8.AC3"]
  - [x] 4.2 Aggiornare endpoint status per includere KPI e quality flags in output admin
    - Requirements: `R8.AC2`, `NFR3`, `C2`
    - Design: Architecture; Security Considerations
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "generation-status-api"]
        expect_output: "PASS"
        covers: ["R8.AC2"]

- [x] 5. Completare copertura test e budget prestazionale
  - [x] 5.1 Aggiungere property-based test per distribuzione scenario/use-case, style entropy e novelty invariants
    - Requirements: `R1.AC2`, `R2.AC2`, `R5.AC2`, `R4.AC2`, `NFR2`
    - Design: Testing Strategy; Verification Plan
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "property"]
        expect_output: "PASS"
        covers: ["R1.AC2", "R2.AC2", "R5.AC2", "R4.AC2"]
  - [x] 5.2 Aggiungere integration/regression test end-to-end della pipeline qualità su fixture storiche
    - Requirements: `R6.AC1`, `R6.AC2`, `R8.AC2`, `C4`
    - Design: Testing Strategy; Architecture
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "quality-pipeline-integration"]
        timeout: 20m
        expect_output: "PASS"
        covers: ["R6.AC1", "R6.AC2", "R8.AC2"]
  - [x] 5.3 Aggiungere test di budget prestazionale per overhead massimo del 35% rispetto baseline
    - Requirements: `NFR1`
    - Design: Failure Modes And Tradeoffs; Verification Plan
    - Verification:
      - command: ["npm", "run", "test", "--", "backend", "performance-budget"]
        timeout: 30m
        expect_output: "PASS"
        covers: ["NFR1"]
