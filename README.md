# Kept QA Automation

Cross-platform desktop automation framework for testing the Kept application using Appium Mac2 (macOS) and Windows drivers with TypeScript + WebdriverIO.

## ✅ Quick Start

### Prerequisites

- macOS with Xcode installed
- Node.js 18+
- Appium 2.x with Mac2 driver
- Kept application installed

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and update MAC_BUNDLE_ID (already set to: com.aithinkers.ait-scribe)
```

### Running Tests

The test scripts manage Appium automatically — no separate terminal needed.

```bash
# Use the pinned Node version (22)
nvm use

# Run smoke tests (starts/stops Appium for you)
npm run test:smoke

# Run all tests
npm test

# Filter by tag
TEST_GREP=@smoke npm test

# CI profile (retries enabled)
TEST_ENV=ci npm run test:ci

# View report
npm run report
```

> Advanced: to run against an Appium server you manage yourself, start
> `npm run appium` in one terminal and use `EXTERNAL_APPIUM=true npm run test:wdio`.

## 📁 Project Structure

```
├── config/               # Environment profiles + capability builders
├── src/
│   ├── ai/               # AI-powered failure analysis
│   ├── config/           # Configuration files
│   ├── jira/             # Jira API integration
│   ├── pages/            # Page Object Models
│   │   ├── base.page.ts
│   │   ├── kept.main.page.ts (macOS)
│   │   └── windows/
│   │       └── kept.main.page.ts (Windows)
│   └── utils/            # Utilities (logger, etc.)
├── test/
│   └── specs/
│       ├── smoke/        # Smoke tests
│       │   ├── kept-smoke.spec.ts      # 5 core tests
│       │   ├── kept-advanced.spec.ts   # 12 advanced tests
│       │   └── kept-ui.spec.ts         # 13 UI tests
│       ├── mac/          # macOS-specific tests
│       └── windows/      # Windows-specific tests
├── .env                  # Configuration (bundle ID, etc.)
├── wdio.conf.ts          # WebdriverIO configuration
└── package.json          # Dependencies
```

## 🧪 Test Suites

### Smoke Tests (5 tests)

- Application launch & readiness
- Echo/marker verification
- Simple math questions
- Conversation continuity
- History display

### Advanced Tests (12 tests)

- Response quality validation
- Data grounding (no fabrication)
- Performance & reliability
- Edge cases (long prompts, special chars)
- Conversation context & memory

### UI Tests (13 tests)

- Application launch & navigation
- Input field interactions
- Conversation display
- Keyboard shortcuts
- Application state management
- Error handling

**Total: 30 comprehensive test cases**

## 🔧 Configuration

### Required (.env)

```bash
MAC_BUNDLE_ID=com.aithinkers.ait-scribe
MAC_APP_PATH=/Applications/Kept.app
```

### Optional (.env)

```bash
# AI-powered analysis
OPENAI_API_KEY=your_key_here

# Jira integration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_token
JIRA_PROJECT_KEY=KEPT
```

## 🎯 Features

- ✅ **Cross-platform**: Shared tests for macOS and Windows
- ✅ **Page Object Model**: Maintainable, reusable code
- ✅ **Self-healing locators**: Ordered fallback selectors + AI-suggested selector from the live accessibility tree
- ✅ **Preflight checks**: Fails fast with actionable guidance if Xcode/Appium/app aren't ready
- ✅ **AI Analysis**: Automatic failure analysis + bug-report drafting (optional)
- ✅ **Auto Jira filing**: Files/links a ticket on failure, with duplicate detection (optional)
- ✅ **Allure Reports**: Rich test reports with screenshots
- ✅ **TypeScript**: Type-safe test code

## 📊 Commands

```bash
# Tests
npm test                  # All tests
npm run test:smoke        # Smoke tests only
npm run test:mac          # macOS tests
npm run test:windows      # Windows tests

# Reports
npm run report            # Generate and open report
npm run report:generate   # Generate only

# Code Quality
npm run lint              # ESLint check
npm run format            # Prettier format
npm run type-check        # TypeScript check
```

## 🔍 Troubleshooting

### Appium Permission Issues

Run Appium from home directory:

```bash
cd ~ && appium --base-path / --relaxed-security
```

### Kept Bundle ID

Verify bundle ID:

```bash
osascript -e 'id of app "Kept"'
# Should return: com.aithinkers.ait-scribe
```

### Element Not Found

Use Appium Inspector to find correct selectors:

1. Download: https://github.com/appium/appium-inspector/releases
2. Configure with bundleId: `com.aithinkers.ait-scribe`
3. Update selectors in `src/pages/kept.main.page.ts`

### macOS Permissions

Grant accessibility access:
**System Preferences → Privacy & Security → Accessibility**
Add Terminal or your IDE.

## 📚 Documentation

- **GETTING-STARTED.md** - Detailed setup walkthrough
- **SETUP-GUIDE.md** - POC setup instructions
- **README-APPIUM.md** - Architecture & technical details

## 🚀 Next Steps

1. ✅ Install **full Xcode** (App Store), then:
    ```bash
    sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
    sudo xcodebuild -license accept
    ```
2. ✅ Grant **Accessibility** permission to your terminal/IDE
   (System Settings → Privacy & Security → Accessibility)
3. ✅ Run `npm run test:smoke` — a preflight check validates the environment and
   fails fast with guidance if anything is missing
4. ⬜ (Optional) Add `OPENAI_API_KEY` to `.env` to enable AI validation,
   failure analysis, and self-healing locators
5. ⬜ (Optional) Add Jira credentials to `.env` to auto-file bug tickets on failure

## ⚠️ Known Limitations

### macOS 26 / Xcode 27 input bug — worked around

On pre-release **macOS 26.x + Xcode 27.x**, Apple's XCUITest input-event synthesis
asserts and aborts inside the SkyLight window server (`SLSGetDisplaysWithRect`),
crashing WebDriverAgentMac on **any** Appium click/type. This is an upstream Apple
defect, not a framework issue.

**Workaround (implemented):** interaction is driven through the macOS Accessibility
API via `osascript` — navigation uses AXPress, and chat input sets the text area's
`AXValue` and AXPresses the Send button (see [`src/utils/native-nav.ts`](src/utils/native-nav.ts)).
This bypasses XCUITest event synthesis entirely, so it does **not** crash WDA.
Appium remains the read-only assertion layer (find elements, read text, screenshots).
The full E2E suite — including real chat send/receive — runs green on this host. On a
stable released macOS/Xcode, native Appium input can be used directly as well.

### Windows

Windows capabilities are wired (`TEST_PLATFORM=windows`) but require an actual
Windows host with Appium, the windows driver, and `Kept.exe` to run.

## 🛠️ Tech Stack

- **Language**: TypeScript
- **Test Runner**: WebdriverIO 8.x
- **Automation**: Appium 2.x + Mac2 Driver
- **Framework**: Mocha
- **Reporting**: Allure
- **AI**: OpenAI GPT-4 (optional)
- **Issue Tracking**: Jira API (optional)

---

**Built with ❤️ for reliable desktop automation**
