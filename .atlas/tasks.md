---
unique-name: tasks
display-name: tasks
category: GENERAL
description: This plan transforms the hardcoded SAP-C02 exam configuration into a multi-certification system. Implementation proceeds bottom-up: shared types and registry first, then backend API, then frontend UI,
---

# Implementation Plan: AWS Certification Selector

## Overview

This plan transforms the hardcoded SAP-C02 exam configuration into a multi-certification system. Implementation proceeds bottom-up: shared types and registry first, then backend API, then frontend UI, and finally integration wiring. Each step builds on the previous, ensuring no orphaned code.

## Tasks

- [x] 1. Define certification types and registry in shared package
  - [x] 1.1 Create certification types and interfaces
    - Create `packages/shared/src/certification-registry.ts`
    - Define `CertificationLevel`, `CertificationDomain`, `CertificationFormatDistribution`, and `CertificationConfig` types
    - Define `CertificationRegistryInterface` with `getAll()`, `getById()`, and `getByLevel()` methods
    - Export all new types from `packages/shared/src/index.ts`
    - _Requirements: 1.1_

  - [x] 1.2 Implement the certification registry with all certification data
    - Populate registry with SAP-C02 (Professional) data including domains, format distribution, and time limit
    - Add SAA-C03, DVA-C02, SOA-C02 (Associate) certification data
    - Add MLS-C01, SCS-C02, ANS-C01 (Specialty) certification data
    - Implement `getAll()` returning certifications grouped by level (empty arrays for levels with no entries)
    - Implement `getById()` returning matching config or `null` without throwing
    - Implement `getByLevel()` returning array of configs for a given level
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 1.3 Add certification-specific arbitraries to test helpers
    - Extend `packages/shared/src/test-helpers/arbitraries.ts` with `arbCertificationConfig`, `arbCertificationLevel`, `arbInvalidCertId`, and `arbInvalidFormatConfig` generators
    - Export new arbitraries from the test-helpers index
    - _Requirements: 1.1_

  - [x] 1.4 Write property tests for certification registry
    - Create `packages/shared/src/__tests__/certification-registry.pbt.ts`
    - **Property 1: CertificationConfig validation invariant**
    - **Property 2: Registry grouping correctness**
    - **Property 3: Registry lookup correctness**
    - **Validates: Requirements 1.1, 1.5, 1.6, 1.7**

  - [x] 1.5 Write unit tests for certification registry
    - Create `packages/shared/src/__tests__/certification-registry.test.ts`
    - Test registry contains all expected certifications (SAP-C02, SAA-C03, DVA-C02, SOA-C02, MLS-C01, SCS-C02, ANS-C01)
    - Test each certification has valid domain percentages summing to 100
    - Test format distribution values sum to totalQuestions for each certification
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 2. Checkpoint - Ensure shared package builds and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Extend backend types and generation pipeline
  - [x] 3.1 Update shared types for certification-aware generation
    - Modify `Question` interface: change `domain` field from `ExamDomain` union to `string` to support arbitrary certification domains
    - Extend `QuestionBank` interface with `certificationId`, `certificationName`, and `examCode` fields
    - Create new `GenerationConfig` interface with dynamic `totalQuestions`, `formatDistribution`, `domainDistribution` (as `CertificationDomain[]`), `maxRetriesPerQuestion`, and `certificationId`
    - Update `GenerationStatus` and `ExamResult` types to use `string` domain instead of `ExamDomain`
    - _Requirements: 3.1, 3.4, 6.2_

  - [x] 3.2 Modify ExamAgentController to accept certificationId
    - Update `generateExam` method to accept optional `certificationId` parameter
    - Resolve certification config from registry (default to SAP-C02 when omitted)
    - Add validation: reject if certificationId not found in registry (return error)
    - Add validation: reject if format distribution sum !== totalQuestions (return error)
    - Build `GenerationConfig` from resolved `CertificationConfig`
    - Pass certification metadata (name, code) to question bank storage
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.2_

  - [x] 3.3 Update QuestionGenerator to use dynamic certification config
    - Modify question generation logic to use `domainDistribution` from `GenerationConfig` instead of hardcoded domains
    - Ensure generated questions use `domain` as string matching the certification's domain IDs
    - Respect format distribution counts from config (within ±2 tolerance)
    - Respect domain distribution percentages from config (within ±5 percentage points tolerance)
    - Generate exactly `totalQuestions` as specified in config
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.4 Write property tests for certification-aware generation
    - Create `packages/backend/src/__tests__/question-generator-cert.pbt.ts`
    - **Property 6: Generated questions domain constraint**
    - **Property 7: Format distribution tolerance**
    - **Property 8: Domain distribution tolerance**
    - **Property 9: Total question count invariant**
    - **Property 10: Invalid certification rejection**
    - **Property 11: Inconsistent configuration rejection**
    - **Property 14: Bank certification metadata round-trip**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 6.2**

- [x] 4. Implement certifications API endpoint
  - [x] 4.1 Add GET /api/certifications endpoint
    - Extend `packages/backend/src/api/router.ts` with `GET /api/certifications`
    - Return JSON response with certifications grouped by level (professional, associate, specialty)
    - Each certification object includes: `id`, `displayName`, `examCode`, `level`
    - Ensure response within 500ms (simple registry lookup, no I/O)
    - _Requirements: 4.1, 4.2, 4.5_

  - [x] 4.2 Modify POST /api/exams/generate to accept certificationId
    - Update route handler to read optional `certificationId` from request body
    - Pass `certificationId` to `controller.generateExam()`
    - Return HTTP 400 with error JSON if certification not recognized
    - Return HTTP 400 with error JSON if configuration is inconsistent
    - Return HTTP 409 if generation already in progress (existing behavior)
    - _Requirements: 4.3, 4.4_

  - [x] 4.3 Write unit and integration tests for certifications API
    - Create `packages/backend/src/__tests__/api-certifications.test.ts`
    - Test GET /api/certifications returns grouped certifications
    - Test POST /api/exams/generate with valid certificationId returns 202
    - Test POST /api/exams/generate with invalid certificationId returns 400
    - Test POST /api/exams/generate without certificationId defaults to SAP-C02
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Checkpoint - Ensure backend builds and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement frontend CertificationSelector component
  - [x] 6.1 Extend frontend API client with certification methods
    - Add `CertificationSummary` and `CertificationsResponse` types to `packages/frontend/src/services/api-client.ts`
    - Implement `getCertifications()` function to fetch from `GET /api/certifications`
    - Update `generateExam()` function to accept optional `certificationId` parameter and pass it in the request body
    - _Requirements: 4.1, 2.4_

  - [x] 6.2 Create CertificationSelector component
    - Create `packages/frontend/src/components/CertificationSelector.tsx`
    - Fetch certifications from API on mount
    - Render certifications grouped by level in labeled sections (Professional, Associate, Specialty)
    - Display `displayName` and `examCode` for each certification option
    - Implement single-selection with visible selected state (distinct border/background)
    - Expose selected certification ID to parent via `onSelect` callback
    - Show loading indicator while fetching
    - Show error message with retry button on fetch failure
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7_

  - [x] 6.3 Implement localStorage persistence for selection
    - On selection, persist certification ID to localStorage key `"selected_certification"` immediately
    - On mount, restore selection from localStorage if persisted ID is valid
    - If persisted ID is no longer in registry, remove from localStorage and show no pre-selection
    - Gracefully handle localStorage unavailability (no error shown, selection still works)
    - Handle quota exceeded errors silently
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.4 Integrate CertificationSelector with exam generation flow
    - Wire CertificationSelector into the exam generation page
    - Disable generate exam button when no certification is selected
    - Pass selected certificationId to generate exam API call
    - _Requirements: 2.3, 2.4_

  - [x] 6.5 Write property tests for CertificationSelector persistence
    - Create `packages/frontend/src/__tests__/CertificationSelector.pbt.ts`
    - **Property 12: Selection persistence round-trip**
    - **Property 13: Stale persistence cleanup**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 6.6 Write unit tests for CertificationSelector
    - Create `packages/frontend/src/__tests__/CertificationSelector.test.tsx`
    - Test loading state during fetch
    - Test error display with retry button on fetch failure
    - Test button disabled when no selection
    - Test localStorage unavailable graceful degradation
    - Test no pre-selection when storage is empty
    - _Requirements: 2.3, 2.6, 2.7, 5.4, 5.5_

- [x] 7. Display certification info in exam session
  - [x] 7.1 Display certification in session header and results
    - Update exam session page to show certification name and exam code in the header area (visible without scrolling)
    - Update results page to display certification name and exam code from the linked question bank
    - Show fallback text when certification info is unavailable
    - _Requirements: 6.1, 6.3, 6.4_

  - [x] 7.2 Write unit tests for certification display
    - Test certification name and exam code render in session header
    - Test certification info renders in results page
    - Test fallback text when certification info is missing
    - _Requirements: 6.1, 6.3, 6.4_

- [x] 8. Final checkpoint - Ensure all packages build and tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `domain` field on `Question` changes from a union type to `string` — existing bank data will need the type widened but values remain valid
- All certifications data should be researched from official AWS documentation for accuracy

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3"] },
    { "id": 7, "tasks": ["6.4", "6.5", "6.6"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2"] }
  ]
}
```