---
unique-name: impact-04-constraints
display-name: IMPACT HOW_04 — Constraints
category: GENERAL
description: Vincoli architetturali e tecnologici del sistema.
---

# Constraints - AWS SAP Exam Agent

**Data**: 2026-07-03
**Versione**: 1.0
**Audience**: Team tecnico, architetti, developer

---

## 1. Vincoli di Tempo, Budget e Risorse

Questa sezione riporta solo i vincoli esplicitamente ricavabili o l'assenza di dati affidabili.

### 1.1 Tempo

- Non sono presenti milestone calendarizzate, date di release o finestre temporali contrattuali.
- Il materiale progettuale mostra però una pianificazione per waves e checkpoint, segno di delivery incrementale già strutturata.
- Non è possibile derivare lead time target o time-to-market numerico.

### 1.2 Budget

- **TBD** - nessun budget esplicitato nei documenti.
- Esiste però un vincolo implicito di costo operativo legato all'uso di Amazon Bedrock.
- Il single-generation mutex e il delay di 2 secondi tra richieste limitano anche il consumo burst del provider LLM.

### 1.3 Risorse Umane

- **TBD** - team size non specificata.
- La struttura monorepo e la separazione per package suggeriscono comunque necessità di competenze full-stack TypeScript.
- Non emergono ruoli operativi dedicati a DBA, SRE o platform engineering, coerentemente con l'assenza di database e di deployment complesso documentato.

### 1.4 Vincoli di Capacità Operativa

- Una sola generazione può essere attiva alla volta.
- Il sistema è concepito come single-process.
- Non è documentato supporto a esecuzione distribuita o worker pool.

---

## 2. Vincoli Tecnologici

### 2.1 Linguaggio e Runtime

Il progetto è vincolato a uno stack coerente full TypeScript/Node.js.

**Vincoli espliciti**

- MCP server in TypeScript.
- Backend in Node.js/TypeScript con Express.
- Frontend React SPA in TypeScript con Vite.
- Shared package in TypeScript.

**Implicazioni**

- Le estensioni devono rispettare il modello type-safe end-to-end.
- L'evoluzione cross-layer è facilitata, ma sposta la scelta tecnologica fuori da altri runtime non JavaScript.
- L'omogeneità riduce il context switching ma rende il progetto dipendente dalla toolchain TS/Node.

### 2.2 Dipendenza da Amazon Bedrock

Amazon Bedrock è l'unico provider LLM documentato.

**Vincoli espliciti**

- Modello utilizzato: `eu.anthropic.claude-sonnet-4-5-20250929-v1:0`.
- Accesso tramite Converse API.
- Autenticazione tramite AWS SSO profile (`AWS_PROFILE`).
- Uso di `@aws-sdk/credential-providers`.
- Delay minimo di 2 secondi tra richieste consecutive.
- Cross-region inference profile come decisione architetturale.

**Impatto architetturale**

- Il sistema non è provider-agnostic nel perimetro documentato.
- Prestazioni, costi e disponibilità della generation dipendono da un servizio esterno.
- L'esecuzione locale richiede un ambiente AWS già configurato.

### 2.3 Dipendenza da MCP Protocol

Il recupero del contesto documentale è vincolato a MCP come protocollo di integrazione.

**Vincoli espliciti**

- Uso di `@modelcontextprotocol/sdk`.
- Trasporto `stdio`.
- Interazione tramite JSON-RPC 2.0.
- Tool previsti: `search_by_service`, `search_by_domain`, `search_by_topic`.
- Timeout di 10 secondi per query.
- Retry 3 volte con intervallo di 5 secondi in caso di server non raggiungibile.

**Impatto architetturale**

- L'MCP server è accoppiato strettamente al backend come child process locale.
- Non è documentata una distribuzione indipendente del componente retrieval.
- La qualità delle domande dipende dal grounding ottenuto via MCP.

### 2.4 Storage File-Based

Il persistence layer è limitato a file JSON, senza database relazionale o NoSQL.

**Vincoli espliciti**

- Path di persistenza: `data/banks/{bankId}.json`.
- Ogni bank è un file separato con UUID e timestamp.
- Scrittura atomica tramite pattern temp + rename.
- Le bank esistenti non devono essere modificate o eliminate.
- Caricamento bank entro 5 secondi.

**Limitazioni intrinseche**

- Nessuna transazione ACID multi-entità.
- Nessuna gestione documentata della concorrenza multi-processo.
- Nessuna indicizzazione oltre alla scansione file e metadata disponibili.
- Maggiore attenzione necessaria alla corruzione file, mitigata solo dal write atomico.

### 2.5 Browser Constraints

Una parte significativa dello stato appartiene al browser.

**Vincoli espliciti**

- Session state in `localStorage`.
- Selezione certificazione in `selected_certification`.
- Restore della selezione entro 500ms.
- Save dello stato entro 1s.
- Graceful degradation se `localStorage` non è disponibile.
- Frontend solo SPA, nessun SSR documentato.

**Vincoli operativi tipici del browser**

- Quota `localStorage` tipicamente nell'ordine di ~5-10MB, dipendente dal browser.
- Persistenza locale non condivisa tra device.
- Possibile cancellazione manuale da parte dell'utente.

**Impatto UX**

- Il resume è comodo ma non è una garanzia cross-device.
- La SEO non è rilevante per il caso d'uso e quindi l'assenza di SSR è accettabile.

### 2.6 Constraint di Processo Applicativo

- Single-generation mutex per prevenire job concorrenti.
- Checkpoint ogni 5 domande durante la generation.
- Retry massimo 3 volte per domanda non valida, poi discard.
- Distribuzioni di formato e dominio da rispettare entro tolleranze definite.
- Default SAP-C02 se `certificationId` è omesso.

---

## 3. Sistemi Esistenti e Riuso

Il progetto fa leva su componenti condivisi interni per ridurre duplicazione e incoerenza.

### 3.1 CertificationRegistry come asset esistente

- Risiede nel package `shared`.
- Agisce come single source of truth per certificazioni supportate.
- Espone `getAll()`, `getById()`, `getByLevel()`.
- Supporta raggruppamento per livello e lookup safe con `null` se non trovato.

### 3.2 Shared Types e Schemas

- `Question`, `QuestionBank`, `ExamSession`, `CertificationConfig` sono condivisi.
- Backend e frontend dipendono dagli stessi contratti semantici.
- Gli schema validator riducono il rischio di drift serializzativo.

### 3.3 Pattern e comportamenti già stabiliti

- Backward compatibility su SAP-C02.
- Persistenza locale tramite chiavi note di `localStorage`.
- Pattern di safe handling per storage locale implicito nella graceful degradation richiesta.
- Test helpers condivisi per property-based testing.

### 3.4 Vincolo di Riuso

- Le nuove feature dovrebbero riusare registry, tipi e helper condivisi.
- Duplicare configurazioni certificazione in frontend e backend violerebbe il disegno architetturale corrente.

---

## 4. Standard di Integrazione

### 4.1 Backend API

- Pattern: REST/JSON.
- Endpoint documentati: generate, status, banks, bank by id, certifications.
- HTTP status rilevanti: `202`, `400`, `404`, `409`.

### 4.2 MCP Integration

- Protocollo: JSON-RPC 2.0.
- Trasporto: `stdio`.
- Strumenti esposti come tool MCP.
- Empty result set come comportamento valido quando non esistono match.

### 4.3 LLM Integration

- AWS SDK verso Amazon Bedrock.
- Converse API come standard di invocazione.
- Credenziali risolte tramite provider AWS compatibili con SSO.

### 4.4 Serialization e Validation

- Encoding JSON: UTF-8.
- Validazione schema richiesta per bank e oggetti serializzati.
- Error reporting dettagliato per JSON invalido e schema violation.

### 4.5 Frontend State Interface

- Persistenza via Web Storage API.
- Chiavi storage standardizzate.
- Stato sessione serializzato in forma compatibile con round-trip.

---

## 5. Team Size e Competenze

### 5.1 Team Size

- **TBD** - non specificato nei documenti.

### 5.2 Competenze minime deducibili

- TypeScript full-stack.
- React e React Router DOM.
- Node.js ed Express.
- Integrazione AWS SDK e autenticazione AWS SSO.
- Familiarità con Amazon Bedrock e dinamiche di throttling.
- MCP / JSON-RPC mental model.
- Testing con Jest e fast-check.
- Modellazione JSON schema e serializzazione robusta.

### 5.3 Competenze non evidenziate come necessarie

- DBA dedicato.
- Esperto di orchestrazione Kubernetes.
- Specialista SSR/SEO.
- Team DevOps strutturato, almeno nel perimetro documentato.

---

## 6. Vincoli Legali

### 6.1 Licensing

- Nessuna licenza open-source specifica è documentata nei materiali forniti.
- Il contenuto generato prende contesto dalla documentazione AWS ufficiale.
- Eventuali vincoli di uso della documentazione sorgente non sono dettagliati nel materiale analizzato.

### 6.2 Privacy

- Non è documentata raccolta di dati personali dell'utente finale.
- Lo stato della sessione rimane nel browser dell'utente.
- Non emergono flussi verso database centralizzati di profilo utente.
- Non sono documentati temi GDPR specifici oltre alla natura locale dello stato.

### 6.3 Accessibilità

`[NON VALUTABILE]` - nessun requisito WCAG o accessibility compliance esplicitato.

### 6.4 Log Retention

- I fallimenti delle domande scartate devono essere loggati con ragione.
- Non è specificata una retention policy.
- Non è specificato il luogo di persistenza dei log né il livello di dettaglio strutturato.

---

## 7. Riepilogo Vincoli per Decisioni Architetturali

| Vincolo | Decisione Architetturale | Impatto |
| --- | --- | --- |
| Nessun database documentato | Storage file-based JSON | Semplicità operativa, minore scalabilità |
| Bedrock come unico LLM provider | Integrazione nativa AWS via Converse API | Forte dipendenza esterna, migliore allineamento AWS |
| AWS SSO obbligatorio | Credenziali risolte via `AWS_PROFILE` | Setup locale necessario prima dell'uso |
| MCP via stdio | Child process locale per retrieval docs | Bassa complessità di rete, minore distribuibilità |
| Single-generation mutex | Un job di generation alla volta | Throughput limitato ma comportamento prevedibile |
| Persistenza browser-side | `localStorage` per sessione e selezione | Resume semplice, nessun supporto cross-device |
| Backward compatibility | Default SAP-C02 | Evoluzione non rompe il flusso storico |
| Nessuna user auth completa | Focus su admin auth per generation | Superficie identity ridotta ma esperienza candidato anonima |
| Single-process | Nessuna scalabilità orizzontale documentata | Adatto a tool locale, non a carichi enterprise |
| JSON schema validation | Validazione prima della persistenza | Maggiore integrità dei dati |

---

## Reference Documents

- [00_deep_dive.md](./00_deep_dive.md)
- [01_context.md](./01_context.md)
- [02_functional_overview.md](./02_functional_overview.md)
- [03_non_functional_overview.md](./03_non_functional_overview.md)

## Change Log

| Data | Versione | Autore | Modifica |
| --- | --- | --- | --- |
| 2026-07-03 | 1.0 | GitHub Copilot | Prima emissione del documento Constraints per AWS SAP Exam Agent |
