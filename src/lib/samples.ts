import { Newspaper, Mail, ScrollText, FileSearch, Rocket, LucideIcon } from 'lucide-react'

export interface SampleDoc {
  id: string
  title: string
  description: string
  badge: string
  icon: LucideIcon
  fileName: string
  text: string
}

export const SAMPLE_DOCS: SampleDoc[] = [
  {
    id: 'forests',
    title: 'The Quiet Revolution of Urban Forests',
    description: 'A data-driven feature on how cities became forests — with stats, economics and equity angles.',
    badge: 'Feature · 6 min read',
    icon: Newspaper,
    fileName: 'The Quiet Revolution of Urban Forests.txt',
    text: `The Quiet Revolution of Urban Forests

Across the world's densest cities, an unexpected green renaissance is taking root. From the pocket parks of Seoul to the Miyawaki micro-forests of Paris, urban forestry has shifted from ornamental landscaping to essential public infrastructure. City planners once treated trees as decoration; today they are engineered assets, planted to cool streets, scrub air, and manage stormwater.

The evidence is mounting. A 2024 analysis of 300 metropolitan areas found that neighborhoods with at least thirty percent canopy cover recorded summer temperatures up to 4.6°C lower than canopy-poor districts. Hospital admissions for heat-related illness dropped measurably in tree-lined corridors. Trees are not merely pleasant — they are preventative medicine with a per-capita cost far below most clinical interventions.

The economics are equally compelling. Every dollar invested in urban canopy returns an estimated two to five dollars in avoided energy costs, flood damage, and healthcare expenditure. Singapore now requires a green plot ratio for new developments, and Amsterdam calculates tree value in mortgages. Real estate adjacent to mature canopy commands a premium of twelve to seventeen percent in most markets studied.

Yet the revolution faces headwinds. Critics argue that dense planting competes with housing density and transit investment. Maintenance budgets lag behind planting ambitions — a planted sapling is forty years of commitment, and many municipalities celebrate ribbon cuttings while the trees quietly die of drought within five years. Achieving survival rates above eighty percent requires irrigation contracts, soil remediation, and community stewardship programs, not just photo opportunities.

Equity remains the sharpest challenge. Affluent districts enjoy lush boulevards while low-income neighborhoods bake, a pattern researchers call the luxury effect. Cities that pair planting with community employment — training local residents as tree stewards — report both higher survival rates and measurable economic uplift. The forest, in other words, is not just an ecosystem but an economic engine and a justice project.

The next decade will decide whether urban forests remain a novelty or become permanent civic infrastructure. The tools exist: species selection algorithms, drone-assisted monitoring, and payment systems that reward verified canopy growth. What is required now is political will and patient funding. Cities that get this right will be cooler, healthier, and more humane places to live. Those that do not will pay for the heat — in lives and in money — one summer at a time.`,
  },
  {
    id: 'launch',
    title: 'Internal Memo: Project Northlight',
    description: 'A product-launch memo from a VP of Product — strategy, risks, timelines and asks.',
    badge: 'Workplace · Product launch',
    icon: Rocket,
    fileName: 'Project Northlight - Launch Memo.txt',
    text: `MEMORANDUM — Project Northlight

From: Priya Raman, VP of Product · To: Executive Staff and Team Leads
Date: October 21, 2026 · Re: Launch plan for the Northlight onboarding overhaul

Team — after two quarters of research, Northlight is ready to ship. This memo covers the why, the what, and the asks.

Why now. Activation is the single largest lever we have. Today, 44% of signups never complete workspace creation, and activated teams are 3.2x more likely to convert to paid. Our research shows three compounding failures: setup feels bureaucratic, value is not demonstrated fast enough, and invites stall when the admin is a solo user.

What we are shipping. (1) A redesigned three-minute onboarding flow with sensible defaults for the eighty most common use cases. (2) An AI setup assistant that drafts a sample project from the user's role — this alone lifted completion by 11 points in staged rollout. (3) Instant team invites via magic link, with no admin approval required for the first five seats.

Timeline. Beta opens November 10 with 2,000 design partners. GA is December 1, gated on two exit criteria: activation above 58% and support tickets per new account below 0.4. A two-page rollback plan is attached; if either metric craters we revert within four hours.

Risks. Sales fears the assistant cannibalizes services revenue — mitigated by positioning Northlight as first-mile only. Engineering flags prompt-injection exposure in the role field; we are adding input sandboxing and output filters before beta. Support has asked for three extra headcount for the first six weeks; approved from the transformation budget.

Asks of this group. Sales: communicate the pricing grandfathering clearly — annual lock-ins before December 1 keep legacy rates for 24 months. Marketing: the launch narrative is "from signup to shipped in three minutes." Customer success: seed the partner program with your ten healthiest accounts before November 10.

Northlight is the clearest path to making self-serve our primary growth engine. Your feedback on the beta cohort selection is welcome by October 30. — Priya`,
  },
  {
    id: 'kabuki',
    title: 'A Field Guide to Reading Research Papers',
    description: 'A warm, practical essay on how to read papers without drowning — three-pass method included.',
    badge: 'Essay · Learning',
    icon: ScrollText,
    fileName: 'A Field Guide to Reading Research Papers.txt',
    text: `A Field Guide to Reading Research Papers

Every graduate student eventually confesses the same secret: they do not really read papers. They skim the abstract, nod at figure one, and file the PDF under "read later," where it joins a graveyard of a thousand good intentions. Reading a research paper well is a skill, and like all skills it has a method.

The most reliable approach is the three-pass method. On the first pass, spend five minutes deciding whether the paper deserves a second pass. Read the title, abstract, introduction, section headings, and conclusion. Do not touch the math. At the end you should know the paper's contribution, category, and whether its results appear robust at a glance.

The second pass devotes about an hour to understanding the content — not the proof details. Note the figures: who votes for what, and does the caption match the claim in the text? Flag unfamiliar citations; they are your reading list. Most papers only survive this pass honestly if they solve a problem you actually care about.

The third pass is a full reconstruction. Close the paper. Imagine you are the author. Can you reproduce the experimental setup? Where would you attack the assumptions? This is the level deep reading that reviewers perform, and it is the level at which you actually learn to do research. You may never need to do it for most papers — and that is the point. The method is a triage system, not a virtue.

Two common traps deserve warnings. The first is equation paralysis: believing you must understand every line before you may proceed. In most empirical papers, the key insight lives in one table and two sentences of prose. Find those first. The second is citation name-dropping — citing a paper you have only abstract-read, which is how entire subfields inherit each other's errors.

Read actively. Keep a paper notebook. Write one sentence per paper in your own words: "The authors show X, using Y, which matters because Z." Six months later, that notebook will be worth more than the thousand unopened PDFs. Reading is not about finishing papers. It is about building a map of what is known — one deliberate pass at a time.`,
  },
  {
    id: 'q3',
    title: 'Customer Discovery Notes — Batch 14',
    description: 'Raw-ish synthesis from 22 customer interviews for a workflow automation product.',
    badge: 'Research · Synthesis',
    icon: FileSearch,
    fileName: 'Customer Discovery Notes - Batch 14.txt',
    text: `CUSTOMER DISCOVERY SYNTHESIS — BATCH 14 (22 interviews, September 2026)

Segment coverage: 9 operations managers, 6 founders, 4 finance leads, 3 IT directors. Companies 15–400 employees, all using at least two of Slack, spreadsheets, and a ticketing tool.

What keeps showing up. Seventeen of twenty-two participants described the same failure mode in different words: "the work lives between the tools." Status updates are copy-pasted between systems. Nobody trusts the dashboard. People keep private spreadsheets because the shared one is always stale. One ops manager called it "flying a plane while rebuilding the engine."

Trigger events. Budget approvals for automation usually follow one of three triggers: a painful audit, a high-profile dropped ball, or a new hire who asks "why do we do it this way?" Cold outbound on the topic lands flat; warm referrals from peers who lived the pain convert at 4x.

Objections in their own words. Security review is the long pole — three deals stalled on data residency questions we answer on page two of the security doc, which nobody reads. Price opacity causes distrust: two finance leads explicitly said they assume we are expensive because the site hides pricing. Integration breadth matters less than depth on the top three tools.

Surprises. Founders underestimate how much manual triage costs them until they log a week. Finance leads care more about approval latency than about audit trails, which inverts our messaging. IT directors want a sandbox tenant more than any new integration — they get budget approved for pilots they can test quietly.

Requests ranked by frequency: approval-latency reporting (14 mentions), one-click audit exports (11), sandbox environment (9), Slack-native summaries (8), granular role templates (6).

Bottom line: lead with the cost of the invisible work. Show time, not features. Get the security one-pager into the first email, and test pricing visibility with the next campaign cohort.`,
  },
  {
    id: 'ml',
    title: 'Introduction to Retrieval-Augmented Generation',
    description: 'A dense technical explainer of RAG — chunking, embeddings, retrieval, and evaluation.',
    badge: 'Technical · ML',
    icon: Mail,
    fileName: 'Introduction to Retrieval-Augmented Generation.txt',
    text: `Introduction to Retrieval-Augmented Generation

Retrieval-Augmented Generation (RAG) has become the default architecture for grounding large language models in private knowledge. The pattern is deceptively simple: instead of asking the model to recall facts, you retrieve relevant documents at query time and condition the generation on them. In practice, the craft lives in the retrieval layer.

The pipeline begins with ingestion. Documents are parsed, cleaned, and split into chunks — typically 300 to 800 tokens with 10 to 20 percent overlap. Chunking is the most underrated decision in the stack: split on semantic boundaries (headings, paragraphs) rather than raw token counts, and preserve metadata like source, page, and section so the generator can cite.

Each chunk is embedded into a dense vector — a few hundred to a few thousand dimensions — using a bi-encoder model. At query time, the user's question is embedded with the same model, and approximate nearest neighbor search returns the top-k chunks. Hybrid retrieval, which fuses dense vectors with sparse keyword search (BM25), consistently beats either method alone, particularly on exact-match queries like product codes and acronyms.

The retrieved context is then assembled into a prompt, with careful attention to ordering: placing the most relevant chunks at the beginning and end of the context mitigates the lost-in-the-middle effect, where models under-attend to information in the middle of long contexts. Good prompts instruct the model to answer only from context and to say "I don't know" otherwise — a refusal is a feature, not a bug.

Evaluation is where most RAG systems fail quietly. Faithfulness, answer relevance, and context precision should be measured on a fixed question set, not judged by vibes. Frameworks like RAGAS automate this with model-graded rubrics. Track hallucination rate per release, exactly as you would track test coverage.

The failure modes are predictable: retrieval misses (the right chunk was never fetched), distractor chunks (topically similar but wrong), and generation drift (the model ignores context it was given). Fix them in that order. RAG is not magic — it is information retrieval wearing a language-model coat. Teams that respect the retrieval half of the name ship systems users trust.`,
  },
]

export function getSampleById(id: string): SampleDoc | undefined {
  return SAMPLE_DOCS.find(s => s.id === id)
}
