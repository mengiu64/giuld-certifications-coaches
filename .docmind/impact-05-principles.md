---
unique-name: impact-05-principles
display-name: IMPACT HOW_05 — Architectural Principles
category: GENERAL
description: Principi guida: SOLID, DRY, KISS, coding standards, tech selection, build vs buy.
---

# Principles - AWS SAP Exam Agent

**Data**: 2026-07-03
**Versione**: 1.0
**Audience**: Team tecnico, architetti, developer

---

## 1. Principi Architetturali

I principi sotto riportati emergono dalle decisioni di design e dai requirement analizzati. Non sono slogan astratti: sono regole pratiche che spiegano perché il sistema è stato modellato in questo modo.

### 1.1 Single Source of Truth

Il progetto adotta `CertificationRegistry` nel package `shared` come fonte unica per le informazioni di certificazione.

**Applicazione concreta**

- Le certificazioni supportate sono definite una sola volta.
- Backend e frontend leggono gli stessi metadata.
- `QuestionBank` persiste gli stessi riferimenti di certificazione usati in UI.

**Perché è importante**

- Riduce drift tra layer.
- Evita mapping duplicati di `displayName`, `examCode`, `level` e `domains`.
- Semplifica l'aggiunta di nuove certificazioni.

**Anti-pattern da evitare**

- Hardcode di certificazioni nel frontend.
- Tabelle parallele nel backend non allineate al registry.

### 1.2 Backward Compatibility by Default

Il sistema mantiene SAP-C02 come default quando `certificationId` è omesso.

**Applicazione concreta**

- `POST /api/exams/generate` resta compatibile con chiamate legacy.
- I flussi esistenti continuano a funzionare anche prima della multi-certification.
- Il comportamento di default è esplicito e non ambiguo.

**Perché è importante**

- Riduce il costo di adozione delle estensioni.
- Protegge l'investimento fatto sui flussi storici.

### 1.3 Fail-Safe Generation

La generazione deve degradare in modo controllato e privilegiare integrità dei risultati rispetto al volume prodotto.

**Applicazione concreta**

- Retry su MCP e domande fallite.
- Checkpoint ogni 5 domande.
- Atomic write per i file JSON.
- Discard delle domande invalide con log del motivo.

**Conseguenza pratica**

- È preferibile generare lentamente ma in modo affidabile.
- È preferibile perdere una singola domanda piuttosto che corrompere un intero bank.

### 1.4 Separation of Concerns (3-tier)

Il prodotto separa retrieval documentale, orchestrazione agentica e user experience.

**Ripartizione delle responsabilità**

- MCP Server Layer: accesso strutturato alla documentazione AWS.
- Backend Agent Layer: orchestration, validation, persistence, API.
- Frontend Layer: sessione utente, navigazione, review, persistenza browser-side.

**Benefici**

- Minore accoppiamento tra retrieval e UI.
- Testabilità più alta per ciascun layer.
- Evoluzione mirata per componente.

### 1.5 Client-Side State Ownership

Lo stato della sessione appartiene al browser del candidato, non al server.

**Applicazione concreta**

- `exam_session_{id}` e `active_session` vivono in `localStorage`.
- Il resume avviene senza dipendere da sessioni server-side.
- La review può leggere anche risultati persistiti localmente.

**Trade-off accettato**

- Alta semplicità operativa.
- Assenza di sync cross-device.
- Dipendenza dalla disponibilità dello storage locale del browser.

---

## 2. Principi di Design (SOLID, DRY, KISS)

### 2.1 Single Responsibility

Le responsabilità core sono separate in componenti backend dedicati.

**Esempi**

- `ExamAgentController` orchestra il flusso.
- `QuestionGenerator` si occupa della generazione.
- `QuestionValidator` verifica qualità e aderenza ai vincoli.
- `QuestionBankManager` gestisce persistenza e recupero bank.
- `SchemaValidator` controlla integrità serializzativa.

**Effetto desiderato**

- Più facile testare e cambiare un comportamento senza toccare tutti gli altri.

### 2.2 Open/Closed

Il sistema è pensato per estendere il catalogo certificazioni con minimo impatto sul codice esistente.

**Esempi**

- Nuova certificazione = nuovo record di configurazione nel registry.
- API e UI consumano configurazioni senza logica speciale per ogni esame.

**Effetto desiderato**

- Ridurre modifiche invasive per introdurre nuove varianti di esame.

### 2.3 DRY (Don't Repeat Yourself)

Le definizioni comuni non devono essere riscritte in più layer.

**Esempi**

- Tipi condivisi tra frontend e backend.
- Registry condiviso per livelli, codici esame e metadata.
- Test helpers comuni per property-based testing.

**Effetto desiderato**

- Meno bug di serializzazione e meno incoerenza semantica.

### 2.4 KISS

Le scelte tecnologiche privilegiano la soluzione più semplice che soddisfa i requirement.

**Esempi**

- File-based storage invece di un database.
- `stdio` invece di un protocollo remoto più complesso.
- `localStorage` invece di session state server-side.
- SPA React senza SSR.

**Trade-off riconosciuti**

- Meno complessità operativa.
- Meno scalabilità e meno feature enterprise pronte all'uso.

---

## 3. Principi di Sviluppo

### 3.1 Bottom-Up Implementation Order

L'ordine di implementazione segue le dipendenze naturali del sistema.

**Sequenza osservata**

- Shared types e registry.
- Backend API e generation logic.
- Frontend UI e session management.
- Integrazione end-to-end.

**Perché funziona**

- Le fondamenta contrattuali sono definite prima del consumo UI.
- Riduce rework legato a interfacce instabili.

### 3.2 Incremental Validation (Checkpoints)

Il progetto usa checkpoint a due livelli: delivery e generation runtime.

**A livello delivery**

- Checkpoint espliciti per wave di implementazione.
- Verifica graduale di shared, backend, frontend e integration.

**A livello runtime**

- Checkpoint ogni 5 domande durante la generazione.
- Possibilità di limitare il danno di failure parziali.

### 3.3 Correctness Properties First

Le proprietà attese del sistema sono rese esplicite nel design prima di essere usate come safety net di implementazione.

**Evidenze**

- 14 property tests documentati.
- Invarianti su formato domanda, scoring, serializzazione e registry.

**Valore**

- Si testa il comportamento del sistema, non solo esempi puntuali.
- Le regressioni logiche diventano più visibili.

---

## 4. Standard di Codifica

### 4.1 TypeScript Strict Mode

Tutti i package principali usano TypeScript e il design valorizza la type safety.

**Implicazioni pratiche**

- Le interfacce di dominio devono essere modellate in modo esplicito.
- La conversione di `domain` da union type a string è una decisione consapevole per supportare più certificazioni.
- Le modifiche ai modelli dovrebbero propagarsi in modo controllato tra layer.

### 4.2 Interface-First Design

Il package `shared` definisce contratti prima delle implementazioni concrete.

**Applicazione concreta**

- `Question`, `QuestionBank`, `ExamSession`, `CertificationConfig` esistono come primitive condivise.
- UI, API e persistence fanno riferimento agli stessi modelli.

### 4.3 Error Handling Esplicito

Gli errori devono essere rappresentati in modo leggibile e prevedibile.

**Esempi**

- `getById()` restituisce `null` se la certificazione non esiste.
- Le API usano HTTP status appropriati (`400`, `404`, `409`, `202`).
- Le validazioni JSON riportano `line/char`.
- Le schema violation riportano `field + constraint`.

**Principio sottostante**

- Gli errori comuni devono essere dati di dominio o status noti, non eccezioni opache.

---

## 5. Principi di Selezione Tecnologica

### 5.1 Semplicità Operativa

La tecnologia scelta riduce dipendenze infrastrutturali non necessarie.

**Esempi**

- Nessun database da installare o gestire.
- Nessun broker, queue o service mesh documentati.
- Nessuna dipendenza da rendering server-side.

### 5.2 Type Safety End-to-End

La coerenza del dominio è protetta da tipi condivisi e validazioni strutturali.

**Esempi**

- Package `shared` come contratto comune.
- Validation JSON schema prima della persistenza.
- Test di round-trip per oggetti serializzati.

### 5.3 Testabilità by Design

La possibilità di testare non è un effetto collaterale, ma una scelta esplicita.

**Esempi**

- fast-check per generare casi variati.
- Helpers condivisi per costruire dati validi o limite.
- Componenti backend con responsabilità isolate e quindi più mockabili.

### 5.4 LLM Provider Specifico

La scelta del provider privilegia integrazione nativa con l'ecosistema AWS del caso d'uso.

**Motivazioni deducibili**

- Allineamento con il dominio AWS delle certificazioni.
- Uso di Bedrock come access point controllato verso il modello Claude.
- Supporto a cross-region inference profile.

**Effetto collaterale accettato**

- Minore portabilità immediata verso provider alternativi.

---

## 6. Filosofia Build vs Buy

### 6.1 Build

Le capability che definiscono il valore distintivo del prodotto restano interne.

**Componenti da costruire e possedere**

- Question generation logic e prompt orchestration.
- Question validation e quality checks.
- `CertificationRegistry` e configurazione multi-certification.
- Session management exam/study.
- Scoring engine e domain breakdown.
- Review mode e relativi filtri.
- Persistenza question bank file-based.

**Razionale**

- Queste parti incarnano la logica di business del prodotto.
- Demandano poca infrastruttura ma molto dominio applicativo.

### 6.2 Buy/Use

Le capability commodity o platform vengono riutilizzate da tecnologie esistenti.

**Componenti da comprare o usare**

- Amazon Bedrock per il foundation model.
- MCP SDK per il protocollo tool-based.
- AWS SDK per il client Bedrock e il credential flow.
- React per l'interfaccia utente.
- React Router DOM per la navigazione.
- Vite per build del frontend.
- Jest e ts-jest per test runner.
- fast-check per property-based testing.

**Razionale**

- Non c'è vantaggio competitivo nel riscrivere questi componenti.
- Il team può concentrarsi sulle regole d'esame e sulla UX di studio.

---

## 7. Implicazioni Pratiche dei Principi

| Principio | Decisione favorita | Comportamento da evitare |
| --- | --- | --- |
| Single Source of Truth | Aggiungere dati nel registry condiviso | Duplicare metadata certificazione |
| Backward Compatibility by Default | Mantenere SAP-C02 come fallback | Rendere obbligatoria una nuova input senza fallback |
| Fail-Safe Generation | Scartare output invalido e fare checkpoint | Persistire contenuti non validati |
| Separation of Concerns | Tenere retrieval, orchestration e UI separati | Mescolare accesso docs e rendering UI |
| Client-Side State Ownership | Salvare stato sessione nel browser | Introdurre sessioni server-side senza necessità |
| DRY | Riutilizzare tipi e helper shared | Ridefinire modelli in ogni package |
| KISS | Preferire file system e storage locale | Introdurre infrastruttura pesante non richiesta |

---

## Reference Documents

- [00_deep_dive.md](./00_deep_dive.md)
- [01_context.md](./01_context.md)
- [02_functional_overview.md](./02_functional_overview.md)
- [03_non_functional_overview.md](./03_non_functional_overview.md)
- [04_constraints.md](./04_constraints.md)

## Change Log

| Data | Versione | Autore | Modifica |
| --- | --- | --- | --- |
| 2026-07-03 | 1.0 | GitHub Copilot | Prima emissione del documento Principles per AWS SAP Exam Agent |
