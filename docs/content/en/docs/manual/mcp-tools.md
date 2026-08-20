---
title: Expanding AIRI with MCP & Tools
description: How to give AIRI real-world powers using built-in tools and the Model Context Protocol (MCP) ecosystem.
---

# Expanding AIRI with MCP & Tools

AIRI is not just a conversational companion—she can interact with the digital world. Through **Built-in Tools** and the **Model Context Protocol (MCP)** standard, AIRI can search the web, inspect files, check the weather, control smart home devices, and execute custom Python/Node scripts.

---

## 1. Built-in Tools

AIRI includes several native tools that require zero configuration:

- **`image_journal`**: Allows AIRI to generate and display background artwork and selfies.
- **`text_journal`**: Allows AIRI to write and search her permanent diary entries.
- **`generate_motion`**: Synthesizes custom procedural animations or dances on the fly.
- **`web_search`** *(Provider-dependent)*: Performs live Google Search or DuckDuckGo lookups when asked about current news or facts.

You can enable or restrict specific tools for each character card in **Character Settings &rarr; Tools & Permissions**.

---

## 2. What is Model Context Protocol (MCP)?

**MCP (Model Context Protocol)** is an open industry standard developed by Anthropic that allows AI models to connect to external data sources and tools through standardized local subprocesses.

By adding an MCP server, you can grant AIRI access to:
- **Filesystem Tools**: Read, write, or search files in a specific directory on your PC.
- **GitHub / Git Tools**: Check pull requests, review code diffs, or inspect repository issues.
- **SQLite / Database Tools**: Query local databases for knowledge retrieval.
- **Web Fetching & Scraping**: Pull down documentation pages or articles for live analysis.
- **Custom Scripts**: Connect any Python, TypeScript, or Go CLI tool as an AI-callable capability.

---

## 3. Configuring MCP Servers in AIRI

AIRI manages MCP servers through a standard `mcp.json` configuration located in your application data folder.

### Adding an MCP Server via Settings UI
1. Navigate to **Settings &rarr; Modules &rarr; MCP Integration**.
2. Click **Add Server**.
3. Fill in the server details:
   - **Name**: e.g., `filesystem` or `github`.
   - **Command**: The executable to run (e.g., `npx` or `python`).
   - **Arguments**: Any CLI arguments required (e.g., `-y @modelcontextprotocol/server-filesystem C:\Users\YourName\Documents`).
   - **Environment Variables**: API keys or paths required by the server (e.g., `GITHUB_PERSONAL_ACCESS_TOKEN`).
4. Click **Apply & Restart MCP Servers**.

### Example `mcp.json` Configuration
If you prefer editing the file directly (`%APPDATA%/airi/mcp.json` on Windows or `~/.config/airi/mcp.json` on Linux/macOS):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\Username\\Projects"
      ]
    },
    "weather": {
      "command": "python",
      "args": ["-m", "mcp_server_weather"],
      "env": {
        "WEATHER_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

---

## 4. How AIRI Uses Tools in Chat

When an LLM supports function calling (e.g., GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash, or Qwen2.5 with Tool Calling enabled):
1. You ask: *"Can you check what Python files are in my project folder?"*
2. AIRI calls the `filesystem::list_directory` tool.
3. The tool execution output appears in the Chatbox ledger.
4. AIRI reads the tool output and gives you a conversational summary of your files.

> [!NOTE]
> **Security Guardrails**: Tools run locally with your user account permissions. Only connect MCP servers and grant directory access to sources you trust.
