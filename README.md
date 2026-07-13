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

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

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
