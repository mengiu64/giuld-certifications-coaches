---
unique-name: tasks1
display-name: tasks1
category: GENERAL
description: This plan implements the AWS SAP Exam Agent — an AI-powered system for generating and serving 75-question SAP-C02 practice exams. The implementation is organized into project scaffolding, MCP server
---

# Implementation Plan: AWS SAP Exam Agent

## Overview

This plan implements the AWS SAP Exam Agent — an AI-powered system for generating and serving 75-question SAP-C02 practice exams. The implementation is organized into project scaffolding, MCP server, backend agent components, REST API, frontend React SPA, and comprehensive testing. TypeScript is used throughout all layers.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - [x] 1.1 Initialize monorepo with packages for mcp-server, backend, and frontend
    - Create root `package.json` with workspaces configuration
    - Set up TypeScript configs (`tsconfig.json`) for each package with shared base config
    - Install shared dev dependencies: `typescript`, `jest`, `fast-check`, `ts-jest`
    - Create directory structure: `packages/mcp-server/`, `packages/backend/`, `packages/frontend/`
    - _Requirements: 1.1, 10.1_

  - [x] 1.2 Define shared TypeScript interfaces and types
    - Create `packages/shared/src/types.ts` with `Question`, `QuestionBank`, `ExamSession`, `ExamResult`, `ExamDomain`, `FormatDistribution`, `DomainDistribution` interfaces
    - Create `packages/shared/src/schemas.ts` with JSON schema definition for Question Bank validation
    - Create `packages/shared/src/constants.ts` with domain names, format types, scoring threshold (75%), time limit (180 min)
    - Export all types as a shared package consumed by backend and frontend
    - _Requirements: 2.2, 2.4, 4.2, 5.1, 10.1_

  - [x] 1.3 Set up testing framework
    - Configure Jest with `ts-jest` preset across all packages
    - Install `fast-check` for property-based testing
    - Create test helper utilities: question generators, session factories
    - Add npm scripts: `test`, `test:unit`, `test:pbt`, `test:integration`
    - _Requirements: 3.1, 10.3_

- [x] 2. Implement MCP Server
  - [x] 2.1 Create MCP server with stdio transport and tool registration
    - Install `@modelcontextprotocol/sdk`
    - Implement MCP server initialization with stdio transport
    - Register tools: `search_by_service`, `search_by_domain`, `search_by_topic`
    - Define tool input schemas with parameter validation
    - _Requirements: 1.1, 1.3_

  - [x] 2.2 Implement documentation search tools
    - Implement `search_by_service` handler: query by AWS service name with optional topic filter
    - Implement `search_by_domain` handler: query by SAP-C02 exam domain with optional topic filter
    - Implement `search_by_topic` handler: free-text query with optional domain/service filters
    - Return `DocumentationResult[]` with title, content, url, services, domain, lastUpdated
    - Handle empty results by returning empty array with descriptive message
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 2.3 Implement documentation cache layer
    - Create in-memory cache with TTL for documentation results
    - Implement cache invalidation strategy
    - Add timeout handling (10-second query limit)
    - _Requirements: 1.4_

  - [ ]* 2.4 Write unit tests for MCP server tools
    - Test tool registration and discovery
    - Test search_by_service with valid/invalid service names
    - Test search_by_domain with each domain value
    - Test empty result handling and timeout behavior
    - _Requirements: 1.3, 1.4, 1.5_

- [x] 3. Implement Backend Agent — Question Generator
  - [x] 3.1 Implement Question Generator core logic
    - Create `QuestionGenerator` class implementing `AsyncGenerator<Question, GenerationResult>`
    - Implement format distribution calculation: 70% single-4, 20% multi-5, 10% multi-6 (±2 tolerance)
    - Implement domain distribution calculation: 26%, 29%, 25%, 20% (±5pp tolerance)
    - Wire MCP client to retrieve documentation context for question generation
    - Integrate Claude API for LLM-powered question generation with prompt templates
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.2 Implement question format enforcement and distractor generation
    - Enforce question stem structure: scenario (50-200 words) + interrogative sentence
    - Generate correct number of options per format (4, 5, or 6)
    - Generate distractors referencing real AWS services relevant to scenario domain
    - Generate explanation (50-300 words) referencing at least one AWS service from question tags
    - _Requirements: 2.2, 2.5, 2.6, 2.7, 3.5_

  - [x] 3.3 Implement retry and error handling for generation
    - Implement per-question retry logic (max 3 attempts with different source material)
    - Implement LLM API retry with exponential backoff (1s, 2s, 4s)
    - Handle partial generation failure: return error with successful count and failing domain
    - Discard questions that fail after 3 attempts, log failure reason, continue
    - _Requirements: 2.8, 3.3, 3.4_

  - [ ]* 3.4 Write property tests for question structure (Properties 1-5)
    - **Property 1: Question format structure invariant** — validate options count and correct answers match format
    - **Property 2: Scenario context word count** — validate stem context is 50-200 words
    - **Property 3: Explanation content validity** — validate explanation is 50-300 words with service name
    - **Property 4: Question stem structure** — validate 2+ declarative sentences + 1 interrogative
    - **Property 5: Question tagging correctness** — validate domain tag and 1-3 service tags
    - **Validates: Requirements 2.2, 2.5, 2.6, 2.7, 3.1, 3.5, 3.6**

- [x] 4. Implement Backend Agent — Question Validator
  - [x] 4.1 Implement single-question validation
    - Validate format structure (options count matches format declaration)
    - Validate correct answers count matches format
    - Validate stem length and structure (scenario + interrogative)
    - Validate explanation length and service reference
    - Validate domain tag is from valid domain list
    - Validate service tags (1-3 tags, referencing real AWS services)
    - Return `ValidationResult` with specific error codes and messages
    - _Requirements: 3.1, 3.5, 3.6_

  - [x] 4.2 Implement bank-level validation
    - Validate bank contains exactly 75 questions
    - Validate no two questions share same domain + primary service combination
    - Validate format distribution within tolerance
    - Validate domain distribution within tolerance
    - Return `BankValidationResult` with per-question and bank-level errors
    - _Requirements: 2.1, 2.3, 2.4, 3.2_

  - [ ]* 4.3 Write property test for bank uniqueness (Property 6)
    - **Property 6: Bank uniqueness constraint** — no two questions share same domain + primary service
    - **Validates: Requirements 3.2**

- [x] 5. Implement Backend Agent — Question Bank Manager
  - [x] 5.1 Implement Question Bank persistence (save/load/list)
    - Implement `save(bank)`: atomic write pattern (write to temp file, then rename)
    - Implement `load(bankId)`: read and parse JSON file, validate schema
    - Implement `list()`: scan storage directory, return summaries with id and creation timestamp
    - Store banks at `data/banks/{bankId}.json`
    - _Requirements: 4.1, 4.3, 4.5, 4.6_

  - [x] 5.2 Implement schema validation for Question Bank JSON
    - Implement `validateSchema(json)`: validate against JSON schema definition
    - Report invalid JSON syntax with line/character position
    - Report schema violations with field name and constraint violated
    - Handle empty/zero-question files with specific error
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 5.3 Write property tests for serialization (Properties 16, 17, 18)
    - **Property 16: Question Bank serialization round-trip** — serialize → parse produces identical object
    - **Property 17: Invalid JSON error reporting** — invalid JSON returns error with position
    - **Property 18: Schema violation error identification** — invalid schema returns field + constraint
    - **Validates: Requirements 10.3, 10.4, 10.5**

- [x] 6. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Exam Agent Controller and REST API
  - [x] 7.1 Implement Exam Agent Controller with generation mutex
    - Create `ExamAgentController` class orchestrating Generator, Validator, and Bank Manager
    - Implement `generateExam()`: acquire mutex → generate → validate → persist → release mutex
    - Implement `getGenerationStatus()`: return progress (questions generated, elapsed time, current domain)
    - Implement `isGenerationInProgress()`: check mutex state
    - Reject concurrent generation with descriptive error
    - _Requirements: 9.4, 9.5_

  - [x] 7.2 Implement REST API endpoints
    - `POST /api/exams/generate` — trigger exam generation, return 202 Accepted or 409 Conflict
    - `GET /api/exams/generate/status` — return current generation status
    - `GET /api/banks` — list all question banks (id, createdAt)
    - `GET /api/banks/:bankId` — return full question bank JSON, 404 if not found
    - Add error handling middleware with consistent error response format
    - Set up Express server with CORS for frontend access
    - _Requirements: 4.5, 4.6, 9.1, 9.4, 9.5_

  - [ ]* 7.3 Write unit tests for REST API endpoints
    - Test generation trigger (success, concurrent rejection 409)
    - Test generation status endpoint
    - Test bank listing and retrieval (success, 404)
    - Test error response format consistency
    - _Requirements: 4.5, 4.6, 9.4, 9.5_

- [x] 8. Implement Frontend — Project Setup and Landing Page
  - [x] 8.1 Set up React frontend with TypeScript and routing
    - Initialize React app with Vite + TypeScript
    - Install dependencies: `react-router-dom`, styling library
    - Configure routing: `/`, `/exam/:bankId`, `/study/:bankId`, `/review/:sessionId`, `/admin`
    - Set up API client service for backend communication
    - _Requirements: 8.1, 8.2_

  - [x] 8.2 Implement Landing Page
    - Display options: Start New Exam, Resume Exam (if in-progress session exists), Review Completed Exam
    - Fetch and display available question banks from `/api/banks`
    - Disable/hide resume option when no in-progress session exists in localStorage
    - Detect active session from `active_session` localStorage key
    - Responsive layout for 768px-1920px viewports
    - _Requirements: 8.2, 8.3_

- [x] 9. Implement Frontend — Exam Session
  - [x] 9.1 Implement Exam Session state management (useExamSession hook)
    - Create `useExamSession` hook managing session lifecycle
    - Initialize session: generate randomized question order (permutation of [0,74])
    - Track answers as `Map<number, SelectedAnswer>` serialized as `[key, value]` tuples
    - Track marked-for-review as `Set<number>` serialized as number array
    - Persist to localStorage under `exam_session_{sessionId}` within 1 second of changes
    - Restore session on page refresh from localStorage
    - _Requirements: 5.1, 5.4, 5.7, 5.8_

  - [x] 9.2 Implement Exam Session UI — question display and navigation
    - Single-question-per-page layout with Previous/Next buttons
    - Display question number indicator ("Question X of 75")
    - Render question stem with code snippets in monospace blocks, service names inline, line lengths ≤90 chars
    - Render answer options with visual feedback on selection within 200ms
    - Disable backward navigation on question 1, forward navigation on question 75
    - _Requirements: 5.3, 5.5, 8.4, 8.5, 8.6_

  - [x] 9.3 Implement timer and auto-submit
    - Initialize 180-minute countdown timer from session start
    - Display remaining time updated every 1 second
    - Handle timer desync (device sleep): recalculate from `startedAt + 180min - now`
    - Auto-submit on timer expiry with all current answers
    - Manual submit with confirmation prompt showing unanswered count
    - _Requirements: 5.2, 5.5, 5.6, 5.9_

  - [ ]* 9.4 Write property tests for session management (Properties 8, 9, 10, 11)
    - **Property 8: Question order shuffle produces valid permutations** — valid permutation of [0,74]
    - **Property 9: Navigation boundary constraints** — no navigation beyond boundaries
    - **Property 10: Mark/unmark toggle idempotence** — toggle semantics preserved
    - **Property 11: Session state serialization round-trip** — serialize → deserialize is identity
    - **Validates: Requirements 5.1, 5.3, 5.4, 5.8**

- [x] 10. Implement Frontend — Scoring Engine
  - [x] 10.1 Implement scoring calculation
    - Calculate score: `Math.round(correctCount / 75 * 100)`
    - Determine pass/fail: score ≥ 75 passes
    - Implement all-or-nothing scoring for multi-answer questions (exact match required)
    - Treat unanswered questions as incorrect
    - Calculate domain breakdown: per-domain correct counts and totals
    - Verify domain breakdown sums to total correct count
    - Store `ExamResult` in localStorage under `exam_result_{sessionId}`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 10.2 Write property tests for scoring (Properties 12, 13)
    - **Property 12: Scoring correctness** — score formula, pass/fail threshold, domain breakdown consistency
    - **Property 13: Multi-answer all-or-nothing scoring** — credit only on exact match
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

- [x] 11. Implement Frontend — Review Mode
  - [x] 11.1 Implement Review Mode UI
    - Display each question with selected answer, correct answer, and explanation
    - Classify each option: correct-selected, incorrect-selected, missed-correct, unselected-incorrect
    - Use color coding + supplementary icon/text label for each state
    - Display AWS documentation reference link per question
    - Show "explanation not available" message when data is missing
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 11.2 Implement review filters
    - Filter options: all (default), incorrect only, correct only, unanswered only, marked for review
    - Filter produces exactly matching subset of questions
    - Maintain question navigation within filtered set
    - _Requirements: 7.3_

  - [ ]* 11.3 Write property tests for review (Properties 14, 15)
    - **Property 14: Answer state classification** — exhaustive and mutually exclusive classification
    - **Property 15: Review filter correctness** — filtered output matches filter criterion exactly
    - **Validates: Requirements 7.2, 7.3, 11.3**

- [x] 12. Implement Frontend — Study Mode
  - [x] 12.1 Implement Study Mode interaction flow (useStudyMode hook)
    - Create `useStudyMode` hook extending session management
    - On answer submission: immediately display explanation panel (no auto-advance)
    - Classify answer options with color coding (correct, incorrect-selected, missed-correct)
    - Present three navigation options: "Next Question", "Pause Quiz", "Exit Exam"
    - On last question (75): replace "Next Question" with "View Results"
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.8_

  - [x] 12.2 Implement Study Mode navigation and session management
    - "Next Question": advance to next unanswered question in sequence (wrap or indicate completion)
    - "Pause Quiz": save full session state to localStorage, return to landing page
    - "Exit Exam": confirmation prompt with unanswered count, then show cumulative score
    - Display running score: `correctSoFar / answeredSoFar` updated after each answer
    - Persist `StudyQuestionResult` per question in session state
    - _Requirements: 11.5, 11.6, 11.7, 11.9_

  - [ ]* 12.3 Write property tests for Study Mode (Properties 19, 20)
    - **Property 19: Study mode next-unanswered navigation** — advances to next unanswered question
    - **Property 20: Study mode running score** — running score equals correctSoFar/answeredSoFar
    - **Validates: Requirements 11.7, 11.9**

- [x] 13. Implement Frontend — Admin/Generation UI
  - [x] 13.1 Implement Admin page for exam generation
    - Admin interface with authentication check (gate access)
    - Generation trigger button (disabled while generation in progress)
    - Progress indicator: questions generated out of 75, elapsed time
    - Poll `GET /api/exams/generate/status` while generation is running
    - Display success notification on completion, add new bank to list without page reload
    - Display error message on failure with failure reason and successful count
    - Reject concurrent generation with user-facing message
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement Backend Agent — Bank Immutability Verification
  - [x] 15.1 Implement bank immutability guarantee
    - Ensure `generateExam()` flow never modifies existing bank files
    - Verify new bank creation uses unique ID and new file path
    - Add guard: read existing bank list before and after generation to confirm no changes
    - _Requirements: 4.3_

  - [ ]* 15.2 Write property test for bank immutability (Property 7)
    - **Property 7: Bank immutability on new generation** — existing banks remain byte-identical after new generation
    - **Validates: Requirements 4.3**

- [x] 16. Integration and wiring
  - [x] 16.1 Wire MCP server as child process of backend agent
    - Spawn MCP server as child process with stdio transport
    - Implement MCP client in backend to send JSON-RPC requests to child process
    - Implement connection retry logic (3 retries at 5-second intervals)
    - Handle MCP server crash/exit with error reporting
    - _Requirements: 1.1, 1.2, 1.6_

  - [x] 16.2 Wire frontend to backend API
    - Configure API base URL and CORS
    - Implement API client with error handling (retry button on network errors, preserve local state)
    - Handle localStorage unavailable (show warning banner, continue without persistence)
    - Handle session state corruption (attempt partial recovery, offer new session)
    - _Requirements: 5.8, 8.2_

  - [ ]* 16.3 Write integration tests
    - Test MCP server tool invocation and response format end-to-end
    - Test question generation pipeline with mocked LLM
    - Test file system persistence read/write with temp directories
    - Test frontend ↔ backend API contract (Supertest)
    - Test localStorage save/restore cycle
    - _Requirements: 1.1, 4.1, 4.5, 10.3_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- TypeScript is used across all layers (MCP server, backend, frontend)
- `fast-check` is used for property-based testing
- Jest is the test runner; React Testing Library for component tests; Supertest for API tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "8.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "8.2"] },
    { "id": 4, "tasks": ["2.4", "3.1", "5.1"] },
    { "id": 5, "tasks": ["3.2", "3.3", "5.2", "4.1"] },
    { "id": 6, "tasks": ["3.4", "4.2", "5.3"] },
    { "id": 7, "tasks": ["4.3", "7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3"] },
    { "id": 9, "tasks": ["9.1", "10.1", "13.1"] },
    { "id": 10, "tasks": ["9.2", "9.3", "10.2"] },
    { "id": 11, "tasks": ["9.4", "11.1", "12.1"] },
    { "id": 12, "tasks": ["11.2", "11.3", "12.2"] },
    { "id": 13, "tasks": ["12.3", "15.1"] },
    { "id": 14, "tasks": ["15.2", "16.1"] },
    { "id": 15, "tasks": ["16.2"] },
    { "id": 16, "tasks": ["16.3"] }
  ]
}
```