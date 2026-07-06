# AWS Certification Practice Exam Agent — Documento di Architettura

## 1. Panoramica del Progetto

L'AWS Certification Practice Exam Agent è un sistema AI-powered per la generazione e somministrazione di esami di pratica per le certificazioni AWS. Il sistema supporta 7 certificazioni AWS distribuite su 3 livelli (Professional, Associate, Specialty) e genera domande realistiche utilizzando Amazon Bedrock (Claude) come motore di intelligenza artificiale.

### Certificazioni Supportate

| Livello | Certificazione | Codice | Domande | Durata |
|---------|---------------|--------|---------|--------|
| Professional | Solutions Architect Professional | SAP-C02 | 75 | 180 min |
| Associate | Solutions Architect Associate | SAA-C03 | 65 | 130 min |
| Associate | Developer Associate | DVA-C02 | 65 | 130 min |
| Associate | SysOps Administrator Associate | SOA-C02 | 65 | 130 min |
| Specialty | Machine Learning Specialty | MLS-C01 | 65 | 180 min |
| Specialty | Security Specialty | SCS-C02 | 65 | 180 min |
| Specialty | Advanced Networking Specialty | ANS-C01 | 65 | 170 min |

---

## 2. Architettura del Sistema

Il progetto è strutturato come monorepo TypeScript con 4 pacchetti:

```
aws-exam-generator/
├── packages/
│   ├── shared/        → Tipi condivisi, Certification Registry, costanti
│   ├── mcp-server/    → MCP Server per ricerca documentazione AWS
│   ├── backend/       → API Express + pipeline di generazione domande
│   └── frontend/      → React SPA (Vite + TypeScript)
```

### Diagramma di Architettura

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                            │
│  React SPA (Vite)  ─  localhost:5173                     │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────┐     │
│  │ Landing  │ │ Exam Session │ │ Admin / Generate │     │
│  │  Page    │ │  + Study Mode│ │ + Certification  │     │
│  └──────────┘ └──────────────┘ │   Selector       │     │
│                                 └─────────────────┘     │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP (REST API)
┌───────────────────────────▼─────────────────────────────┐
│                      BACKEND                             │
│  Express Server  ─  localhost:4000                        │
│  ┌──────────────────────────────────────────────┐       │
│  │         Exam Agent Controller                 │       │
│  │  ┌─────────────┐  ┌───────────────────┐     │       │
│  │  │  Question   │  │  Question Bank    │     │       │
│  │  │  Generator  │  │  Manager (JSON)   │     │       │
│  │  └──────┬──────┘  └───────────────────┘     │       │
│  │         │                                     │       │
│  │  ┌──────▼──────┐  ┌───────────────────┐     │       │
│  │  │  LLM Client │  │  Documentation    │     │       │
│  │  │  (Bedrock)  │  │  Provider         │     │       │
│  │  └──────┬──────┘  └───────────────────┘     │       │
│  └─────────┼────────────────────────────────────┘       │
└────────────┼────────────────────────────────────────────┘
             │ AWS SDK (HTTPS)
┌────────────▼────────────────────────────────────────────┐
│              AMAZON BEDROCK                               │
│  Claude Sonnet 4.5 (Anthropic)                           │
│  Converse API  ─  regione configurabile (default eu-west-1)│
└─────────────────────────────────────────────────────────┘
```

---

## 3. Il Ruolo dell'Agente AI nel Progetto

### 3.1 Cos'è l'Agente in questo contesto

Il cuore del sistema è un **Exam Agent** — un agente AI **custom**, scritto interamente in TypeScript e orchestrato dal backend Node.js. Non utilizza il servizio "Bedrock Agents" di AWS — l'intelligenza agentica è implementata nel codice del progetto.

**Amazon Bedrock fornisce solo il modello linguistico** (Claude): riceve un prompt e restituisce testo. Tutta la logica di orchestrazione, pianificazione, retry, checkpoint e validazione è nel codice TypeScript.

L'agente autonomamente:
1. Riceve un obiettivo ("genera un esame SAP-C02 da 75 domande")
2. Pianifica la strategia (quali domini, quali formati, in che ordine)
3. Raccoglie informazioni (cerca documentazione AWS pertinente)
4. Esegue azioni iterative (genera ogni domanda una alla volta)
5. Gestisce errori e fallimenti (retry, skip, checkpoint)
6. Produce un risultato validato (question bank completo)

Non è un semplice wrapper su un LLM — è un **sistema agentico custom** che orchestra multiple fasi con decision-making autonomo.

### 3.2 Differenza tra Agente e semplice chiamata LLM

| Aspetto | Semplice API Call | Exam Agent |
|---------|-------------------|------------|
| Pianificazione | Nessuna | Pianifica 75 slot con distribuzione dominio/formato |
| Contesto | Fisso | Cerca documentazione diversa per ogni domanda |
| Gestione errori | Fallisce | Riprova con backoff, scarta e continua |
| Stato | Stateless | Checkpoint persistente su disco |
| Validazione | Nessuna | Valida struttura, distribuzione, unicità |
| Output | Singola risposta | Bank completo di 75 domande validate |

### 3.3 Il Loop Agentico

```
                    ┌──────────────────────────┐
                    │   Exam Agent Controller   │
                    │   (Orchestratore)         │
                    └─────────────┬────────────┘
                                  │
              ┌───────────────────▼────────────────────┐
              │         LOOP PER OGNI DOMANDA          │
              │                                        │
              │  1. Seleziona dominio e formato        │
              │         │                              │
              │         ▼                              │
              │  2. RAGIONAMENTO: Quale topic?         │
              │     → Sceglie topic rilevante          │
              │         │                              │
              │         ▼                              │
              │  3. AZIONE: Cerca documentazione       │
              │     → DocumentationProvider            │
              │         │                              │
              │         ▼                              │
              │  4. AZIONE: Genera domanda via LLM     │
              │     → Bedrock Claude con contesto      │
              │         │                              │
              │         ▼                              │
              │  5. VALUTAZIONE: Risposta valida?      │
              │     → Parse JSON, verifica struttura   │
              │     → Se errore: RETRY (max 3)         │
              │         │                              │
              │         ▼                              │
              │  6. PERSISTENZA: Salva progresso       │
              │     → Checkpoint dopo ogni domanda     │
              │       (per certificazione)             │
              │                                        │
              └────────────────────────────────────────┘
```

### 3.4 Capacità dell'Agente

**Tool Use (uso di strumenti):**
- `DocumentationProvider.searchByDomain()` — cerca documentazione per dominio
- `DocumentationProvider.searchByService()` — cerca per servizio AWS
- `DocumentationProvider.searchByTopic()` — ricerca libera per argomento
- `LLMClient.generateQuestion()` — invoca il modello per generare contenuto

**Memoria e Stato:**
- Mantiene lo stato della generazione (quante domande generate, dominio corrente)
- Salva checkpoint su disco per recupero da crash
- Traccia quali domande sono fallite e perché

**Decision Making:**
- Sceglie autonomamente quale topic cercare per ogni dominio
- Decide se scartare una domanda fallita o ritentare
- Bilancia la distribuzione reale vs target durante la generazione

**Self-Correction:**
- In caso di *throttling* da Bedrock, riprova fino a 3 volte con backoff esponenziale (1s, 2s, 4s)
- Ogni chiamata a Bedrock ha un timeout rigido (20s, più 5s di connessione) per evitare blocchi indefiniti
- Se la generazione fallisce (errore, timeout, JSON invalido o domanda che non supera la validazione), l'agente sostituisce la domanda con una generata dal fallback deterministico (mock), se `BEDROCK_MOCK_FALLBACK=true`; altrimenti l'intero job di generazione fallisce e resta ripristinabile dal checkpoint
- Alla fine, verifica che la distribuzione finale sia entro le tolleranze

### 3.5 Perché è un Agente e non un Batch Job

Un batch job tradizionale farebbe 75 chiamate identiche e fallirebbe al primo errore. L'Exam Agent invece:

1. **Adatta il comportamento**: se un dominio genera più errori, continua con gli altri
2. **Recupera da interruzioni**: checkpoint + resume rende la generazione resiliente
3. **Usa strumenti diversi per ogni step**: non fa la stessa cosa 75 volte — cerca contesto diverso, adatta il prompt al dominio
4. **Valida il proprio output**: non si fida ciecamente dell'LLM, verifica e scarta output invalido
5. **Rispetta vincoli globali**: la distribuzione dominio/formato è un vincolo sull'intero bank, non sulla singola domanda

---

## 4. Modelli AI Utilizzati

### Amazon Bedrock — Claude Sonnet 4.5 (Anthropic)

Il sistema utilizza **Amazon Bedrock** come piattaforma di inferenza AI, con il modello **Claude Sonnet 4.5** di Anthropic come LLM principale.

**Perché Claude Sonnet 4.5:**
- Eccellente nella generazione di contenuti strutturati (JSON)
- Conoscenza approfondita dei servizi AWS e delle best practices architetturali
- Capacità di seguire istruzioni complesse per formattazione e struttura
- Buon equilibrio tra qualità e costo (~$1.50 per esame da 75 domande)

**Configurazione:**
- **Model ID**: `eu.anthropic.claude-sonnet-4-5-20250929-v1:0` (configurabile via `BEDROCK_MODEL_ID`)
- **API**: Bedrock Converse API
- **Max Tokens**: 1400 per risposta
- **Timeout**: 20 secondi per chiamata (più 5s per l'apertura della connessione), con fallback automatico al mock generator in caso di timeout/errore
- **Retry**: 3 tentativi con backoff esponenziale (1s, 2s, 4s), solo in caso di throttling

**Modelli Alternativi Supportati:**
- Claude Haiku 4.5 (~$0.10 per esame, qualità inferiore)
- Qualsiasi modello Bedrock che supporti la Converse API

---

## 5. Pipeline di Generazione delle Domande

### 5.1 Flusso Completo

```
Utente seleziona certificazione (es. SAP-C02)
         │
         ▼
┌─────────────────────────┐
│ 1. Resolvi configurazione│  → CertificationRegistry.getById("SAP-C02")
│    certificazione        │  → Ottieni: domini, distribuzione, totale domande
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 2. Pianifica sequenza    │  → planGenerationSequence(config)
│    generazione           │  → Assegna formato e dominio a ogni slot
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 3. Per ogni slot:        │  (loop 75 volte per SAP-C02)
│    a) Cerca documentaz.  │  → DocumentationProvider.searchByDomain()
│    b) Costruisci prompt  │  → buildPrompt(context, format, domain)
│    c) Chiama Bedrock     │  → Claude genera la domanda in JSON
│    d) Valida e parsa     │  → QuestionValidator.assertValidQuestion()
│       (retry/fallback su │     Se fallisce: fallback a mock question
│       errore)            │     (o abort se mock fallback disabilitato)
│    e) Checkpoint         │  → Salva progresso su disco dopo OGNI domanda
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 4. Persisti su disco     │  → data/question-banks/{certificationId}/{bankId}.json
│    (atomic write)        │  → Scrivi temp → rename → conferma
│    Rimuove il checkpoint │  → generation-checkpoint-{certificationId}.json
└─────────────────────────┘
```

### 5.2 Certification Registry — La Fonte della Configurazione

Il `CertificationRegistry` è il cuore del sistema. Per ogni certificazione definisce:

```typescript
{
  id: 'SAP-C02',
  displayName: 'Solutions Architect Professional',
  level: 'professional',
  domains: [
    { id: 'design-solutions-organizational-complexity', percentage: 26 },
    { id: 'design-new-solutions', percentage: 29 },
    { id: 'continuous-improvement-existing-solutions', percentage: 25 },
    { id: 'accelerate-workload-migration-modernization', percentage: 20 },
  ],
  formatDistribution: { singleAnswer4Options: 70, multiAnswer5Options: 20, multiAnswer6Options: 10 },
  totalQuestions: 75,
  timeLimitMinutes: 180,
}
```

Questi dati provengono dalla documentazione ufficiale AWS per ogni esame.

### 5.3 Pianificazione della Sequenza

La funzione `planGenerationSequence` distribuisce le domande rispettando:

1. **Distribuzione per formato**: 
   - single-answer (4 opzioni, 1 corretta): ~70%
   - multi-answer (5 opzioni, 2 corrette): ~20%
   - multi-answer (6 opzioni, 3 corrette): ~10%
   
2. **Distribuzione per dominio**: segue le percentuali specifiche della certificazione (±5 punti percentuali di tolleranza)

3. **Randomizzazione**: i formati e domini vengono mescolati (Fisher-Yates shuffle) per evitare pattern prevedibili

### 5.4 Il Prompt Engineering

Per ogni domanda, il sistema costruisce un prompt strutturato che istruisce Claude a generare:

**Struttura del prompt:**
1. **Ruolo**: "You are an AWS certification exam question writer"
2. **Parametri**: dominio specifico, formato della domanda, numero di opzioni
3. **Contesto documentale**: snippet di documentazione AWS pertinente al dominio
4. **Istruzioni precise**:
   - Scenario di 50-200 parole (architettura realistica)
   - Almeno 2 frasi dichiarative + 1 interrogativa
   - Distrattori che usano servizi AWS reali ma subottimali
   - Spiegazione di 50-300 parole con riferimento a servizi specifici
5. **Formato output**: JSON strutturato con schema predefinito

**Esempio semplificato del prompt:**
```
Domain: Design Solutions for Organizational Complexity
Format: single-answer with 4 options (1 correct)

Reference Documentation:
[snippet di documentazione AWS Organizations...]

Generate a scenario-based question...
Response: JSON only { stem, options, correctAnswers, services, explanation }
```

### 5.5 Contesto Documentale

Il sistema fornisce a Claude un contesto di documentazione AWS pertinente al dominio della domanda da generare. Questo migliora la qualità e la rilevanza delle domande.

**Come funziona:**
1. Per ogni dominio dell'esame, il sistema ha una mappa di topic e servizi AWS rilevanti
2. Seleziona un topic random dal dominio (es. "multi-account strategy" per il dominio organizzativo)
3. Cerca nella documentazione interna per snippet rilevanti
4. Passa gli snippet come contesto al prompt di Claude

**Esempio per SAP-C02, dominio "Design Solutions for Organizational Complexity":**
- Topics: multi-account strategy, cross-account access, AWS Organizations, service control policies
- Servizi: AWS Organizations, Control Tower, IAM, Transit Gateway, VPC, Config

Questo approccio garantisce che Claude generi domande ancorate a servizi e scenari reali, non inventati.

---

## 6. Perché le Domande sono Adatte all'Esame Scelto

Il sistema garantisce la pertinenza delle domande attraverso 5 meccanismi:

### 6.1 Configurazione Specifica per Certificazione

Ogni certificazione ha i propri domini, percentuali, e distribuzione formati presi dalla guida ufficiale AWS. Non è "one size fits all" — le domande SAA-C03 (Associate) coprono domini diversi dalle SAP-C02 (Professional).

### 6.2 Distribuzione Controllata

- **Per dominio**: ogni dominio riceve esattamente la percentuale di domande specificata (±5pp)
- **Per formato**: la distribuzione single/multi-answer rispecchia l'esame reale (±2 domande)
- **Totale esatto**: sempre il numero corretto di domande (75 per SAP-C02, 65 per Associate)

### 6.3 Prompt Domain-Specific

Il prompt a Claude include esplicitamente il dominio e il contesto documentale pertinente. Claude non genera domande generiche — genera domande specifiche per quel dominio con servizi AWS appropriati.

### 6.4 Struttura Fedele all'Esame Reale

Le domande seguono la stessa struttura dell'esame AWS reale:
- **Scenario-based**: ogni domanda inizia con uno scenario architetturale realistico (50-200 parole)
- **Formato interrogativo**: termina sempre con una domanda esplicita
- **Distrattori plausibili**: le opzioni sbagliate usano servizi AWS reali ma in modo subottimale
- **Spiegazione didattica**: ogni domanda ha una spiegazione dettagliata del perché la risposta è corretta

### 6.5 Validazione Per-Domanda

Ogni domanda, subito dopo la generazione, viene verificata da `QuestionValidator.assertValidQuestion()`:
- Struttura corretta (numero opzioni = formato dichiarato, etichette sequenziali A, B, C…)
- Numero di risposte corrette coerente col formato (1 per single-4, 2-3 per multi-5/multi-6)
- Lunghezza di stem (50-200 parole) e spiegazione (50-300 parole)
- Almeno un servizio AWS citato tra quelli dichiarati e presente nella spiegazione

Se la validazione fallisce, la domanda viene sostituita da una generata dal fallback mock (se abilitato) invece di essere scartata silenziosamente. Non esiste al momento una validazione aggiuntiva a livello di intero bank (es. deduplica dominio+servizio tra domande diverse).

---

## 7. Modalità d'Uso

### Exam Mode
- Timer specifico per certificazione (es. 180 minuti per SAP-C02, 130-170 per Associate/Specialty)
- Progress bar che mostra il numero di domanda corrente (es. "Domanda 12 di 75"), non la percentuale
- Indicazione del numero di risposte richieste per ogni domanda (1, 2 o 3)
- Navigazione libera tra le domande
- Mark for Review per tornare alle domande incerte
- Pulsante "Finish" sull'ultima domanda apre una griglia di riepilogo con lo stato di ogni domanda (risposta completa/incompleta/non data, marcata per revisione); da qui si può saltare a qualsiasi domanda o premere "Submit exam"
- Se il timer scade, l'esame viene sottomesso automaticamente (equivalente a premere "Submit exam")
- Pause con salvataggio automatico; qualsiasi sessione interrotta (in corso o in pausa) è ripristinabile o cancellabile dalla landing page
- Al termine, pulsante "Review answers" apre il workspace di revisione con scoring finale e breakdown per dominio

### Study Mode
- Nessun timer
- Indicazione del numero di risposte richieste per ogni domanda (1, 2 o 3)
- Selezione delle risposte seguita dal pulsante esplicito "Check answers": solo dopo averlo premuto vengono rivelate le risposte corrette/errate e la spiegazione (evita reveal prematuro su domande a risposta multipla)
- Il pulsante "Next" compare solo dopo aver premuto "Check answers"
- Score progressivo (corrette/risposte controllate)
- Pause e resume in qualsiasi momento; qualsiasi sessione interrotta è ripristinabile o cancellabile dalla landing page
- Pulsante "Review answers" disponibile una volta controllate tutte le domande

### Review Workspace (entrambe le modalità)
- Filtri: tutte / corrette / errate / incomplete / marcate per revisione
- Le domande senza risposta o con un numero di risposte inferiore a quelle richieste sono segnalate con un banner

### Admin Panel
- Selezione certificazione da generare
- Progress bar durante la generazione
- Lista dei question bank disponibili, ordinabile per data di creazione
- Checkpoint dopo ogni domanda generata (per certificazione); un'interruzione (crash, riavvio, errore) non fa perdere le domande già generate — la generazione successiva riprende automaticamente dal checkpoint

---

## 8. Resilienza e Fault Tolerance

| Scenario | Comportamento |
|----------|--------------|
| Bedrock lento o irraggiungibile | Timeout rigido di 20s per chiamata (+5s di connessione); se abilitato, fallback a domanda mock deterministica |
| Bedrock throttling | Retry automatico (3 tentativi, backoff esponenziale 1s/2s/4s) + inter-request delay di 2s tra ogni domanda |
| Domanda non valida o generazione fallita | Sostituita da una domanda mock (se `BEDROCK_MOCK_FALLBACK=true`), altrimenti l'intero job di generazione fallisce |
| Crash/riavvio del backend durante generazione | Checkpoint dopo ogni domanda (per certificazione); la generazione successiva per la stessa certificazione riprende automaticamente da dove si era interrotta |
| Timer esame scade | Submit automatico dell'esame (equivalente a "Submit exam") |
| Browser chiuso durante esame o studio | Sessione salvata in localStorage, ripristinabile o cancellabile dalla landing page |
| localStorage pieno | Degradazione graceful, nessun errore mostrato |

---

## 9. Costi Operativi

| Modello | Costo per Esame (75q) | Costo per Esame (65q) |
|---------|----------------------|----------------------|
| Claude Sonnet 4.5 | ~$1.50 | ~$1.30 |
| Claude Haiku 4.5 | ~$0.10 | ~$0.09 |

Il costo dipende dalla lunghezza dei prompt e delle risposte. Con prompt di ~1000 token input e ~500 token output per domanda, e i prezzi on-demand di Bedrock.

---

## 10. Stack Tecnologico

| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, React Router v6 |
| Backend | Node.js 22, Express, TypeScript, tsx |
| AI/ML | Amazon Bedrock, Claude Sonnet 4.5 (Anthropic) |
| Auth AWS | AWS SSO / IAM via @aws-sdk/credential-providers |
| Storage | File system (JSON), localStorage (sessioni) |
| Testing | Jest, fast-check (property-based testing) |
| Monorepo | npm workspaces |

---

*Documento generato il 3 Luglio 2026, aggiornato il 6 Luglio 2026*
