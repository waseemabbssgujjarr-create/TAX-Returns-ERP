---
inclusion: always
---

# TaxDesk PK — Product Principles

Reference document: `#[[file:docs/product-brief.md]]`

## Core Principles

1. **Deterministic tax engine; AI is assistive only.**  
   Never let an LLM calculate final tax figures. The computation engine is a pure function driven by the versioned rules
   library. AI reads documents and suggests; rules compute; humans approve.

2. **Every computed number is explainable and traceable.**  
   Each output must link to: the rule version it used, the source inputs, and a human-readable explanation trail ("why
   this amount"). The UI must always offer an "Explain this number" path.

3. **Human confirmation for all extracted and return data.**  
   Data extracted by OCR/AI is a draft until a staff member confirms it. Return data is a draft until the consultant
   approves it. No extracted value flows directly into a filed return without a human review step.

4. **Multi-tenant: strict data isolation.**  
   A firm sees only its own data. Clients see only their own data. Every query is scoped by `firmId`. Enforce with
   Postgres row-level security and test it in every integration test.

5. **Phone-first for the client portal; keyboard-first for staff.**  
   The portal must work on a mid-range Android over 4G. The staff app must reward power users with keyboard shortcuts,
   command palette, and dense layouts. Both share the same design system.

6. **Urdu (RTL) and English from day one.**  
   Use logical CSS properties everywhere. Every user-facing string goes through the i18n layer. Never hard-code display
   text in components.

7. **Ethics: lawful planning only.**  
   The product supports compliance and legitimate tax planning. Built-in guardrails must reject advice patterns that
   conceal income, flag suspicious entries, and always display a disclaimer that results require professional review.
   The consultant remains legally responsible.

8. **No hard-coded tax values — ever.**  
   Rates, slabs, thresholds, section numbers, and deadlines live in `/packages/rules/<taxYear>/`. If rules are missing
   for a tax year, show "Rules not available" rather than guessing.

9. **Money is never a float.**  
   Use integer paisa or a decimal library for all monetary values. Rounding rules are explicit per computation step.

10. **Privacy and consent.**  
    Client consent for AI processing is stored per client. A per-client "AI off" switch must always fall back to manual
    or local processing.
