# Docent · Document Analysis Studio

> Fast, chat-style document intelligence powered by Groq LPUs. Drop in any PDF or text file and get instant summaries, key takeaways, topical keywords, sentiment analysis, document statistics, a self-scoring comprehension quiz, and grounded Q&A.

---

## ✨ Features

- **Client-Side Document Parsing**: Decode PDFs directly in your browser using `pdfjs-dist` Web Workers, alongside support for `.txt`, `.md`, `.markdown`, and `.csv` files up to 15 MB.
- **Customizable Generation**: Select exactly what to generate before running analysis:
  - **Summary**: Choose between *Concise*, *Executive*, or *Detailed* briefs.
  - **Key Points**: 5 to 7 crisp takeaways and central arguments.
  - **Keywords**: 8 to 12 topical tags for rapid scanning with in-reader highlighting.
  - **Sentiment Analysis**: Polarity gauge ($-100$ to $+100$), confidence score, and tone tags.
  - **Comprehension Quiz**: Self-scoring 10-question multiple-choice test with instant scoring and explanations.
- **Document Statistics & Readability**: In-depth statistics including word count, character count, sentence count, paragraph count, estimated reading time at 225 wpm, and lexicon diversity.
- **Grounded Q&A Chat**: Ask follow-up questions about the document in an interactive chat feed with quick-prompt suggestions.
- **Export**: One-click download of the complete analysis report as a `.txt` file.
- **Modern UI & Themes**: Tactile aesthetic with paper grain textures, dark/light theme switching, and custom typography (Bricolage Grotesque + Fraunces + Inter + JetBrains Mono).

---

## 🛠️ Tech Stack

- **Framework**: React 19, TypeScript
- **Bundler & Tooling**: Vite 7
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **PDF Engine**: `pdfjs-dist`
- **Animations & Icons**: Framer Motion, `lucide-react`
- **AI Inference**: Groq Cloud REST API (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`)

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Adii2556/miniproject2.git
cd miniproject2
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up Groq API Key (Optional)
You can either:
- Supply an environment variable in a `.env` file:
  ```env
  VITE_GROQ_API_KEY=gsk_your_groq_api_key_here
  ```
- Or enter your key directly in the web UI sidebar (stored safely in browser `localStorage`).

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```
