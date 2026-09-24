# AI Commit 🚀

**AI Commit** is a high-performance extension for Cursor and VS Code that leverages your favourite AI provider (Groq, OpenCode Go/Zen, or any OpenAI-compatible API) to generate intelligent, semantic commit messages from your staged changes (git diff).

---

## ✨ Features

- **One-Click Generation**: Analyzes your staged changes and writes the commit message for you.
- **Integrated UI**: Custom action button located directly in the Source Control (Git) title bar.
- **Multiple Providers**: Groq, OpenCode Go, OpenCode Zen, OpenCode Console or any custom OpenAI-compatible API.
- **Multilingual Support**: Generate messages in English, Spanish, Catalan, French, German, Italian and Portuguese.
- **Model Selection**: Choose the model via settings or use the provider's default.
- **Privacy First**: You use your own API Key. No middle-man servers.

---

## 🚀 Installation

### Option 1: Fast Install (Recommended)

1. Go to the [Releases] section of this GitHub repository.
2. Download the latest ai-commit-X.X.X.vsix file.
3. Open Cursor or VS Code.
4. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) to open the Command Palette..
5. Type "Install from VSIX" and select the command: Extensions: Install from VSIX...
6. Select the downloaded file and you're ready to go!

### Option 2: Build from Source

1. Clone the repository
2. Install dependencies: npm install
3. Compile the code: npm run compile
4. Package the extension: npx vsce package (This will generate a new .vsix file).
5. Follow the instructions of Option 1.

---

## ⚙️ Configuration

In **Settings** > **Extensions** > **AI Commit**:

| Setting | Description |
| --- | --- |
| `aiCommit.provider` | Provider to use: `groq`, `opencode` or `custom`. |
| `aiCommit.plan` | Plan of the selected provider (managed automatically). |
| `aiCommit.apiKey` | API Key of the selected provider. |
| `aiCommit.language` | Default language for the commit message. |
| `aiCommit.model` | Model override. Leave empty to pick it from the provider's available models. |
| `aiCommit.customBaseUrl` | Base URL for a custom OpenAI-compatible API (e.g. `https://api.openai.com/v1`, `http://localhost:11434/v1` for Ollama). |

### Providers and endpoints

Every provider exposes an OpenAI-compatible `/models` endpoint, so the available models are fetched live instead of being hardcoded. If `aiCommit.model` is empty, a picker with the current models is shown the first time and the choice is remembered.

Plans (e.g. OpenCode go/zen/console) are provider metadata, not an API. They are not a setting: use the **`AI Commit: Select Plan`** command (command palette) to list and pick the plan of the selected provider.

| Provider | Plan | Base URL |
| --- | --- | --- |
| Groq | — | `https://api.groq.com/openai/v1` |
| OpenCode | Go | `https://opencode.ai/zen/go/v1` |
| OpenCode | Zen | `https://opencode.ai/zen/v1` |
| OpenCode | Console | `https://opencode.ai/zen/v1` |

Get your keys at:

- **Groq**: [Groq Cloud Console](https://console.groq.com/)
- **OpenCode Go/Zen/Console**: [opencode.ai/auth](https://opencode.ai/auth)

If no API Key is set, the extension will ask you for it the first time and store it globally.

---

## 📖 Usage

1. Make changes to your code.
2. Stage your changes using `git add` or the "+" icon in the Git panel.
3. In the **Source Control** panel, look for the sparkle icon (`✨`).
4. **Click the icon** to automatically fill the message box.

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Compile the code
npm run compile

# Lint
npm run lint
```