# Contributing

## Prerequisites

- **Node 22** (pinned in `.nvmrc`): `nvm use`
- **Appium 3** with the `mac2` driver (installed via Appium's driver manager)
- **Full Xcode** + Accessibility permission for your terminal/IDE
- The **Kept** app installed at `/Applications/Kept.app`

See [README.md](README.md) for full setup.

## Project structure

```
config/        # environment profiles + capability builders
src/
  ai/          # OpenAI failure analysis & locator suggestions
  jira/        # Jira bug-filing client
  pages/       # Page Object Model (base + per-platform)
  utils/       # logger, preflight, self-healing, failure-reporter
test/
  specs/       # test suites (smoke / mac / windows)
  support/     # fixtures (shared setup)
  data/        # centralised prompts / markers / expected values
scripts/       # appium-runner + debug helpers
```

## Adding a test

1. Reuse the fixture for setup:
    ```ts
    import { launchKept } from '../../support/kept.fixture';
    let keptPage: KeptMainPage;
    before(async () => {
        keptPage = await launchKept();
    });
    ```
2. Put prompts/expected values in [test/data/prompts.ts](test/data/prompts.ts), not inline.
3. Tag suites in the `describe` title (e.g. `@smoke`, `@regression`) so they can be
   filtered with `TEST_GREP=@smoke`.
4. New on-screen actions/elements go in the page object
   ([src/pages/kept.main.page.ts](src/pages/kept.main.page.ts)), using self-healing
   locator strategies — never hardcode element indices.
5. Append new `it(...)` blocks at the bottom of an existing spec.

## Running

```bash
nvm use
npm run test:smoke          # smoke suite (manages Appium automatically)
TEST_GREP=@smoke npm test   # filter by tag
TEST_ENV=ci npm run test:ci # CI profile (retries enabled)
```

## Quality gates (run before pushing)

```bash
npm run validate   # type-check + lint + format check
```

Pre-commit hooks (husky + lint-staged) auto-fix lint/format on staged files.

## Selector maintenance

When the Kept UI changes, dump the live accessibility tree:

```bash
node scripts/dump-tree.mjs
```

Update the strategy lists in the page object to match.
