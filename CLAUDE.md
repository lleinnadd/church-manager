# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Church management application built with Nuxt 4, Vue 3, Prisma (MongoDB), and Clerk authentication. Manages members, congregations, departments, events, and treasury/finances for a Brazilian church organization. Default locale is `pt-BR`.

## Commands

- **Dev server:** `pnpm dev` (runs on port 3333)
- **Build:** `pnpm build`
- **Lint:** `pnpm lint` / `pnpm lint:fix`
- **Format:** `pnpm format` / `pnpm format:check`
- **Prisma generate:** `prisma generate` (runs automatically on `pnpm install` via postinstall)
- **Commitizen:** `pnpm commit` (conventional commits)

There are no tests in this project.

## Git Hooks (Husky)

- **commit-msg:** runs commitlint (conventional commits required)
- **pre-push:** runs `pnpm lint` then `pnpm build`

Both hooks will block if lint or build fails.

## Architecture

### Frontend (`app/`)

- **Pages:** file-based routing under `app/pages/` — CRUD pages for members, congregations, departments, events, and treasury
- **Components:** organized as `atoms/`, `molecules/`, `organisms/`, plus `ui/` (shadcn-vue with "new-york" style). Non-UI components are auto-imported without path prefix; `ui/` components are excluded from auto-import (imported explicitly)
- **Composables:** auto-imported from `app/composables/**` — includes form models (`forms/use*FormModel.ts`), input masks (CPF, phone, RG, zip code), and data fetching hooks
- **Validation:** Zod schemas in `app/lib/validation/` for client-side form validation; shared schemas in `shared/validation/` are used by both client and server
- **Layouts:** `default` (authenticated app shell) and `auth` (sign-in/sign-up)
- **Middleware:** `auth.global.ts` redirects unauthenticated users to `/auth/sign-in` and auto-provisions member records via `/api/members/ensure`

### Backend (`server/`)

- **API routes:** RESTful endpoints under `server/api/` using Nuxt's file-based routing with method suffixes (e.g., `[id].get.ts`, `index.post.ts`)
- **Prisma singleton:** `server/utils/prisma.ts` — import `prisma` from here in all server code
- **Clerk middleware:** `server/middleware/clerk.ts` protects all `/api/*` routes except `/api/webhook/*`
- **Server utils:** `server/utils/` contains domain logic (event occurrence generation, member numbering, treasury reports, photo/attachment handling via Vercel Blob)

### Shared (`shared/`)

- **Validation schemas:** Zod schemas in `shared/validation/` used by both client forms and server handlers
- **Types:** shared TypeScript types in `shared/types/`

### Key Integrations

- **Auth:** Clerk (`@clerk/nuxt`) — Clerk webhook at `/api/webhook/clerk.post.ts`
- **Database:** MongoDB via Prisma — schema at `prisma/schema.prisma`, config at `prisma.config.ts`
- **File storage:** Vercel Blob (`@vercel/blob`) for member photos and transaction attachments
- **i18n:** `@nuxtjs/i18n` with `pt-BR` (default) and `en` locales, `no_prefix` strategy. Translation files in `i18n/locales/`
- **PDF generation:** `@react-pdf/renderer` (React-based, used server-side for treasury reports)
- **Calendar:** FullCalendar (`@fullcalendar/vue3`) for event display

### UI Stack

- Tailwind CSS 4 with `tw-animate-css`
- shadcn-vue (new-york style, no component prefix) — add components via `npx shadcn-vue@latest add <component>`
- reka-ui as the headless primitive layer
- Lucide icons (`@lucide/vue`)
- vue-sonner for toast notifications

## Code Style

- ESLint with airbnb-extended + prettier + vue plugin
- Prettier: single quotes, trailing commas, 100 char print width, 2-space indent
- Unused vars must be prefixed with `_`
- `no-console` is a warning
- Relaxed lint rules for `app/components/ui/` (shadcn-generated code) and `server/` (allows `for...of`, `continue`, Prisma aggregation underscores)

## Environment Variables

Required in `.env` (see `.env.example`):
- `DATABASE_URL` — MongoDB connection string
- `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `NUXT_CLERK_SECRET_KEY` — Clerk auth
- `NUXT_CLERK_WEBHOOK_SIGNING_SECRET` — Clerk webhook verification
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob for photo/attachment uploads
