/// <reference types="@wdio/globals/types" />

import { AIAnalyzer } from '../ai/analyzer';
import { JiraClient } from '../jira/client';
import { logger } from './logger';

export interface FailedTestContext {
    testName: string;
    error: Error;
}

/**
 * Orchestrates post-failure handling for a single test:
 * screenshot -> AI root-cause analysis -> AI bug draft -> Jira ticket.
 *
 * Every step degrades gracefully: without OPENAI_API_KEY the analysis is
 * skipped, and without Jira credentials no ticket is filed.
 */
export async function reportFailure({ testName, error }: FailedTestContext): Promise<void> {
    const autoFileEnabled = process.env.AUTO_FILE_BUGS !== 'false';

    let screenshot: string | undefined;
    try {
        screenshot = await browser.takeScreenshot();
    } catch (e) {
        logger.warn(`Could not capture screenshot for "${testName}": ${e}`);
    }

    const errorMessage = error?.message || String(error);
    const stackTrace = error?.stack || '';
    const environment = `platform=${process.env.TEST_PLATFORM || 'mac'}, node=${process.version}`;

    const analyzer = new AIAnalyzer();
    const analysis = await analyzer.analyzeFailure({
        testName,
        errorMessage,
        stackTrace,
        screenshot,
        expectedBehavior: `Test "${testName}" should pass`,
        actualBehavior: errorMessage
    });

    logger.info(`AI failure analysis for "${testName}":\n${analysis}`);

    if (!autoFileEnabled) {
        logger.info('AUTO_FILE_BUGS=false — skipping Jira ticket creation.');
        return;
    }

    const bug = await analyzer.generateBugReport(analysis, {
        testName,
        errorMessage,
        environment
    });

    const jira = new JiraClient();
    const issueKey = await jira.createBug({ ...bug, environment });

    if (issueKey) {
        logger.info(`Filed/linked Jira issue ${issueKey} for failed test "${testName}"`);
    } else {
        logger.info(`No Jira issue created for "${testName}" (Jira not configured).`);
    }
}
