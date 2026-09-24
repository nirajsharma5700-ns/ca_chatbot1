# CA Assist (CA Chatbot)

CA Assist is a product specification for a conversational assistant focused on general Chartered Accountant topics in India, including income tax, GST, TDS, ITR filing, and accounting. The planned application is a static, responsive Vite + React + TypeScript single-page app hosted on GitHub Pages.

> **Project status:** This repository currently contains the product requirements; the application and deployment workflow described below are planned in [prd.md](prd.md).

> **Disclaimer:** For general information only. Consult a qualified CA for advice.

## Planned features

- Chat interface with message history, a text box, Send action, and Enter-to-send.
- Replies grounded in the conversation and generated with Google's Gemini API using the approved Gemma model.
- CA-focused system instructions and polite redirection for off-topic questions.
- “Thinking...” state, clear errors with retry, and a New chat action.
- Markdown-formatted assistant responses.
- Responsive layout, keyboard navigation, visible focus, and an ARIA live region.
- Persistent general-information disclaimer.

## Technology

- Vite, React, and TypeScript with strict type checking
- Plain CSS and `react-markdown`
- Google Gemini API `generateContent` endpoint
- Fixed model: `gemma-4-26b-a4b-it`
- GitHub Pages deployment through GitHub Actions

The model is fixed in the application; there is no model picker. The design does not include a backend, database, login, stored chat history, uploads, or streaming responses.

## Local development

The planned app requires Node.js 20 and npm. Once its Vite application scaffold and dependencies are in place:

1. Create a Google AI Studio API key.
2. Add it to a root-level `.env.local` file:

   ```dotenv
   VITE_GEMINI_API_KEY=your_google_ai_studio_api_key
   ```

3. Install the project dependencies, then start the Vite development server:

   ```bash
   npm install
   npm run dev
   ```

Never commit `.env.local` or an actual API key. **Important:** Vite embeds `VITE_*` variables in the client bundle, so this key is visible to site visitors even if CI supplies it from a repository secret. Apply provider-side restrictions and quotas to the key. A truly confidential key would require changing the static-only, no-backend architecture in the PRD.

## GitHub Pages deployment

The PRD specifies a GitHub Actions workflow at `.github/workflows/deploy.yml`, triggered by pushes to `main` and manual dispatch. The workflow is intended to install dependencies, lint and type-check, build the site, and deploy the build artifact to GitHub Pages. Configure the repository's Pages source to **GitHub Actions** when the workflow is added.

For the planned workflow, add `GEMINI_API_KEY` under the repository's **Settings → Secrets and variables → Actions → Secrets**. The build passes it as `VITE_GEMINI_API_KEY`; because that value is bundled into browser code, the repository secret protects it only before the build, not after deployment.

The planned Pages URL for this repository is [https://nirajsharma5700-ns.github.io/ca_chatbot1/](https://nirajsharma5700-ns.github.io/ca_chatbot1/) once Pages deployment is configured. The Vite base path must match the repository name (`/ca_chatbot1/`).

## Quality and reliability targets

- First load under 2 seconds on a 4G connection; production bundle under 300 KB gzipped.
- 30-second request timeout and a clear message for HTTP 429 rate limits.
- WCAG 2.1 AA accessibility goals.
- Strict TypeScript with no `any`, a dedicated typed API client, linting, and type-checking before deployment.
- No API key strings committed to source control.

See [prd.md](prd.md) for the complete requirements, acceptance criteria, and deployment design.
