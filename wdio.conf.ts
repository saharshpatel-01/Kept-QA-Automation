import type { Options } from '@wdio/types';
import { config as dotenvConfig } from 'dotenv';
import { mkdirSync } from 'node:fs';
import { reportFailure } from './src/utils/failure-reporter';
import { preflightMac } from './src/utils/preflight';
import { getEnvironment } from './config/environments';
import { getCapabilities } from './config/capabilities';
import { RequirementAgent } from './src/ai/requirement-agent';

dotenvConfig();

// Ensure output dirs exist before logger/screenshots write to them.
mkdirSync('./logs', { recursive: true });
mkdirSync('./screenshots', { recursive: true });

const env = getEnvironment();
const platform = env.platform;

// Gate the run at config-load time so a misconfigured host fails fast with
// actionable guidance, before Appium or any worker session starts.
if (platform !== 'windows') {
    preflightMac(
        process.env.MAC_BUNDLE_ID || 'com.aithinkers.ait-scribe',
        process.env.MAC_APP_PATH
    );
}

const capabilities = getCapabilities(platform);

// Optional tag filtering: TEST_GREP=@smoke runs only matching test titles.
const grep = process.env.TEST_GREP;

export const config: Options.Testrunner = {
    runner: 'local',
    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            project: './tsconfig.json',
            transpileOnly: true
        }
    },

    specs: ['./test/specs/**/*.spec.ts'],

    exclude: [],

    maxInstances: 1,

    capabilities,

    // Re-run a whole spec file once on failure in CI to absorb WDA flakiness.
    specFileRetries: env.retries.specFileRetries,
    specFileRetriesDeferred: true,

    suites: {
        smoke: ['./test/specs/smoke/**/*.spec.ts'],
        e2e: ['./test/specs/e2e/**/*.spec.ts'],
        agent: ['./test/specs/generated/requirement.e2e.spec.ts'],
        macos: ['./test/specs/mac/**/*.spec.ts'],
        windows: ['./test/specs/windows/**/*.spec.ts']
    },

    logLevel: 'info',

    bail: 0,

    baseUrl: 'http://localhost',

    hostname: env.appium.host,
    port: env.appium.port,
    path: env.appium.path,

    waitforTimeout: env.timeouts.waitforTimeout,

    connectionRetryTimeout: env.timeouts.connectionRetryTimeout,

    connectionRetryCount: 3,

    services:
        process.env.EXTERNAL_APPIUM === 'true'
            ? []
            : [
                  [
                      'appium',
                      {
                          command: './node_modules/.bin/appium',
                          args: {
                              relaxedSecurity: true,
                              address: 'localhost',
                              port: 4723,
                              basePath: '/'
                          },
                          logPath: './logs/'
                      }
                  ]
              ],

    framework: 'mocha',

    reporters: [
        'spec',
        [
            'allure',
            {
                outputDir: 'allure-results',
                disableWebdriverStepsReporting: false,
                disableWebdriverScreenshotsReporting: false,
                useCucumberStepReporter: false
            }
        ]
    ],

    mochaOpts: {
        ui: 'bdd',
        timeout: env.timeouts.mochaTimeout,
        retries: env.retries.mochaRetries,
        ...(grep ? { grep } : {})
    },

    /**
     * Hooks
     */
    onPrepare: async function () {
        // Agentic mode: when a Jira requirement key is provided, generate the
        // test plan from that ticket before the workers start.
        const requirementKey = process.env.JIRA_REQUIREMENT_KEY;
        if (requirementKey) {
            try {
                await new RequirementAgent().buildPlan(requirementKey);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error(`[agent] Failed to build plan for ${requirementKey}:`, e);
            }
        }
    },

    before: async function () {
        // Setup before all tests
    },

    beforeTest: async function () {
        // Setup before each test
    },

    afterTest: async function (test, _context, { error }) {
        if (error) {
            // In agentic mode the executor spec files requirement-linked bugs
            // itself, so skip the generic reporter to avoid double-filing.
            if (process.env.JIRA_REQUIREMENT_KEY) {
                return;
            }
            const testName =
                (test as { fullTitle?: string; title: string }).fullTitle || test.title;
            try {
                await reportFailure({ testName, error: error as Error });
            } catch (e) {
                // Never let failure reporting mask the original test failure
                // eslint-disable-next-line no-console
                console.error(`Failure reporting errored for "${testName}":`, e);
            }
        }
    },

    after: async function () {
        // Cleanup after all tests
    }
};
