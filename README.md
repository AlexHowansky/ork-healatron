# Medalator

A calculator for Treat Wounds healing in the Pathfinder Second Edition
roleplaying game. It supports both the Remaster (Player Core) and Legacy
(Core Rulebook) rules.

Enter the healer's Medicine proficiency, bonus and feats, and the target's
current and max HP. Medalator shows:

- the Treat Wounds DC and the chance of each degree of success,
- the average healing for each outcome, per attempt and per hour, and
  which DC heals the most on average, and
- simulated rolls until the target is healed: every roll, the HP healed
  and the time passed.

The feats it covers are Continual Recovery, Risky Surgery, Mortal Healing,
Medic Dedication and Godless Healing.

The app runs entirely in your browser. It has no server, no accounts and
no tracking. It remembers only the Healer panel, in your browser's local
storage.

See [SPEC.md](SPEC.md) for the full feature list and the rules the app
follows.

## Development

Requires either [Node.js](https://nodejs.org/) (current LTS) or
[Bun](https://bun.sh/).

| Task                          | Node.js             | Bun                 |
| ----------------------------- | ------------------- | ------------------- |
| Install dependencies          | `npm install`       | `bun install`       |
| Dev server with hot reload    | `npm run dev`       | `bun run dev`       |
| Run unit tests (Vitest)       | `npm test`          | `bun run test`      |
| ESLint and Prettier checks    | `npm run lint`      | `bun run lint`      |
| TypeScript type check         | `npm run typecheck` | `bun run typecheck` |
| Production build into `dist/` | `npm run build`     | `bun run build`     |
| Preview the production build  | `npm run preview`   | `bun run preview`   |

With Bun, use `bun run test`, not `bun test`. `bun test` starts Bun's
built-in test runner rather than Vitest, and the tests won't run correctly.

Debug logging is on in dev builds. In a production build, add `?debug=1` to
the URL to turn it on.

Architecture and coding conventions are described in
[CLAUDE.md](CLAUDE.md).

## License

Released under the [MIT License](LICENSE).

Pathfinder is a trademark of Paizo Inc. Medalator is an independent
project and is not published, endorsed or approved by Paizo Inc.
