# Kept-QA-Automation — rules for AI agents working in this repo

Cross-platform automation for the Kept desktop app (Mac2 + NovaWindows drivers, later iOS/Android).
TypeScript + WebdriverIO 8 + Appium + Mocha. Page Object Model.

## Safety

- Test **Kept Dev only**. Never the production app, thekept.ai, auth.thekept.ai or production data.
- This repo is **public**: never commit `.env`, `google_key.json`, tokens, emails or passwords.
- Never weaken an assertion to make a test pass. A real failure is a possible bug.
- Work on a branch and open a pull request; never push to `main` directly.

## Conventions

- Put the test case ID in square brackets at the start of every `it()` title:
  `it('[AIT-WIN-313] Settings > Profile shows Name, Email and Workspace', ...)`.
  Zephyr keys (`[KEPT-T123]`) also work; sheet IDs map to Zephyr keys in `config/zephyr-map.json`.
- Call `step('...')` (from `src/utils/steps.ts`) for each user action, in plain English.
  These become the "Steps to Reproduce" of the auto-filed Jira bug.
- Locators: prefer automation IDs (`$('~HeaderSettingsBtn')`), then Name, then XPath.
  Mac page objects: `src/pages/screens/`. Windows page objects: `src/pages/windows/`.

## What happens after each test (wdio.conf.ts afterTest)

1. Fail + `AUTO_FILE_BUGS` not false -> Jira bug in the team format
   (Bug Title, Description, Steps to Reproduce, Actual Result, Expected Result, Environment)
    - screenshot attached; an open bug with the same title is reused, not duplicated.
2. If Zephyr is configured and the title has a case ID -> Pass/Fail recorded in that run's
   Zephyr test cycle, and the bug is linked to the execution.

## Run

- Windows: `TEST_PLATFORM=windows` in `.env`, then
  `node scripts/appium-runner.mjs --spec ./test/specs/windows/<file>.spec.ts`
- Full commands: COMMANDS.md. Before a PR: `npm run validate`.
