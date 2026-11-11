# Kept QA Automation — Command Reference

All commands for running, testing, and operating this framework in one place.

> **Always run under Node 22** (Appium 3 lives there). Start every session with:
>
> ```bash
> export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
> ```

---

## 1. One-time setup

```bash
# Install dependencies
npm install

# Install Appium 3 + Mac2 driver (global, under Node 22)
npm install -g appium
appium driver install mac2 --unsafe
# Let the Mac2 driver resolve appium at runtime
ln -sfn "$(npm root -g)/appium" ~/.appium/node_modules/appium

# Copy env template and fill in values
cp .env.example .env
```

Grant **Accessibility** permission to your terminal / VS Code:
System Settings → Privacy & Security → Accessibility (required, or input is dropped).

---

## 2. Run tests (recommended — Appium auto-managed)

These scripts start Appium if needed, run the tests, and tear it down.

```bash
npm test             # run everything (default spec glob)
npm run test:smoke   # smoke suite  (test/specs/smoke)
npm run test:e2e     # full E2E suite (test/specs/e2e)
npm run test:mac     # macOS-specific suite
npm run test:ci      # CI profile (smoke, TEST_ENV=ci)
```

### Run a single page (E2E, one spec each)

```bash
npm run e2e:assistant    # AI Assistant (layout + chat + search + performance)
npm run e2e:meetings
npm run e2e:speech
npm run e2e:vocabulary
npm run e2e:tasks
npm run e2e:insights
npm run e2e:feedback
```

### Run one spec file directly

```bash
# Appium must be running (see section 5)
EXTERNAL_APPIUM=true npx wdio run ./wdio.conf.ts \
  --spec ./test/specs/e2e/ai-assistant.e2e.spec.ts
```

### Filter by tag

```bash
TEST_GREP=@smoke npx wdio run ./wdio.conf.ts --suite e2e
```

---

## 3. Agentic QA — Jira ticket → AI tests → auto bug

Generate tests from a Jira ticket, run them, and auto-file bugs on failure.
Requires Jira creds in `.env` (and `OPENAI_API_KEY` for real AI-generated tests).

```bash
JIRA_REQUIREMENT_KEY=XTHIN-55 npm run qa:agent
```

Review the generated plan afterward:

```bash
cat test/specs/generated/plan.json
```

Run AI analysis but DON'T create Jira tickets:

```bash
AUTO_FILE_BUGS=false JIRA_REQUIREMENT_KEY=XTHIN-55 npm run qa:agent
```

### Verify Jira connection

```bash
set -a; source .env; set +a
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_BASE_URL/rest/api/3/myself" | head
# JSON with your account = OK;  401 = wrong email/token
```

### List tickets in your project

```bash
set -a; source .env; set +a
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/search/jql?jql=project=$JIRA_PROJECT_KEY%20ORDER%20BY%20created%20DESC&maxResults=10&fields=summary,status" \
  | python3 -m json.tool
```

---

## 4. Code quality

```bash
npm run validate     # type-check + lint + format:check (run before committing)
npm run type-check   # tsc --noEmit
npm run lint         # eslint
npm run lint:fix     # eslint --fix
npm run format       # prettier --write
npm run format:check # prettier --check
```

---

## 5. Appium server (manual control)

```bash
# Start Appium (Node 22) in the background
appium --base-path / --relaxed-security --address 127.0.0.1 --port 4723 \
  > /tmp/appium-ext.log 2>&1 &

# Check it's up
curl -sf http://127.0.0.1:4723/status && echo "UP"

# Use an already-running Appium for wdio
EXTERNAL_APPIUM=true npx wdio run ./wdio.conf.ts --suite e2e
```

---

## 6. Reports

```bash
npm run report            # generate + open Allure report
npm run report:generate   # generate only (allure-report/)
```

---

## 7. Troubleshooting

**Run hangs at "session creation" / orphaned WebDriverAgent** — clear stale processes:

```bash
pkill -f appium; pkill -f WebDriverAgent; pkill -f xcodebuild
lsof -ti :10100 | xargs kill -9 2>/dev/null
lsof -ti :4723  | xargs kill -9 2>/dev/null
```

**Kept window closed / "window 1 invalid index"** — reopen the window:

```bash
open -a Kept
```

**Full clean restart before a run**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
pkill -f appium; pkill -f WebDriverAgent; pkill -f xcodebuild
lsof -ti :10100 | xargs kill -9 2>/dev/null; lsof -ti :4723 | xargs kill -9 2>/dev/null
sleep 2
appium --base-path / --relaxed-security --address 127.0.0.1 --port 4723 > /tmp/appium-ext.log 2>&1 &
sleep 5 && curl -sf http://127.0.0.1:4723/status && echo UP
open -a Kept
```

---

## 8. Environment variables (`.env`)

| Variable               | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `TEST_PLATFORM`        | `mac` or `windows`                                           |
| `MAC_BUNDLE_ID`        | `com.aithinkers.ait-scribe`                                  |
| `OPENAI_API_KEY`       | Enables AI analysis + AI test generation (`sk-...`)          |
| `AI_MODEL`             | Model name (default `gpt-4-turbo-preview`)                   |
| `JIRA_BASE_URL`        | Site root, e.g. `https://aithinkers.atlassian.net` (no path) |
| `JIRA_EMAIL`           | Atlassian account email                                      |
| `JIRA_API_TOKEN`       | Atlassian API token                                          |
| `JIRA_PROJECT_KEY`     | Project key, e.g. `XTHIN`                                    |
| `JIRA_REQUIREMENT_KEY` | Ticket to drive the agent (per-run env)                      |
| `AUTO_FILE_BUGS`       | `false` to skip Jira ticket creation                         |
| `EXTERNAL_APPIUM`      | `true` to use an already-running Appium                      |
| `TEST_ENV`             | `local` or `ci` (timeouts/retries)                           |
| `TEST_GREP`            | Tag filter, e.g. `@smoke`                                    |
