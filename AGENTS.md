# AI Agent Context & Guidelines - PR Request & Leads Automation

## 1. Project Overview & Ecosystem
This repository (`PR-Request`) is part of the **99 Group KPR Operations Suite**.

The ecosystem consists of 3 synchronized operational tools:
1. **PR Request & Leads Automation** (This project)
   - Local path: `d:\Automasi PR Request\web`
   - Production URL: `https://pr-request.vercel.app/`
   - Purpose: Automated PR Excel generation, agent fee agreements (PDF), and Google Drive lead folders synchronization.
2. **Operations Command Center Launchpad (Central Portal)**
   - Production URL: `https://pr-request.vercel.app/portal`
   - Purpose: Centralized launchpad and operational hub for the KPR Ops team. Contains direct cards to all tools, 4-stage operational lifecycle, and direct links to Drive/Sheets.
3. **Mortgage Intelligence Hub**
   - Local path: `D:\Big data Kpr`
   - Production URL: `https://kpr-hub.vercel.app/`
   - Purpose: Daily telesales scorecard, SLA follow-up monitoring, acquisition analytics, and CRM pipeline tracking.
4. **Email Generator KPR**
   - Local path: `D:\Product tim sales`
   - Production URL: `https://email-generator-kpr-99.vercel.app/leads`
   - Purpose: Draft bank submission emails and notify PIC bank contacts.

---

## 2. Cross-Navigation Requirement for AI Agents
To ensure consistent navigation across all apps for the Operations team:
- **Component**: `web/components/AppSwitcher.tsx`
- **Header Integration**: In `web/app/page.tsx`, the header must ALWAYS include:
  1. The "Portal Ops" shortcut button pointing to `/portal`.
  2. The `<AppSwitcher currentApp="pr" />` dropdown menu.
- **Portal Page**: `web/app/portal/page.tsx` must be preserved as the unified Operations portal.
- **Rule for Future Modifications**: When refactoring or redesigning navigation, layouts, or headers, DO NOT remove or break `AppSwitcher` or the Portal link.

---

## 3. Tech Stack & Build Commands
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: `lucide-react`
- **Build**: `npm run build` (inside `web/`)
- **Dev**: `npm run dev` (inside `web/`)
