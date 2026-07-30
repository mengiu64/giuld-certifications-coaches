---
unique-name: requirements
display-name: requirements
category: GENERAL
description: Questa feature rende configurabile la lista delle certificazioni AWS per le quali il sistema può generare esami di pratica. Attualmente il sistema è hardcoded per l'esame AWS Solutions Architect Pro
---

# Requirements Document

## Introduction

Questa feature rende configurabile la lista delle certificazioni AWS per le quali il sistema può generare esami di pratica. Attualmente il sistema è hardcoded per l'esame AWS Solutions Architect Professional (SAP-C02). Con questa modifica, l'utente potrà selezionare una certificazione tra i livelli Professional, Associate e Specialty prima di avviare la generazione dell'esame.

## Glossary

- **Certification_Selector**: Componente UI che presenta all'utente la lista delle certificazioni AWS disponibili e consente la selezione
- **Certification_Registry**: Modulo nel pacchetto shared che contiene la definizione di tutte le certificazioni supportate con i relativi metadata (domini, distribuzione domande, tempo limite)
- **Certification_Config**: Oggetto dati che descrive una singola certificazione AWS, inclusi identificatore, nome, livello, domini, distribuzione formato domande e tempo limite
- **Exam_Generator**: Componente backend che orchestra la generazione delle domande d'esame in base alla configurazione della certificazione selezionata
- **Certification_Level**: Classificazione della certificazione AWS: Professional, Associate o Specialty
- **Exam_Domain**: Area tematica coperta da una specifica certificazione AWS

## Requirements

### Requirement 1: Definizione del Certification Registry

**User Story:** As a developer, I want a centralized registry of supported AWS certifications, so that adding new certifications requires only a data change.

#### Acceptance Criteria

1. THE Certification_Registry SHALL define each supported certification with: a unique string identifier matching the AWS exam code pattern (e.g., "SAP-C02"), display name (1 to 120 characters), Certification_Level, list of 1 or more Exam_Domain values, format distribution whose values sum to total question count, domain distribution whose values sum to total question count, total question count (integer between 15 and 300), and time limit in minutes (integer between 30 and 300)
2. THE Certification_Registry SHALL include the following Professional certifications: Solutions Architect Professional (SAP-C02)
3. THE Certification_Registry SHALL include the following Associate certifications: Solutions Architect Associate (SAA-C03), Developer Associate (DVA-C02), SysOps Administrator Associate (SOA-C02)
4. THE Certification_Registry SHALL include the following Specialty certifications: Machine Learning Specialty (MLS-C01), Security Specialty (SCS-C02), Advanced Networking Specialty (ANS-C01)
5. THE Certification_Registry SHALL expose a function to retrieve all available certifications grouped by Certification_Level, returning an empty group for any Certification_Level that has no registered certifications
6. WHEN the caller provides a valid identifier that matches a registered certification, THE Certification_Registry SHALL return the corresponding Certification_Config
7. IF the caller provides an identifier that does not match any registered certification, THEN THE Certification_Registry SHALL return a not-found indication without throwing an exception

### Requirement 2: Selezione della Certificazione nel Frontend

**User Story:** As a user, I want to choose which AWS certification exam to generate, so that I can practice for the specific exam I'm preparing for.

#### Acceptance Criteria

1. WHEN the user navigates to the exam generation page, THE Certification_Selector SHALL display all available certifications grouped by Certification_Level (Professional, Associate, Specialty), with each group rendered as a distinct labeled section
2. WHEN the user selects a certification, THE Certification_Selector SHALL apply a visible selected state (distinct border or background change) to the selected certification option and remove the selected state from any previously selected option
3. WHILE no certification is selected, THE Certification_Selector SHALL disable the exam generation button and the button SHALL remain non-interactive until exactly one certification is selected
4. WHEN the user clicks the generate exam button with a certification selected, THE Certification_Selector SHALL send the selected certification exam code (e.g., "SAP-C02") to the Exam_Generator
5. THE Certification_Selector SHALL display the certification display name (e.g., "Solutions Architect Professional") and exam code (e.g., "SAP-C02") for each certification option
6. IF the certification list fails to load, THEN THE Certification_Selector SHALL display an error message indicating the failure and a retry button that re-attempts loading the certifications
7. WHILE the certification list is being fetched, THE Certification_Selector SHALL display a loading indicator and disable the exam generation button

### Requirement 3: Generazione Esame Basata sulla Certificazione

**User Story:** As a user, I want the generated exam to use the correct domains and question distribution for my selected certification, so that my practice exam is realistic.

#### Acceptance Criteria

1. WHEN a generation request includes a certification identifier, THE Exam_Generator SHALL produce questions only from the domains listed in the corresponding Certification_Config, with zero questions assigned to domains not in that list
2. WHEN a generation request includes a certification identifier, THE Exam_Generator SHALL distribute question formats so that the count of each format (single-answer 4 options, multi-answer 5 options, multi-answer 6 options) is within ±2 questions of the values specified in the corresponding Certification_Config format distribution
3. WHEN a generation request includes a certification identifier, THE Exam_Generator SHALL distribute questions across domains so that each domain's question count is within ±5 percentage points of the percentage specified in the corresponding Certification_Config domain distribution
4. WHEN a generation request includes a certification identifier, THE Exam_Generator SHALL generate exactly the total question count specified in the corresponding Certification_Config
5. IF a generation request includes a certification identifier that does not match any registered Certification_Config, THEN THE Exam_Generator SHALL reject the request and return an error indicating the certification identifier is not recognized
6. WHEN a generation request does not include a certification identifier, THE Exam_Generator SHALL default to the Solutions Architect Professional (SAP-C02) configuration for backward compatibility
7. IF the sum of format distribution counts in a Certification_Config does not equal its total question count, THEN THE Exam_Generator SHALL reject the generation request and return an error indicating the configuration is inconsistent

### Requirement 4: API Endpoint per le Certificazioni

**User Story:** As a frontend developer, I want an API endpoint to retrieve available certifications, so that the frontend can dynamically display the certification list.

#### Acceptance Criteria

1. WHEN the GET /api/certifications endpoint is called, THE Backend_API SHALL return a JSON response containing certification objects grouped by Certification_Level, where Certification_Level is one of: "foundational", "associate", "professional", or "specialty"
2. WHEN the GET /api/certifications endpoint is called, THE Backend_API SHALL include for each certification object the following fields: a unique string identifier (max 64 characters), a display name (max 128 characters), an exam code (e.g. "SAP-C02"), and the associated Certification_Level
3. THE Backend_API SHALL accept an optional certificationId string parameter in the POST /api/exams/generate request body, and IF the parameter is omitted, THEN THE Backend_API SHALL use the default certification configured for the system
4. IF the certificationId parameter in the generation request does not match any identifier returned by GET /api/certifications, THEN THE Backend_API SHALL return HTTP 400 with a JSON body containing an error field indicating the certification identifier is not recognized
5. WHEN the GET /api/certifications endpoint is called, THE Backend_API SHALL respond within 500 milliseconds under normal operating conditions

### Requirement 5: Persistenza della Selezione

**User Story:** As a user, I want my certification selection to be remembered, so that I don't have to re-select it every time I generate a new exam.

#### Acceptance Criteria

1. WHEN the user selects a certification, THE Certification_Selector SHALL immediately persist the certification identifier in localStorage before any other user interaction is accepted
2. WHEN the user navigates to the exam generation page and a valid certification identifier exists in localStorage, THE Certification_Selector SHALL pre-select the corresponding certification within 500ms of page load
3. IF the persisted certification identifier is no longer available in the Certification_Registry, THEN THE Certification_Selector SHALL remove the invalid entry from localStorage and display all certifications without pre-selection
4. IF localStorage is unavailable or a write operation fails, THEN THE Certification_Selector SHALL allow the user to continue selecting and generating exams without persistence, displaying no error to the user
5. WHEN the user navigates to the exam generation page and no certification identifier exists in localStorage, THE Certification_Selector SHALL display all certifications without pre-selection

### Requirement 6: Visualizzazione Certificazione nella Sessione d'Esame

**User Story:** As a user, I want to see which certification I'm being tested on during the exam, so that I have context about my practice session.

#### Acceptance Criteria

1. WHEN an exam session is active, THE Exam_Session_Page SHALL display the certification name (maximum 100 characters) and exam code (maximum 20 characters) in the session header area, visible without scrolling
2. WHEN a question bank is generated, THE Question_Bank SHALL store the certification name and exam code used for generation alongside the bank metadata
3. WHEN viewing exam results, THE Results_Page SHALL display the certification name and exam code associated with the completed exam, retrieved from the question bank linked by bankId
4. IF the certification name or exam code is unavailable for a question bank, THEN THE Exam_Session_Page SHALL display a fallback text indicating that certification information is not available