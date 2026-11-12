/// <reference types="@wdio/globals/types" />

import { AIAnalyzer } from '../ai/analyzer';
import { JiraClient } from '../jira/client';
import { caseIdFromTitle } from './case-id';
import { getSteps } from './steps';
import { logger } from './logger';

export interface FailedTestContext {
    testName: string;
    error: Error;
}

/**
 * After a test fails: screenshot -> (optional) AI analysis -> Jira bug in
 * Hardeep's format (Title, Description, Steps to Reproduce, Actual, Expected)
 * with the screenshot attached. Returns the Jira issue, or null when no bug was filed.
 *
 * AUTO_FILE_BUGS=false -> analysis only, no Jira bug.
 * No Jira credentials  -> nothing filed, run continues.
 */
export async function reportFailure({
    testName,
    error
}: FailedTestContext): Promise<{ key: string; id: number } | null> {
    const autoFileEnabled = process.env.AUTO_FILE_BUGS !== 'false';

    let screenshot: string | undefined;
    try {
        screenshot = await browser.takeScreenshot();
    } catch (e) {
        logger.warn(`Could not capture screenshot for "${testName}": ${e}`);
    }

    const errorMessage = (error?.message || String(error)).split('\n')[0];
    const platform = process.env.TEST_PLATFORM || 'mac';
    const build = process.env.KEPT_BUILD || 'build not set (add KEPT_BUILD to .env)';
    const environment = `Kept Dev ${build} | ${platform} | automated run ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    const caseId = caseIdFromTitle(testName);
    const cleanName = testName.replace(/\[[^\]]+\]\s*/, '').trim();

    // Optional AI root-cause text for the Description (only when OPENAI_API_KEY is set).
    let aiText = '';
    if (process.env.OPENAI_API_KEY) {
        try {
            aiText = await new AIAnalyzer().analyzeFailure({
                testName,
                errorMessage,
                stackTrace: error?.stack || '',
                screenshot,
                expectedBehavior: `Test "${testName}" should pass`,
                actualBehavior: errorMessage
            });
        } catch (e) {
            logger.warn(`AI analysis failed: ${e}`);
        }
    }

    if (!autoFileEnabled) {
        logger.info(`AUTO_FILE_BUGS=false — not filing a Jira bug for "${testName}".`);
        return null;
    }

    const jira = new JiraClient();
    const issue = await jira.createFormattedBug({
        title: `[Kept ${platform === 'windows' ? 'Windows' : 'Mac'}] ${cleanName}`,
        description:
            `Automated test ${caseId ? caseId + ' ' : ''}failed on Kept Dev (${platform}).` +
            (aiText ? `\n\nAI analysis: ${aiText.slice(0, 1500)}` : ''),
        steps: getSteps(),
        actual: errorMessage,
        expected: cleanName,
        environment,
        labels: ['kept', platform, ...(caseId ? [caseId] : [])]
    });

    if (issue && !issue.duplicate && screenshot) {
        await jira.attachScreenshot(issue.key, screenshot, `${caseId || 'failure'}.png`);
    }
    return issue;
}
