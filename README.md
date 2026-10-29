This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Curriculum Engine (CBSE / NCERT, Classes 6–10)

`src/lib/curriculum/` implements the prerequisite-aware lesson engine:

- `graph/` — Neo4j concept graph: `schema.cypher` (constraints/indexes),
  parameterized `queries.ts`, `repository.ts` (Neo4j + in-memory drivers),
  and `seed-data.json` (sample Class 7 Science slice).
- `textbook/` — NCERT corpus retrieval + §3.2 similarity validator
  (threshold 0.72; TF cosine by default, embeddings via `EMBEDDINGS_API_URL`).
- `prompts.ts` — Templates A (micro-lesson), B (40-min script), C (remediation);
  every instruction block ≤ 200 tokens.
- `engine.ts` — orchestration: prerequisite audit → textbook retrieval →
  generation → similarity validation with one strict retry; batch map-reduce
  per chapter in dependency order.
- `POST /api/curriculum/lessons` — `{ conceptId, learnerMastery? }` →
  strictly-typed lesson payload or structured error payload.

Decisions: blocking gaps are direct (depth-1) hard prerequisites per the §2
schema rule; the depth-3 window is injected context. Seed objectives/corpus
excerpts are illustrative placeholders — replace with verbatim NCF-SE 2023 /
NCERT text before production use.

```bash
cp .env.example .env.local   # memory graph + mock LLM work with zero infra
npm test                     # vitest suite
npm run seed:graph           # load schema + seed data into Neo4j (needs NEO4J_*)
docker compose up -d neo4j   # local Neo4j (browser: http://localhost:7474)
```
