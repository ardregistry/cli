# @ardregistry/cli

> The official terminal explorer for the Agentic Resource Discovery (ARD) network. Search and navigate AI capability catalogs (`ai-catalog.json`) directly from your command line.

---

## Installation

Install the CLI globally via npm:

```bash
npm install -g @ardregistry/cli
```

---

## Commands

The CLI provides two main commands: `search` (for querying the public registry) and `navigate` (for traversing hosted catalogs).

### 1. `search`
Queries the ARD Registry for catalog entries that match a natural language intent or category type.

```bash
ard search "fetch weather details"
```

#### Options:
* `-r, --registry <url>`: Override the default registry endpoint (defaults to `https://ardregistry.org`).
* `-t, --type <type>`: Filter results by category type (e.g., `'MCP Server'`, `'AI Skill'`, or `'A2A Agent'`).
* `-l, --limit <limit>`: Max number of results to display (default: `10`).

#### Example:
```bash
ard search "git repository tool" --type "MCP Server" --limit 5
```

---

### 2. `navigate`
Performs a local, federated traversal starting from a specific target domain. It queries the domain's well-known path (`/.well-known/ai-catalog.json`), checks discovery pointers, matches your query against the schema, and resolves references recursively.

```bash
ard navigate example.com "finance calculation"
```

---

## Library Usage

You can also import the search and navigation helpers inside your Node.js/TypeScript applications:

```typescript
import { searchRegistry, navigateRegistry } from '@ardregistry/cli';

// Query the registry programmatically
const results = await searchRegistry('weather lookup', {
  type: 'MCP Server',
  limit: 5
});

console.log(results[0].displayName); // "Weather Service"
```

---

## Development

To run the CLI locally for development or testing:

1. Clone the repository and install dependencies:
   ```bash
   cd cli
   npm install
   ```
2. Build the TypeScript source:
   ```bash
   npm run build
   ```
3. Test locally using the local wrapper script:
   ```bash
   node bin/cli.js search "weather station" -r http://localhost:3005
   ```

---

## License

MIT © [ARD Registry](https://ardregistry.org)
