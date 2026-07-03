---
unique-name: impact-06-software-architecture
display-name: IMPACT HOW_06 — Software Architecture
category: GENERAL
description: Architettura software del sistema AWS SAP Exam Agent: stile architetturale AI-native agent-based, container, component diagram C4, deployment, integrazioni e risk mitigation
---

# Software Architecture — AWS SAP Exam Agent

**Data**: 2026-07-03
**Versione**: 1.0
**Audience**: Architetti software, tech lead, team di sviluppo

---

## 1. Architecture Style & Patterns

### 1.1 Stile Architetturale Principale

Il sistema adotta uno stile **AI-Native Agent-Based** a tre tier, con integrazione Model Context Protocol (MCP) come layer di retrieval documentale strutturato. Non è un'architettura CRUD tradizionale: il cuore del sistema è una **generation pipeline con comportamento agentico**, in cui un orchestratore backend coordina retrieval, LLM inference e validazione prima di produrre dati persistibili.

| Dimensione | Scelta architetturale |
|---|---|
| Stile primario | Three-tier con component agentici |
| Pattern orchestrazione | Exam Agent Controller (orchestrator pattern) |
| Pattern retrieval | MCP Tool Calling (RAG-like context augmentation) |
| Pattern persistenza server | File-based JSON con atomic write |
| Pattern persistenza client | Client-side state ownership (localStorage) |
| Pattern accesso LLM | AWS Bedrock Converse API con cross-region inference profile |
| Pattern integrazione MCP | Child process stdio con JSON-RPC 2.0 |
| Pattern UI | Single Page Application (SPA) React con React Router DOM |
| Pattern config | Single Source of Truth via `CertificationRegistry` nel package shared |
| Pattern resilienza | Retry + exponential backoff + checkpoint periodici + atomic write |

### 1.2 Pattern Agentici

Il backend si comporta come un **agente semi-autonomo** durante la generation pipeline:

1. Riceve il trigger (API call).
2. Pianifica la distribuzione di domande per dominio e formato.
3. Per ogni domanda: recupera contesto documentale (MCP tool call), invoca LLM (Bedrock), valida output, riprova in caso di fallimento.
4. Persiste il risultato in modo atomico.
5. Pubblica lo stato di avanzamento via polling endpoint.

Questo pattern è vicino all'**agent loop** con tool use esplicito, dove gli "strumenti" sono i tool MCP (`search_by_service`, `search_by_domain`, `search_by_topic`).

---

## 2. Containers & Technology Choices

### 2.1 Container Map

Il sistema è un **monorepo TypeScript** con quattro package principali e una directory dati.

```
packages/
  shared/       → Tipi condivisi, CertificationRegistry, schemi JSON, costanti
  mcp-server/   → MCP Server TypeScript con stdio transport
  backend/      → Node.js Express API + Exam Agent logic
  frontend/     → React SPA + Vite
data/
  banks/        → File JSON delle QuestionBank generate
```

### 2.2 Scelte Tecnologiche per Container

| Container | Tecnologia | Motivazione |
|---|---|---|
| `shared` | TypeScript puro | Single source of truth per tipi e registry; consumato da backend e frontend |
| `mcp-server` | TypeScript + `@modelcontextprotocol/sdk` + stdio | Protocollo MCP standard, trasporto leggero senza overhead di rete |
| `backend` | Node.js + TypeScript + Express | Stack coerente con resto del monorepo; Express per API REST minimale |
| `frontend` | React + TypeScript + Vite | Framework UI consolidato; Vite per DX veloce e bundling efficiente |
| Persistenza server | File JSON su filesystem | Nessun database da gestire; atomic write per integrità |
| Persistenza client | Browser `localStorage` | Resilienza a refresh senza round-trip server; zero infrastruttura |
| LLM | Amazon Bedrock Converse API + Claude Sonnet | Allineamento ecosistema AWS; cross-region inference profile; SSO auth |
| MCP server (runtime) | Child process stdio | Integrazione locale senza rete; semplice da orchestrare dal backend |
| Credenziali AWS | AWS SSO profile (`AWS_PROFILE`) + `@aws-sdk/credential-providers` | No segreti hardcoded; SSO token cache nativa |

---

## 3. Component Diagram (C4 Level 2 / 3)

### 3.1 C4 Level 2 — System Context

```mermaid
C4Context
    title Sistema AWS SAP Exam Agent — Contesto

    Person(candidate, "Candidato AWS", "Pratica esami di certificazione AWS")
    Person(admin, "Amministratore", "Genera question bank")
    Person(dev, "Sviluppatore", "Mantiene ed estende il sistema")

    System(examAgent, "AWS SAP Exam Agent", "Genera esami practice AI-powered, gestisce sessioni e studio per certificazioni AWS")

    System_Ext(bedrock, "Amazon Bedrock", "Foundation model Claude Sonnet 4.5 via Converse API")
    System_Ext(awsDocs, "AWS Documentation Sources", "Documentazione tecnica ufficiale AWS")
    System_Ext(awsSso, "AWS SSO / IAM", "Autenticazione e autorizzazione verso Bedrock")

    Rel(candidate, examAgent, "Usa: seleziona certificazione, svolge esame, studia, rivede risultati")
    Rel(admin, examAgent, "Usa: avvia generazione question bank, monitora progresso")
    Rel(dev, examAgent, "Mantiene: aggiunge certificazioni, corregge bug, aggiorna configurazioni")
    Rel(examAgent, bedrock, "Invoca: genera domande via Converse API", "HTTPS/AWS SDK")
    Rel(examAgent, awsDocs, "Legge: contesto documentale per grounding", "via MCP Server")
    Rel(examAgent, awsSso, "Si autentica: AWS_PROFILE → SSO token cache", "AWS SSO")
```

### 3.2 C4 Level 2 — Container Diagram

```mermaid
C4Container
    title AWS SAP Exam Agent — Container

    Person(candidate, "Candidato / Admin", "Utente del sistema")

    Container_Boundary(system, "AWS SAP Exam Agent") {
        Container(frontend, "React SPA Frontend", "React + TypeScript + Vite", "UI per selezione certificazione, sessione esame, studio, review, admin")
        Container(backend, "Backend Exam Agent", "Node.js + TypeScript + Express", "REST API, orchestrazione generation pipeline, validazione, persistenza")
        Container(mcpServer, "MCP Server", "TypeScript + @modelcontextprotocol/sdk", "Retrieval strutturato della documentazione AWS via tool MCP e stdio")
        ContainerDb(banks, "Question Banks", "File JSON su filesystem", "data/banks/{bankId}.json — una bank per file")
        ContainerDb(localStorage, "Browser localStorage", "Web Storage API", "Sessioni esame, risultati, selezione certificazione dell'utente")
        Container(shared, "Shared Package", "TypeScript", "CertificationRegistry, tipi condivisi, schemi JSON, costanti")
    }

    System_Ext(bedrock, "Amazon Bedrock", "Claude Sonnet 4.5 — Converse API")
    System_Ext(awsDocs, "AWS Documentation", "Fonte documentale per retrieval MCP")

    Rel(candidate, frontend, "Usa", "HTTP/Browser")
    Rel(frontend, backend, "Chiama API", "REST/JSON HTTP")
    Rel(frontend, localStorage, "Legge/Scrive sessione", "Web Storage API")
    Rel(backend, mcpServer, "Interroga documentazione", "stdio JSON-RPC 2.0")
    Rel(backend, bedrock, "Genera domande", "HTTPS/AWS SDK Converse API")
    Rel(backend, banks, "Legge/Scrive question bank", "File I/O — atomic write")
    Rel(backend, shared, "Importa tipi e registry", "npm workspace")
    Rel(frontend, shared, "Importa tipi e registry", "npm workspace")
    Rel(mcpServer, awsDocs, "Recupera documentazione", "HTTPS/custom retrieval")
```

### 3.3 C4 Level 3 — Backend Components

```mermaid
C4Component
    title Backend Exam Agent — Component Diagram

    Container_Boundary(backend, "Backend Exam Agent (Node.js / Express)") {
        Component(router, "REST API Router", "Express Router", "Espone endpoint: /api/exams/generate, /api/exams/generate/status, /api/banks, /api/banks/:id, /api/certifications")
        Component(ctrl, "ExamAgentController", "TypeScript class", "Orchestratore centrale: acquisisce mutex, coordina Generator/Validator/BankManager, espone stato generazione")
        Component(gen, "QuestionGenerator", "TypeScript class / AsyncGenerator", "Genera domande invocando MCP per contesto e Bedrock per LLM output; gestisce retry e backoff")
        Component(val, "QuestionValidator", "TypeScript class", "Valida singola domanda e intera bank: struttura, distribuzione, unicità, schema")
        Component(mgr, "QuestionBankManager", "TypeScript class", "Salva/carica/lista question bank su filesystem; atomic write con temp+rename")
        Component(sv, "SchemaValidator", "TypeScript class", "Valida JSON schema delle bank; riporta errori con field + constraint + position")
        Component(mcpClient, "MCP Client", "TypeScript + @modelcontextprotocol/sdk", "Client MCP che lancia MCP Server come child process stdio e invoca tool: search_by_service, search_by_domain, search_by_topic")
        Component(bedrockClient, "Bedrock Client", "AWS SDK + Converse API", "Invoca Claude Sonnet 4.5 su Amazon Bedrock; gestisce auth SSO, delay 2s, backoff esponenziale")
        Component(mutex, "Generation Mutex", "In-memory lock", "Garantisce al massimo 1 generazione attiva contemporaneamente")
        Component(checkpoint, "Checkpoint Manager", "File I/O", "Persiste progresso ogni 5 domande in data/banks/generation-checkpoint.json")
    }

    Rel(router, ctrl, "Delega richieste", "Direct call")
    Rel(ctrl, mutex, "Acquisisce/rilascia lock")
    Rel(ctrl, gen, "Avvia generazione", "AsyncGenerator")
    Rel(ctrl, val, "Valida domande e bank")
    Rel(ctrl, mgr, "Persiste e carica bank")
    Rel(ctrl, checkpoint, "Salva checkpoint ogni 5 domande")
    Rel(gen, mcpClient, "Recupera contesto documentale")
    Rel(gen, bedrockClient, "Genera domande via LLM")
    Rel(mgr, sv, "Valida schema JSON")
```

### 3.4 Frontend Components

```mermaid
C4Component
    title Frontend React SPA — Component Diagram

    Container_Boundary(fe, "React SPA Frontend") {
        Component(landingPage, "LandingPage", "React page", "Mostra certificazioni disponibili, pulsanti start/resume/review, stato sessione attiva")
        Component(certSelector, "CertificationSelector", "React component", "Recupera certificazioni da API, mostra raggruppate per livello, persiste selezione in localStorage")
        Component(examSession, "ExamSessionPage", "React page", "Una domanda per pagina, timer, navigazione, mark for review, submit manuale")
        Component(useExam, "useExamSession hook", "React hook", "Stato sessione: answers, marks, order, timer; salva in localStorage entro 1s")
        Component(studyMode, "StudyModePage", "React page", "Feedback immediato post-risposta, running score, Next/Pause/Exit")
        Component(useStudy, "useStudyMode hook", "React hook", "Logica study: submitAnswer, nextQuestion, pauseQuiz, exitExam, running score")
        Component(reviewPage, "ReviewPage", "React page", "Mostra domande con risposta candidato/corretta/explanation, filtri, link AWS docs")
        Component(adminPage, "AdminPage", "React page", "Trigger generazione, progress polling, notifica successo/fallimento")
        Component(apiClient, "api-client.ts", "TypeScript service", "Client HTTP verso backend: fetch certificazioni, banks, trigger generazione, status polling")
        Component(storageUtil, "localStorage utilities", "TypeScript util", "safeGetItem/safeSetItem con graceful degradation; chiavi: exam_session_, exam_result_, active_session, selected_certification")
        Component(scoringEngine, "Scoring Engine", "TypeScript util", "Calcolo score (correct/75*100), pass/fail ≥75%, all-or-nothing multi-answer, domain breakdown")
    }

    Rel(landingPage, certSelector, "Integra")
    Rel(landingPage, apiClient, "GET /api/banks")
    Rel(examSession, useExam, "Usa hook")
    Rel(studyMode, useStudy, "Usa hook")
    Rel(useExam, storageUtil, "Persiste stato")
    Rel(useStudy, storageUtil, "Persiste stato")
    Rel(useExam, scoringEngine, "Calcola score al submit")
    Rel(certSelector, apiClient, "GET /api/certifications")
    Rel(certSelector, storageUtil, "Salva/ripristina selected_certification")
    Rel(adminPage, apiClient, "POST /api/exams/generate + polling status")
    Rel(reviewPage, storageUtil, "Legge exam_result_")
```

---

## 4. Deployment Diagram

### 4.1 Topologia di Deployment (Locale)

Il sistema è progettato per esecuzione **locale sul workstation del developer/admin**. Non è documentato un deployment cloud o containerizzato.

```mermaid
graph TB
    subgraph Developer_Workstation["Workstation Locale (macOS/Linux/Windows)"]
        subgraph Node_Process["Processo Node.js — Backend"]
            BE[Express API Server\n:3000 o configurato]
            CTRL[ExamAgentController]
            MCP_CHILD[MCP Server\nChild Process — stdio]
        end

        subgraph Browser["Browser Utente"]
            FE[React SPA\nservita su :5173 Vite dev\no bundle statico]
            LS[localStorage\nsessione/risultati/selezione]
        end

        subgraph FileSystem["File System Locale"]
            BANKS[data/banks/\n*.json — Question Banks]
            CHECKPOINT[data/banks/\ngeneration-checkpoint.json]
        end

        subgraph AWS_Config["Configurazione AWS Locale"]
            SSO[~/.aws/sso/cache/\nSSO token cache]
            PROFILE[~/.aws/config\nAWS_PROFILE]
        end
    end

    subgraph AWS_Cloud["AWS Cloud (Regione EU)"]
        BEDROCK[Amazon Bedrock\neu.anthropic.claude-sonnet-4-5-20250929-v1:0]
        AWS_DOCS[AWS Documentation\nSources - retrieval via MCP]
    end

    FE -->|REST HTTP/JSON\n:3000| BE
    FE <-->|Web Storage API| LS
    BE --> CTRL
    CTRL -->|spawn child process\nstdio JSON-RPC 2.0| MCP_CHILD
    CTRL <-->|file I/O atomic| BANKS
    CTRL <-->|file I/O| CHECKPOINT
    MCP_CHILD -->|HTTPS| AWS_DOCS
    CTRL -->|HTTPS AWS SDK\nConverse API| BEDROCK
    BEDROCK -.->|richiede auth| SSO
    PROFILE -.->|letto da| SSO
```

### 4.2 Note di Deployment

| Aspetto | Stato attuale | Note |
|---|---|---|
| Target deployment | Locale (workstation) | Nessun deploy cloud documentato |
| Container/Docker | Non documentato | Assenza di Dockerfile o compose |
| CI/CD | Non documentato | Gap rilevante identificato in 00_deep_dive |
| Frontend serving | Vite dev server o bundle statico | Build con `vite build` → `dist/` |
| Backend serving | Node.js diretto | Porta non documentata, presumibilmente configurabile |
| MCP Server | Child process del backend | Avvio automatico all'avvio del backend |
| Secrets | AWS SSO profile locale | Nessun vault dedicato documentato |

---

## 5. Integration Architecture

### 5.1 Integrazione con Amazon Bedrock

```mermaid
sequenceDiagram
    participant GEN as QuestionGenerator
    participant SDK as AWS SDK Bedrock Client
    participant CRED as @aws-sdk/credential-providers
    participant SSO as AWS SSO Cache (~/.aws)
    participant BEDROCK as Amazon Bedrock\n(Converse API)

    GEN->>CRED: Richiede credenziali (fromSSO)
    CRED->>SSO: Legge token SSO da cache locale
    SSO-->>CRED: SSO access token
    CRED-->>SDK: Temporary credentials
    loop Per ogni domanda (con delay ≥2s)
        GEN->>SDK: Converse API call (Claude Sonnet 4.5)
        SDK->>BEDROCK: HTTPS POST /model/{id}/converse
        BEDROCK-->>SDK: Generated question + explanation
        SDK-->>GEN: Response
        alt Errore transiente
            GEN->>GEN: Backoff esponenziale (1s / 2s / 4s)
            GEN->>SDK: Retry
        end
    end
```

**Dettagli tecnici:**
- Modello: `eu.anthropic.claude-sonnet-4-5-20250929-v1:0`
- API: Converse API (non InvokeModel legacy)
- Configurabile via `BEDROCK_MODEL_ID` env var
- Delay inter-richiesta: minimo 2 secondi
- Retry su errore transiente: backoff 1s / 2s / 4s
- Cross-region inference profile abilitato

### 5.2 Integrazione con MCP Server

```mermaid
sequenceDiagram
    participant CTRL as ExamAgentController
    participant MCP_CLIENT as MCP Client
    participant CHILD as MCP Server\n(Child Process)
    participant DOCS as AWS Documentation\nSources

    CTRL->>MCP_CLIENT: Inizializza client MCP
    MCP_CLIENT->>CHILD: spawn child process\nstdio transport
    CHILD-->>MCP_CLIENT: Server ready (JSON-RPC handshake)

    loop Per ogni contesto di domanda
        CTRL->>MCP_CLIENT: search_by_service({serviceName, topic?})
        MCP_CLIENT->>CHILD: JSON-RPC 2.0 tool call (stdin)
        CHILD->>DOCS: Recupera documentazione
        DOCS-->>CHILD: Risultati o empty set
        CHILD-->>MCP_CLIENT: DocumentationResult[] (stdout)
        MCP_CLIENT-->>CTRL: Contesto documentale

        alt MCP non raggiungibile
            MCP_CLIENT->>MCP_CLIENT: Retry 3x con intervallo 5s
        end
    end
```

**Tool MCP disponibili:**
- `search_by_service(serviceName, topic?)` — cerca per nome servizio AWS
- `search_by_domain(domain, topic?)` — cerca per dominio d'esame
- `search_by_topic(query, domains?, services?)` — ricerca semantica libera

**Resilienza:** Timeout 10s per query, retry 3x con intervallo 5s, empty result set come risposta valida.

### 5.3 Integrazione Frontend ↔ Backend

Comunicazione REST/JSON sincrona su HTTP. Il frontend non ha logica di generazione — è un thin client che consuma i dati prodotti dal backend.

| Endpoint | Metodo | Utilizzo | Response |
|---|---|---|---|
| `/api/certifications` | GET | Selezione certificazione al page load | `{professional, associate, specialty}[]` |
| `/api/exams/generate` | POST | Trigger generazione admin | 202 Accepted / 409 Conflict / 400 |
| `/api/exams/generate/status` | GET | Polling progresso da Admin UI | `GenerationStatus` |
| `/api/banks` | GET | Lista bank disponibili | `QuestionBankSummary[]` |
| `/api/banks/:bankId` | GET | Carica bank per sessione | `QuestionBank` / 404 |

---

## 6. Architectural Risks & Mitigation

### 6.1 Mappa Rischi/Mitigazioni

| Rischio | Impatto | Probabilità | Mitigazione attuale | Mitigazione raccomandata |
|---|---|---|---|---|
| **File-based storage non scalabile** | Alto | Media (tool locale) | Atomic write temp+rename, mutex generazione, checkpoint ogni 5 domande | Valutare SQLite o DuckDB per query e concorrenza, se il tool evolve |
| **Assenza di autenticazione utente** | Medio | Media | Nessuna: candidati sono anonimi | Introdurre session token lato server se si apre a usi multi-utente |
| **Dipendenza forte da Amazon Bedrock** | Alto | Bassa (servizio managed AWS) | Delay 2s anti-throttling, retry con backoff | Implementare circuit breaker; valutare fallback su modello alternativo |
| **Single-generation mutex = throughput limitato** | Medio | Alta (by design) | Mutex applicativo + 409 esplicito | Accettabile per tool locale; per scaling aggiungere job queue |
| **localStorage come unico recovery layer** | Medio | Media | Graceful degradation documentata | Aggiungere export sessione come JSON scaricabile dall'utente |
| **Assenza CI/CD documentata** | Medio | Alta | Nessuna | Introdurre pipeline GitHub Actions con test automatici |
| **Qualità domande dipende da grounding MCP** | Alto | Media | Retry per domanda, discard con log | Arricchire corpus documentale; monitorare % domande scartate |
| **Assenza backup question bank** | Medio | Alta | Scrittura atomica previene corruzione | Script di backup periodico o copia in directory versionata |
| **Credenziali AWS locali** | Alto | Bassa | AWS SSO profile (no hardcoded secrets) | Aggiungere secrets scanning in pre-commit hook |
| **Quota localStorage browser ~5-10MB** | Basso | Bassa | Graceful degradation | Comprimere sessioni lunghe o pulire risultati vecchi |

### 6.2 Matrice Rischio

```mermaid
quadrantChart
    title Rischi Architetturali — Impatto vs Probabilità
    x-axis Probabilità Bassa --> Alta
    y-axis Impatto Basso --> Alto
    quadrant-1 Monitorare
    quadrant-2 Azione Prioritaria
    quadrant-3 Accettabile
    quadrant-4 Piano di contingenza

    File storage non scalabile: [0.45, 0.75]
    Assenza CI/CD: [0.75, 0.55]
    Dipendenza Bedrock: [0.25, 0.80]
    Single-generation mutex: [0.80, 0.45]
    localStorage recovery: [0.50, 0.50]
    Qualità grounding MCP: [0.55, 0.75]
    Assenza backup bank: [0.70, 0.45]
    Credenziali AWS locali: [0.20, 0.80]
```

---

## Reference Documents

- [00_deep_dive.md](./00_deep_dive.md)
- [01_context.md](./01_context.md)
- [02_functional_overview.md](./02_functional_overview.md)
- [03_non_functional_overview.md](./03_non_functional_overview.md)
- [04_constraints.md](./04_constraints.md)
- [05_principles.md](./05_principles.md)

## Change Log

| Data | Versione | Autore | Modifica |
|---|---|---|---|
| 2026-07-03 | 1.0 | IMPACT HOW Pipeline | Prima emissione — Software Architecture per AWS SAP Exam Agent |
