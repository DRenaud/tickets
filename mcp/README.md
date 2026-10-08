# FastTicket MCP server

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant (Claude Code, Claude Desktop, …)
read and manage FastTicket tickets directly in Firestore.

## Tools

| Tool            | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `list_projects` | Lists the projects (`alveola`, `ludistes`, `ticket`).                    |
| `list_tickets`  | Lists a project's tickets, optionally filtered by status/priority/category. |
| `get_ticket`    | Returns one ticket with its description and comments.                    |
| `create_ticket` | Creates a ticket in the backlog.                                         |
| `update_ticket` | Updates title, description, status, priority, category, PR link, time spent, lock. |
| `add_comment`   | Adds a comment to a ticket.                                              |

Deleting tickets is intentionally not exposed.

## Security

The server uses the **Firebase Admin SDK**: it bypasses `firestore.rules` and acts with admin rights on
every project. It runs locally over stdio only — never expose it publicly.

## Setup

Requires Node ≥ 22.18 (runs the TypeScript sources directly via Node's type stripping).

```bash
cd mcp
npm install
```

Environment variables:

- `SERVICE_ACCOUNT` (required): the Firebase service account JSON — the same value as the SSR server's `.env`.
- `TICKETS_AUTHOR` (optional): initials shown as author of created tickets/comments (default `MCP`).

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
      "env": { "SERVICE_ACCOUNT": "{…service account JSON…}", "TICKETS_AUTHOR": "AI" }
    }
  }
}
```

## Development

```bash
npm run typecheck
npx @modelcontextprotocol/inspector node src/index.ts
```
