---
unique-name: impact-01-context
display-name: IMPACT HOW_01 — Context Definition
category: GENERAL
description: Context definition: elevator pitch, scope, C4 Level 1, dipendenze sistemiche.
---

# Contesto - AWS SAP Exam Agent

**Data**: 2026-07-03
**Versione**: 1.0
**Audience**: Stakeholder tecnici e non tecnici, team di sviluppo, architetti

---

## 1. Di Cosa Tratta Questo Progetto?

### 1.1 Dominio Applicativo

AWS SAP Exam Agent opera nel dominio della **certification preparation** e del **self-study assistito da AI**. Il focus primario è la simulazione e la pratica d'esame per certificazioni AWS, con particolare attenzione alla qualità delle domande, alla coerenza con i blueprint ufficiali e alla capacità di fornire spiegazioni utili al ripasso.

Il sistema non nasce come repository statico di quiz precaricati. È invece un generatore AI-powered che crea question bank on demand, sfruttando un Large Language Model e un layer di accesso strutturato alla documentazione AWS. Questo posiziona il progetto a metà tra un learning tool e un agent system specializzato in educational content generation.

Ambiti applicativi toccati:

- Exam practice per certificazioni AWS.
- Reinforcement learning individuale tramite study mode.
- Review assistita degli errori e delle aree deboli.
- Supporto operativo ad amministratori che rigenerano e aggiornano i set di domande.

### 1.2 Purpose Statement

Lo scopo del progetto è consentire a candidati AWS e amministratori di generare, gestire e utilizzare esami practice realistici e adattabili a più certificazioni, mantenendo un equilibrio tra velocità di generazione, grounding tecnico e semplicità operativa.

In forma sintetica:

> Fornire un tool locale/self-service che generi esami practice AWS in modo AI-powered, supporti sessioni d'esame e studio, e offra spiegazioni contestualizzate senza dipendere da un database statico di domande.

Obiettivi impliciti:

- Ridurre il tempo necessario per creare materiale practice di qualità.
- Aumentare la varietà dei set di domande disponibili.
- Coprire certificazioni multiple tramite configurazione centralizzata.
- Offrire un'esperienza d'uso resiliente anche con refresh del browser e sessioni interrotte.

### 1.3 Tipo di Sistema

Classificazione del sistema:

- **Tool per self-study**
- **AI-powered exam generator**
- **B2C/Internal tool**
- **Monorepo full TypeScript**
- **Sistema a 3 tier con componente agentica**

Non è, sulla base dei documenti:

- Un SaaS enterprise multi-tenant.
- Una piattaforma LMS completa.
- Un sistema di e-commerce o subscription management.
- Un portale con gestione utenti avanzata.

Il sistema va quindi interpretato come un prodotto focalizzato, con esperienza utente diretta e architettura pragmatica, progettato per essere efficace nel suo perimetro specifico.

---

## 2. Scope del Sistema

### 2.1 Core Features (3-5 bullet)

- Generazione AI-powered di question bank practice per certificazioni AWS tramite Amazon Bedrock e retrieval documentale via MCP.
- Erogazione di sessioni exam e study con timer, navigazione, mark for review, scoring e feedback.
- Supporto multi-certification tramite `CertificationRegistry` condiviso tra backend e frontend.
- Persistenza locale di question bank su file JSON e di session state utente su `localStorage`.
- Interfaccia amministrativa per attivare la generazione e monitorarne lo stato di avanzamento.

### 2.2 In Scope

Funzionalità chiaramente incluse nel perimetro:

- Generazione di esami practice per più certificazioni AWS.
- Uso di un backend agentico per orchestrare retrieval, generation, validation e persistence.
- Query strutturate alla documentazione AWS tramite MCP server dedicato.
- Supporto ai formati domanda single-4, multi-5 e multi-6.
- Gestione question bank persistite su filesystem.
- Selezione certificazione lato utente con persistenza su browser.
- Sessioni timed exam con auto-submit.
- Study mode con feedback immediato e running score.
- Review mode con filtri e spiegazioni.
- Admin UI per trigger di generazione.
- Validazione delle domande generate e controllo di schema.
- Backward compatibility su flussi esistenti con default SAP-C02.

### 2.3 Out of Scope

Elementi esplicitamente o implicitamente fuori scope rispetto ai documenti:

- Pagamenti, billing, subscription o monetizzazione.
- Gestione utenti multipli con profili persistenti completi.
- Database relazionale o data warehouse.
- Deploy cloud enterprise formalizzato.
- Mobile app nativa.
- Marketplace di contenuti o authoring collaborativo.
- SSO utente applicativo per candidati.
- Reportistica manageriale avanzata.
- Analytics centralizzate multiutente.
- CI/CD enterprise-grade documentata.

### 2.4 System Boundaries

Confine logico del sistema:

**Dentro il sistema**

- Frontend SPA React.
- Backend Express / Exam Agent.
- MCP server per AWS docs retrieval.
- Shared package di modelli e registry.
- File JSON delle question bank.
- Session state lato browser.

**Fuori dal sistema ma dipendenze operative**

- Amazon Bedrock come provider LLM.
- AWS SSO profile / credenziali locali verso AWS.
- Fonti documentali AWS raggiunte tramite MCP layer.
- Browser dell'utente e suo storage locale.

**Fuori dal sistema e fuori scope**

- Identity platform enterprise.
- Database server esterno.
- Sistemi di pagamento.
- Infrastruttura di deployment gestita.
- Sistemi CRM/LMS esterni.

Rappresentazione sintetica dei boundary:

- Il sistema possiede la logica applicativa e la UX.
- La capacità generativa dipende da Bedrock.
- La qualità del grounding dipende dal retrieval documentale via MCP.
- La persistenza dura nel tempo ma resta locale e file-based.

---

## 3. Contesto Organizzativo e Sistemico

### 3.1 Processo Business

Il processo business supportato è lineare e centrato sulla preparazione all'esame:

1. Un amministratore avvia la generazione di una nuova question bank per una certificazione.
2. Il backend recupera contesto tecnico dalla documentazione AWS tramite MCP.
3. Il backend invoca Bedrock per produrre domande, opzioni, risposte corrette e spiegazioni.
4. Le domande vengono validate e persistite su file JSON.
5. Il candidato seleziona la certificazione desiderata nel frontend.
6. Il candidato avvia una sessione exam o study utilizzando una bank disponibile.
7. Il sistema salva localmente lo stato della sessione.
8. Al termine, il candidato riceve score, breakdown e review dettagliata.

Valore del processo:

- Trasforma documentazione tecnica e capacità LLM in materiale di studio fruibile.
- Riduce il lavoro manuale di preparazione delle domande.
- Mantiene un ciclo corto tra generazione contenuto e utilizzo da parte dell'utente finale.

### 3.2 Landscape Sistemico

#### Sistemi upstream

Sistemi o fonti che alimentano il comportamento del prodotto:

- **Amazon Bedrock**
  - Fornisce il modello generativo utilizzato per creare contenuti d'esame.
- **AWS Documentation Sources**
  - Alimentano il grounding tecnico delle domande via MCP server.
- **AWS SSO profile / configurazione locale AWS**
  - Permette l'accesso autorizzato ai servizi Bedrock.
- **Configurazione condivisa in `CertificationRegistry`**
  - Agisce come fonte interna di verità per certificazioni, domini e formati.

#### Sistemi downstream

Destinazioni dell'output prodotto dal sistema:

- **Candidato AWS**
  - Consuma question bank, sessioni, risultati e spiegazioni.
- **Amministratore**
  - Usa stato generazione e question bank come output operativo.
- **Filesystem locale**
  - Riceve gli artifact persistiti (`data/banks/*.json`).
- **Browser localStorage**
  - Riceve sessioni attive, risultati e preferenze di selezione certificazione.

#### Sistemi integrati

Sistemi con integrazione diretta o fortemente accoppiata:

- Frontend React SPA.
- Backend Express.
- MCP server TypeScript via stdio JSON-RPC 2.0.
- Amazon Bedrock Converse API.
- localStorage del browser.

Lettura architetturale del landscape:

- Il sistema ha poche integrazioni ma tutte essenziali.
- Le dipendenze non sono numerose, tuttavia sono high-impact.
- Il contesto è più simile a un tool specialistico che a un enterprise integration hub.

### 3.3 Organizational Context

Dai documenti il contesto organizzativo appare leggero e focalizzato sul delivery tecnico più che sulla governance di piattaforma.

Elementi deducibili:

- Il team ha prodotto requirements, design e task breakdown strutturati.
- Le feature core risultano completate, suggerendo una roadmap relativamente chiara.
- La soluzione sembra pensata per uso pratico immediato, non per complessità organizzativa elevata.

Stakeholder plausibili:

- Candidati AWS che vogliono esercitarsi.
- Amministratori o maintainer del contenuto practice.
- Team di sviluppo responsabile di backend, frontend e integrazione AI.
- Architetti o reviewer interessati alla sostenibilità tecnica del pattern agent-based.

Contesto organizzativo sintetico:

- Bassa formalizzazione enterprise.
- Alta focalizzazione sul valore diretto del prodotto.
- Moderata dipendenza da competenze AWS e LLM integration.

---

## 4. Utenti e Attori

### 4.1 Tipologie Utenti

#### 1. Candidato AWS

Profilo:

- Utente principale del sistema.
- Usa il prodotto per preparazione individuale.
- Può essere interessato a diverse certificazioni AWS.

Obiettivi:

- Ottenere question bank pertinenti.
- Simulare l'esame in condizioni realistiche.
- Ricevere feedback su errori e aree deboli.
- Riprendere una sessione interrotta senza perdere progresso.

Interazioni principali:

- Seleziona una certificazione.
- Avvia exam mode o study mode.
- Risponde alle domande.
- Consulta review e score finale.

#### 2. Amministratore

Profilo:

- Utente tecnico o semi-tecnico responsabile della generazione dei contenuti.
- Ha accesso alle funzioni di avvio generazione.

Obiettivi:

- Generare nuove bank per le certificazioni supportate.
- Monitorare lo stato di generazione.
- Assicurare che il sistema disponga di contenuti aggiornati o rigenerati.

Interazioni principali:

- Accede all'Admin UI.
- Triggera `POST /api/exams/generate`.
- Consulta `GET /api/exams/generate/status`.

#### 3. Maintainer / Sviluppatore

Profilo:

- Responsabile dell'evoluzione del sistema.
- Interviene su codice, configurazione, test e troubleshooting.

Obiettivi:

- Mantenere la pipeline generativa affidabile.
- Aggiornare registry certificazioni e modelli dati.
- Migliorare qualità, osservabilità e scalabilità.

### 4.2 Attori Tecnici

#### Frontend SPA

- Attore software che gestisce interazione utente, routing e persistenza locale.

#### Backend Exam Agent

- Attore software centrale.
- Orchestration hub di generation, validation, persistence e serving.

#### MCP Server

- Attore tecnico dedicato al retrieval documentale strutturato.
- Espone capacità di query semantica/tematica verso AWS docs.

#### Amazon Bedrock

- Attore esterno di AI inference.
- Fornisce il foundation model per la generazione delle domande.

#### File System Locale

- Attore infrastrutturale per la persistenza delle bank.

#### Browser localStorage

- Attore infrastrutturale lato client per session continuity e recovery.

---

## 5. Business Value e Obiettivi

Business value principale:

- Consentire la creazione e l'uso di practice exam AWS in modo rapido, flessibile e potenzialmente aggiornabile.

Valori generati dal sistema:

1. **Velocità di produzione contenuti**
   - La generazione AI-powered riduce il costo manuale di costruzione di set di domande.

2. **Varietà e adattabilità**
   - Le bank possono essere rigenerate e adattate per certificazioni differenti.

3. **Migliore esperienza di studio**
   - Exam mode, study mode e review mode coprono diverse esigenze di apprendimento.

4. **Coerenza configurativa**
   - Il registry condiviso riduce inconsistenze tra backend e frontend.

5. **Resilienza operativa pragmatica**
   - Checkpoint, mutex e localStorage rendono il sistema più robusto nel contesto locale.

Obiettivi di prodotto deducibili:

- Fornire un'esperienza di simulazione credibile per esami AWS.
- Mantenere alta la qualità tecnica percepita delle domande.
- Supportare più certificazioni senza duplicare logica applicativa.
- Restare semplice da installare, comprendere e usare.

Obiettivi architetturali deducibili:

- Separare retrieval, generation e presentation.
- Evitare dipendenze pesanti come un database relazionale non necessario.
- Favorire riuso di tipi e configurazioni tramite package shared.
- Garantire backward compatibility su flussi esistenti.

---

## 6. Rischi e Dipendenze Critiche

### Dipendenze Critiche

#### 1. Amazon Bedrock

Perché critica:

- È il motore di generazione del sistema.
- Senza accesso a Bedrock il prodotto perde la sua capability distintiva principale.

Rischi associati:

- Throttling.
- Disponibilità del servizio.
- Costi di utilizzo.
- Variazione nel comportamento del modello.

Mitigazioni note:

- Delay di 2 secondi tra chiamate.
- Validazione e orchestrazione backend.

#### 2. AWS MCP Documentation Access

Perché critica:

- Il sistema dipende dal grounding tecnico verso documentazione AWS.
- La qualità delle domande è influenzata dalla qualità del contesto recuperato.

Rischi associati:

- Retrieval incompleto o poco pertinente.
- Dipendenza da un layer MCP custom da mantenere nel tempo.
- Possibili disallineamenti tra documentazione e output del modello.

#### 3. File-Based JSON Storage

Perché critica:

- È l'unico persistence layer server-side documentato.

Rischi associati:

- Limitata scalabilità.
- Concorrenza limitata.
- Gestione complessa di metadata crescenti o auditing.
- Possibile fragilità in scenari multiutente.

Mitigazioni note:

- Atomic write con temp + rename.
- Single-generation mutex.
- Checkpoint periodici.

#### 4. localStorage per Session State

Perché critica:

- La user experience di ripresa sessione dipende dal browser locale.

Rischi associati:

- Dati confinati a browser/device specifico.
- Cancellazione storage o cambio browser.
- Assenza di sync cross-device.

#### 5. Assenza di CI/CD documentata

Perché critica:

- Rende meno visibile il livello di automazione del processo di quality assurance.

Rischi associati:

- Regressioni non intercettate in modo consistente.
- Maggiore effort manuale di validazione.
- Scalabilità limitata del processo di sviluppo.

### Rischi di Contesto

- Evoluzione delle certificazioni AWS che richiede aggiornamento del registry e dei prompt.
- Possibile mismatch tra blueprint d'esame reali e contenuti generati.
- Mancanza di user identity che limita storicizzazione e personalizzazione.
- Potenziale overload se il tool venisse esteso oltre l'uso locale previsto.

### Lettura Complessiva del Rischio

Il profilo di rischio è coerente con un tool specialistico locale: basso rischio infrastrutturale tradizionale, ma alta dipendenza funzionale da pochi componenti esterni chiave e da alcune scelte pragmatiche che non scalano bene oltre il perimetro attuale.

---

## Reference Documents

- Deep Dive Analysis: 00_deep_dive.md

---

## Change Log

| Versione | Data | Autore | Modifiche |
| --- | --- | --- | --- |
| 1.0 | 2026-07-03 | IMPACT HOW Pipeline | Creazione documento iniziale |
