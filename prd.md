PRD: CA Assist, Chartered Accountant Chatbot on GitHub Pages
Date: Sep 24, 2026 | Author: Ruthran Raghavan
Overview and goals
CA Assist is a production-ready conversational assistant that answers Chartered Accountant queries on Indian income tax, GST, TDS, ITR filing and accounting. It ships as a static Vite + React + TypeScript single-page application, released to GitHub Pages through an automated GitHub Actions CI/CD pipeline on every push to main.

Deliver a reliable, domain-scoped assistant with consistent, professional responses.
Standardise on Google AI Studio with gemma-4-26b-a4b-it as the single approved model.
Zero-touch build and release with no infrastructure to manage.
Modular, strictly typed, maintainable codebase.
Users and use cases
The primary user is an individual or small business owner in India with a quick tax or accounting question.

"What is the due date for filing ITR for salaried individuals?"
"Which ITR form should I use for freelance income?"
"When do I need to register for GST?"
"How is TDS on rent calculated?"
"What deductions are available under Section 80C?"
Functional requirements
ID
Requirement
FR-1
Chat window with message list, text input and Send button (Enter also sends).
FR-2
Each user message is sent to Gemma via the Google AI Studio (Gemini API) generateContent REST endpoint with the full conversation history.
FR-3
A fixed system prompt makes the bot act as a Chartered Accountant focused on Indian tax, GST, TDS and accounting.
FR-4
Off-topic questions get a polite refusal that redirects to CA topics.
FR-5
Show a "Thinking..." indicator while waiting for a reply.
FR-6
Show a clear, user-safe error message with a Retry action if the API call fails or times out.
FR-7
Render bot replies as Markdown (lists, bold, tables).
FR-8
Persistent footer disclaimer: "For general information only. Consult a qualified CA for advice."
FR-9
"New chat" button clears the conversation.
FR-10
Responsive layout that works on mobile and desktop.

Non-functional requirements
Area
Requirement
Performance
First load under 2 s on 4G; production bundle under 300 KB gzipped.
Reliability
30 s request timeout; handles HTTP 429 rate-limit responses with a clear message.
Accessibility
WCAG 2.1 AA: full keyboard navigation, visible focus, ARIA live region for new replies.
Code quality
TypeScript strict mode, ESLint, a dedicated typed API client module, no any.
Security
API key supplied only through a CI secret; no secrets in source control.
Compliance
Answers limited to general information, with a persistent disclaimer.

Tech stack and model constraints
The model is fixed: gemma-4-26b-a4b-it via the Gemini API, with a key created at Google AI Studio. No other model or provider may be used.

Layer
Choice
Framework
Vite + React + TypeScript
Styling
Plain CSS (no UI library)
Markdown rendering
react-markdown
LLM
gemma-4-26b-a4b-it (Gemma 4 26B A4B IT)
API
https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent, called with fetch
API key
Created at Google AI Studio API keys page
Hosting
GitHub Pages
CI/CD
GitHub Actions


The model name lives in one constant; no model picker in the UI.
System prompt is passed as systemInstruction in the request body.
No backend, database or server code.

Source: Gemma on the Gemini API
Configuration and deployment
The API key is stored as a GitHub Actions repository secret and injected at build time; it is never committed to the repo.

Setting
Where
Value
GEMINI_API_KEY
Repo Settings > Secrets and variables > Actions > Secrets
Key from Google AI Studio
VITE_GEMINI_API_KEY
Workflow build step env
${{ secrets.GEMINI_API_KEY }}
base
vite.config.ts
/<repo-name>/
Pages source
Repo Settings > Pages
GitHub Actions

flowchart LR

  A[Push to main] --> B[Checkout + Node 20]

  B --> C[npm ci]

  C --> D[Lint + type-check]

  D --> E[npm run build<br/>with VITE_GEMINI_API_KEY]

  E --> F[Upload dist artifact]

  F --> G[Deploy to GitHub Pages]

A failed lint or type-check stops the pipeline before deployment.

The build job uses actions/checkout, actions/setup-node, actions/configure-pages and actions/upload-pages-artifact; the deploy job uses actions/deploy-pages.
Non-goals and acceptance criteria
Non-goals: user login, chat history storage, file or document upload, streaming responses, backend or serverless functions, and any model other than gemma-4-26b-a4b-it.

npm run dev runs the chatbot locally using .env.local.
A push to main triggers the workflow and it finishes green.
The site loads at https://<username>.github.io/<repo-name>/ with no broken assets.
Asking "What is the ITR filing due date for salaried individuals?" returns a relevant CA-style answer.
Asking an off-topic question (for example, a recipe) returns a polite redirect.
The disclaimer is visible on every screen size.
No API key string appears in any committed file.