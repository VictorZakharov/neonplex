# Contributing to Neonplex

Thanks for helping improve Neonplex. Bug fixes, tests, documentation,
accessibility improvements, performance work, and well-scoped gameplay ideas
are welcome.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.
Report security issues through the private process in [SECURITY.md](SECURITY.md),
not through a public issue or pull request.

## Prerequisites

- Node.js 22.15.0 or newer
- npm 10.0.0 or newer
- A current desktop browser

Install the locked dependency set and start the development server:

```sh
npm ci
npm start
```

## Before opening a pull request

1. Search existing issues and pull requests for related work.
2. For a substantial feature or gameplay change, open an issue first so its
   scope and player-facing behavior can be agreed on.
3. Create a focused branch from the latest `main`.
4. Add or update tests for behavior changes.
5. Run the complete local quality gate:

```sh
npm run check
npm run build
```

The repository is public source, but the package is deliberately marked
`private`. Neonplex is distributed as a browser application and is not
published to npm. Do not remove the private-package safeguard or add a package
publishing workflow.

## Engineering expectations

- Keep simulation behavior deterministic and independent from frame rate.
- Keep rendering interpolation separate from authoritative grid state.
- Prefer small, single-purpose modules over growing central files.
- Put shared interfaces and contracts in dedicated files rather than mixing
  them into implementation modules.
- Preserve strict TypeScript typing; avoid `any` and unexplained type casts.
- Cover collision, gravity, explosions, collection, and enemy routing changes
  with focused regression tests.
- Consider keyboard access, reduced-motion preferences, zoom, scrolling, and
  both 60 Hz and high-refresh rendering when changing presentation code.
- Avoid unrelated formatting or refactoring in a focused change.

## Assets and intellectual property

Neonplex is inspired by the puzzle-action genre associated with Supaplex, but
it is an independent project. Contributions must use original or properly
licensed code, art, animation, sound, text, and level content.

Do not copy, trace, extract, or submit assets from Supaplex or any other game.
Document the source and license of any third-party asset in the pull request.
By contributing, you confirm that you have the right to submit the work under
this repository's MIT License.

## Pull requests

Use the pull request template and include:

- A concise explanation of the problem and solution
- Relevant issue links
- Test coverage and commands run
- Screenshots or short recordings for visible changes
- Performance observations for rendering or simulation changes

Automated checks must pass before merge. Preview deployments may be produced
for pull requests opened from branches in this repository. Pull requests from
forks still receive validation checks, but do not receive a writable Pages
preview because untrusted fork code is not granted deployment permissions.

Maintainers may ask for a change to be split if it combines unrelated work.
