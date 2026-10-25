# FastTicket

A personal experiment built with **Angular 22** to try out **vibe coding** with [Claude](https://claude.ai/).

I needed a simple way to track small tasks/tickets across a few side projects, and used it as an
opportunity to see how far an AI-driven ("vibe coding") workflow could go on a real, working
application — from scaffolding to SSR, auth, Firestore integration, and UI polish.

This repo is shared mainly as a write-up of that experience: what worked well, what didn't, and
what a fully AI-assisted development loop looks like in practice on an Angular codebase.

## Stack

- Angular 22 (standalone components, signals, SSR)
- Firebase (Auth + Firestore) with a Firebase Admin SDK-backed SSR data path
- Transloco for i18n (French / English)
- An [MCP endpoint](#mcp-server) to read tickets (public) and manage tickets, sprints and releases (token-protected) from an AI assistant

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## MCP server

The Express server exposes a public [MCP](https://modelcontextprotocol.io) endpoint at `/mcp`
(Streamable HTTP, stateless) so AI assistants (Claude Code, Claude Desktop, …) can read tickets:

| Tool            | Description                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| `list_projects` | Lists the projects.                                                          |
| `list_tickets`  | Lists a project's tickets, optionally filtered by status/priority/category. |
| `get_ticket`    | Returns one ticket with its description and comments.                       |

Reads are **public**: anyone can read every ticket of every project, including comments (Firebase uids are
never exposed). Write tools are only exposed to requests carrying `Authorization: Bearer <MCP_ADMIN_TOKEN>`:

| Tool             | Description                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `create_ticket`  | Creates a ticket in a project's backlog.                                                 |
| `update_ticket`  | Edits a ticket's fields and/or moves it (backlog → todo → inprogress → done).            |
| `get_sprint`     | Current sprint number/name and ticket count per status.                                  |
| `rename_sprint`  | Renames the current sprint.                                                              |
| `release_sprint` | Turns every `done` ticket into `resolved` with a version and starts the next sprint.     |

Set a long random secret in the server's environment (e.g. `.env`) to enable them, for instance with
`openssl rand -hex 32`:

```bash
MCP_ADMIN_TOKEN=<secret>
```

Without `MCP_ADMIN_TOKEN` the endpoint stays read-only; a wrong token is rejected with a 401. The tools use
the Admin SDK, which bypasses `firestore.rules`, so serve `/mcp` over HTTPS only. Requests are rate-limited
to 60 per minute per IP. Code lives in `src/mcp/`.

To use it from Claude Code:

```bash
claude mcp add --transport http fast-ticket https://<your-domain>/mcp \
  --header "Authorization: Bearer $MCP_ADMIN_TOKEN"
```

The repo's `.mcp.json` points at `http://localhost:4000/mcp` for local development
(`npm run build && npm run serve:ssr:fast-ticket`) and reads the token from your `MCP_ADMIN_TOKEN` environment variable.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## License

MIT — see [LICENSE](./LICENSE).
