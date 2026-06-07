# ClaimProof SG

ClaimProof SG is a mobile-first evidence app for Singapore freelancers and workers. It helps record work time, project activity, photo evidence, pay summaries, progress claim reports, and dispute support material.

This repository is scaffolded as a TypeScript workspace with:

- `client/`: React, Vite, and Vitest.
- `server/`: Express, Prisma, TypeScript, and Vitest.

## Local Development

Install dependencies:

```bash
npm install
```

Start both workspaces:

```bash
npm run dev
```

Build both workspaces:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Database commands are routed to the server workspace:

```bash
npm run db:migrate
npm run db:seed
```

## Demo Login

Planned seed data will include:

- Email: `demo@claimproof.sg`
- Password: `Password123!`

The demo login will become available after the Prisma schema, migration, and seed task is implemented.

## Scope Notes

V1 focuses on freelancer-owned evidence records. CPF automation, MOM submission, Stripe billing, GPS verification, Work Permit tracking, AI OCR, and AI photo analysis are planned only as placeholders.
