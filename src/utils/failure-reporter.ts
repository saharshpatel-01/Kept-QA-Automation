/// <reference types="@wdio/globals/types" />

import { mkdirSync, writeFileSync } from 'node:fs';
import { AIAnalyzer } from '../ai/analyzer';
import { FormattedBug, JiraClient } from '../jira/client';
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
 * BUG_MODE (default "review"):
 *   review -> NO Jira ticket. A bug draft (.md + .json + .png) is saved in bug-drafts/
 *             for Hardeep to review; after approval: npx ts-node -T scripts/file-bug.ts <draft.json>
 *   jira   -> Jira bug created directly (only when Hardeep switches it on).
 *   off    -> nothing saved or filed.
 * AUTO_FILE_BUGS=false is treated as "off" (older setting).
 */
export function bugMode(): 'review' | 'jira' | 'off' {
    if (process.env.AUTO_FILE_BUGS === 'false') return 'off';
    const m = (process.env.BUG_MODE || 'review').toLowerCase();
    return m === 'jira' || m === 'off' ? m : 'review';
}
export async function reportFailure({
    testName,
    error
}: FailedTestContext): Promise<{ key: string; id: number } | null> {
    const mode = bugMode();
    if (mode === 'off') return null;

    let screenshot: string | undefined;
    try {
        screenshot = await browser.takeScreenshot();
    } catch (e) {
        logger.warn(`Could not capture screenshot for "${testName}": ${e}`);
    }

    const errorMessage = (error?.message || String(error)).split('\n')[0];
    const platform = process.env.TEST_PLATFORM || 'mac';
    const build = process.env.KEPT_BUILD || 'build not set (add KEPT_BUILD to .env)';
    const osName = platform === 'windows' ? 'Windows' : 'Mac';
    const runAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const environment = `Observed on Kept Dev ${build}, ${osName} (automated run ${runAt} UTC).`;
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

    const bug: FormattedBug = {
        title: `[Dev ${osName}] ${cleanName}`,
        description:
            `Automated test ${caseId ? caseId + ' ' : ''}failed: ${cleanName}.` +
            (aiText ? `\n\nAI analysis: ${aiText.slice(0, 1500)}` : ''),
        steps: getSteps(),
        actual: errorMessage,
        expected: cleanName,
        environment,
        labels: ['kept', platform, ...(caseId ? [caseId] : [])]
    };

    if (mode === 'review') {
        saveDraft(bug, caseId, screenshot);
        return null;
    }

    const jira = new JiraClient();
    const issue = await jira.createFormattedBug(bug);

    if (issue && !issue.duplicate && screenshot) {
        await jira.attachScreenshot(issue.key, screenshot, `${caseId || 'failure'}.png`);
    }
    return issue;
}

/** Save a bug draft for review: <stamp>_<case>.md (readable), .json (for file-bug.ts), .png. */
function saveDraft(bug: FormattedBug, caseId: string | null, screenshot?: string): void {
    mkdirSync('./bug-drafts', { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const base = `./bug-drafts/${stamp}_${caseId || 'no-id'}`;
    const md = [
        `# ${bug.title}`,
        '',
        `**Bug Title:** ${bug.title.replace(/^\[[^\]]+\]\s*/, '')}`,
        '',
        '**Description:**',
        `${bug.description} ${bug.environment}`,
        '',
        '**Steps to Reproduce:**',
        ...(bug.steps.length ? bug.steps : ['(steps not recorded)']).map(
            (s, i) => `${i + 1}. ${s}`
        ),
        '',
        '**Actual Result:**',
        bug.actual,
        '',
        '**Expected Result:**',
        bug.expected,
        '',
        '---',
        'Review status: PENDING (failed twice). Check the screenshot: product bug, or script/environment problem?'
    ].join('\n');
    writeFileSync(`${base}.md`, md);
    writeFileSync(
        `${base}.json`,
        JSON.stringify(
            { ...bug, screenshot: screenshot ? `${base}.png` : null, filed: null },
            null,
            2
        )
    );
    if (screenshot) writeFileSync(`${base}.png`, Buffer.from(screenshot, 'base64'));
    logger.info(`Bug draft saved for review (no Jira ticket): ${base}.md`);
}
