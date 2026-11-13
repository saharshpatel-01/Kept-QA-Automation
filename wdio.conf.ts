import type { Options } from '@wdio/types';
import { config as dotenvConfig } from 'dotenv';
import { mkdirSync } from 'node:fs';
import { reportFailure } from './src/utils/failure-reporter';
import { preflightMac } from './src/utils/preflight';
import { getEnvironment } from './config/environments';
import { getCapabilities } from './config/capabilities';
import { RequirementAgent } from './src/ai/requirement-agent';
import { ZephyrClient } from './src/zephyr/client';
import { zephyrKeyFromTitle } from './src/utils/case-id';
import { resetSteps } from './src/utils/steps';

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
        // Zephyr Scale: one test cycle per run; workers read its key from the env.
        const zephyr = new ZephyrClient();
        if (zephyr.enabled && !process.env.ZEPHYR_CYCLE_KEY) {
            const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
            const name = `Automation ${platform} - Kept Dev ${process.env.KEPT_BUILD || ''} - ${stamp}`;
            const key = await zephyr.createCycle(
                name,
                'Created automatically by Kept-QA-Automation'
            );
            if (key) process.env.ZEPHYR_CYCLE_KEY = key;
        }

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
        resetSteps();
    },

    afterTest: async function (test, _context, { error, duration, retries }) {
        // Use the test's own title (it carries the [AIT-WIN-xxx] ID), not the describe prefix.
        const testName = test.title;
        let issue: { key: string; id: number } | null = null;

        // A failing test is rerun once (TEST_RETRIES). Only the final attempt counts:
        // a test that passes on the rerun is flaky, not a bug.
        if (error && retries && retries.attempts < retries.limit) {
            // eslint-disable-next-line no-console
            console.log(`[rerun] "${testName}" failed - rerunning before reporting`);
            return;
        }

        if (error && !process.env.JIRA_REQUIREMENT_KEY) {
            // In agentic mode the executor spec files requirement-linked bugs
            // itself, so the generic reporter is skipped to avoid double-filing.
            try {
                issue = await reportFailure({ testName, error: error as Error });
            } catch (e) {
                // Never let failure reporting mask the original test failure
                // eslint-disable-next-line no-console
                console.error(`Failure reporting errored for "${testName}":`, e);
            }
        }

        // Zephyr Scale: record Pass/Fail for tests whose title carries a case ID.
        const cycleKey = process.env.ZEPHYR_CYCLE_KEY;
        const caseKey = zephyrKeyFromTitle(testName);
        if (cycleKey && caseKey) {
            const zephyr = new ZephyrClient();
            const execId = await zephyr.createExecution({
                testCaseKey: caseKey,
                testCycleKey: cycleKey,
                status: error ? 'Fail' : 'Pass',
                comment: error
                    ? `Automated: ${(error as Error).message?.split('\n')[0] ?? ''}${issue ? ` | Bug ${issue.key}` : ''}`
                    : `Automated run, Kept Dev ${process.env.KEPT_BUILD || ''}`,
                environmentName: process.env.ZEPHYR_ENVIRONMENT || undefined,
                executionTimeMs: duration
            });
            if (execId && issue) await zephyr.linkIssue(execId, issue.id);
        }
    },

    after: async function () {
        // Cleanup after all tests
    }
};
