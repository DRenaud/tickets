# FastTicket MCP server

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant (Claude Code, Claude Desktop, …)
read FastTicket tickets directly from Firestore. It is **read-only** and needs no auth.

## Tools

| Tool            | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `list_projects` | Lists the projects (`alveola`, `ludistes`, `ticket`).                    |
| `list_tickets`  | Lists a project's tickets, optionally filtered by status/priority/category. |
| `get_ticket`    | Returns one ticket with its description.                                |

No tool writes to Firestore (no create, update, comment or delete): that is what makes it safe to use without auth.

## Security

The server uses the **Firebase Admin SDK**, which bypasses `firestore.rules`. Safety comes from the code
exposing read tools only — never add a write tool without adding auth first. Anyone using it can read
every ticket of every project (titles, descriptions, statuses…). Comments and Firebase uids are never
exposed.

## Setup

Requires Node ≥ 22.18 (runs the TypeScript sources directly via Node's type stripping).

```bash
cd mcp
npm install
```

Environment variables:

- `SERVICE_ACCOUNT` (required): the Firebase service account JSON — the same value as the SSR server's `.env`.

### Claude Code

The repo root ships a `.mcp.json` that registers the server as `fast-ticket`; it reads `SERVICE_ACCOUNT`
from your shell environment. Export it before launching `claude` from the repo root:

```bash
export SERVICE_ACCOUNT="$(cat path/to/service-account.json)"
claude
```

### Claude Desktop / other clients

```json
{
  "mcpServers": {
    "fast-ticket": {
      "command": "node",
      "args": ["/absolute/path/to/tickets/mcp/src/index.ts"],
      "env": { "SERVICE_ACCOUNT": "{…service account JSON…}" }
    }
  }
}
```

## Development

```bash
npm run typecheck
npx @modelcontextprotocol/inspector node src/index.ts
```
