# TaxDesk PK — ERP for Tax Consultants in Pakistan

### Part A: Product Overview · Part B: Development Guide for Kiro AI · Part C: AI Document Import & Fast-Return System (OpenAI API)

> **Working name:** TaxDesk PK (change freely).  
> **Important:** Tax rates, slabs, deadlines and section numbers change with every Finance Act. Nothing in this document
> is a hard-coded rule. All tax values must live in a versioned, editable **Tax Rules Library** and be verified by a
> qualified tax professional against the current Finance Act and FBR notifications before release.

---

# PART A — PRODUCT OVERVIEW

## 1. Vision

A multi-client practice-management and tax-computation platform that lets a Pakistani tax consultant (individual or
firm) run every client's yearly tax cycle in one place: collect documents, build the wealth and income picture, compute
tax, find **lawful** savings, prepare return data for IRIS, track notices, and bill the client — with far less manual
typing and far fewer errors.

## 2. Who uses it

| Role                               | Needs                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------- |
| **Firm owner / senior consultant** | Portfolio view, deadlines, team workload, revenue, quality review       |
| **Tax associate / staff**          | Fast data entry, checklists, computation, return preparation            |
| **Client (portal user)**           | Upload documents, answer questions, approve, pay fees, see tax position |
| **Reviewer / admin**               | Approvals, audit log, user and permission management                    |

Client types: salaried individuals, business individuals/sole proprietors, AOPs/partnerships, private limited companies,
property owners, overseas Pakistanis, freelancers/IT exporters, non-profits.

## 3. Problems consultants face today (what we solve)

1. **Scattered client data.** Documents arrive via WhatsApp, email, and photos. Nothing is organized per client per tax
   year.
2. **Manual re-typing.** Salary certificates, bank statements, withholding certificates, and property/vehicle details
   are retyped into IRIS forms.
3. **Wealth statement and reconciliation pain.** Opening wealth + income − expenses − tax = closing wealth must
   reconcile. Mismatches cause notices (unexplained income/assets issues).
4. **Complex, changing law.** Slabs, rebates, credits, withholding rates (filer/non-filer), and deadlines change yearly.
   Staff work from memory or old spreadsheets.
5. **Withholding tax tracking.** Hard to collect and match tax deducted at source (salary, bank profit, utilities,
   vehicles, property, cash withdrawal etc.) against what FBR shows for the client.
6. **Missed deadlines and Active Taxpayer List (ATL) status.** Late filing leads to penalties and higher withholding for
   the client.
7. **Tax planning done ad hoc.** Eligible deductions/credits (e.g. charitable donations, pension fund contributions,
   eligible investments, tax credits) are missed because there is no checklist or scenario comparison.
8. **Notices and audits.** Notices arrive with short response windows and are tracked in email threads.
9. **Multi-client workload.** Peak season (July–September) overloads teams; no task visibility.
10. **Billing and collections.** Fees, advances, and reminders are manual.
11. **Security and trust.** Client CNICs, bank details and passwords are stored insecurely (spreadsheets, chat apps).
12. **Language and device reality.** Many clients are Urdu-first and use phones only.

## 4. The solution: modules

### 4.1 Client & Practice CRM

### 4.2 Smart Document Hub

### 4.3 Tax Year Workspace

### 4.4 Income & Tax Computation Engine

### 4.5 Wealth Statement & Reconciliation

### 4.6 Tax Optimization Advisor

### 4.7 Return Preparation Assistant

### 4.8 Withholding Tax Reconciliation

### 4.9 Notice & Audit Tracker

### 4.10 Compliance Calendar & Automation

### 4.11 Sales Tax & Other Registrations (Phase 3)

### 4.12 Billing & Collections

### 4.13 Client Portal

### 4.14 Analytics

### 4.15 Audit, Security & Admin

_(Full details in the original product brief — see Git history or the attached source document.)_

---

# PART B — DEVELOPMENT GUIDE FOR KIRO AI

See the full brief for tech stack, steering file contents, data model, architecture, feature specs, UX standards, motion
system, and build order.

---

# PART C — AI DOCUMENT IMPORT & FAST-RETURN SYSTEM (OpenAI API)

See the full brief for the end-to-end pipeline, OpenAI integration design, extraction schemas, validation rules, review
experience, privacy/security requirements, and spec starters.

---

_This document is a product and engineering plan. All tax logic must be validated against the current Finance Act and
FBR guidance before release._
