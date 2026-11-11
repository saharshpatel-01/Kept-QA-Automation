import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { AIAnalyzer } from './analyzer';
import { JiraClient } from '../jira/client';
import { TestPlan } from './test-plan';
import { logger } from '../utils/logger';

/** Where the generated plan is written and read by the executor spec. */
export const PLAN_PATH = './test/specs/generated/plan.json';

/**
 * Autonomous requirement → tests → bug pipeline.
 *
 *  1. Fetch a Jira requirement/ticket.
 *  2. Ask the AI to generate a capability-based test plan from it.
 *  3. (executor spec runs the plan against the live app)
 *  4. On a failing case, file a Jira bug linked back to the requirement.
 *
 * Every step degrades gracefully: without OPENAI_API_KEY a fallback smoke plan
 * is used; without Jira credentials nothing is fetched/filed and the run logs
 * what it would have done.
 */
export class RequirementAgent {
    private readonly ai = new AIAnalyzer();
    private readonly jira = new JiraClient();

    /**
     * Build a test plan for `requirementKey` and persist it to PLAN_PATH.
     * When Jira isn't configured, a minimal placeholder requirement is used so
     * the pipeline still produces a runnable (fallback) plan.
     */
    async buildPlan(requirementKey: string): Promise<TestPlan> {
        const issue = (await this.jira.getIssue(requirementKey)) ?? {
            key: requirementKey,
            summary: `Requirement ${requirementKey}`,
            description: '',
            labels: []
        };
        logger.info(`[agent] Building test plan for ${issue.key}: "${issue.summary}"`);

        const plan = await this.ai.generateTestPlan({
            key: issue.key,
            summary: issue.summary,
            description: issue.description
        });

        mkdirSync(dirname(PLAN_PATH), { recursive: true });
        writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2), 'utf8');
        logger.info(`[agent] Wrote ${plan.cases.length} test case(s) to ${PLAN_PATH}`);
        return plan;
    }

    /** Load a previously generated plan, or null if none exists yet. */
    static loadPlan(): TestPlan | null {
        if (!existsSync(PLAN_PATH)) return null;
        try {
            return JSON.parse(readFileSync(PLAN_PATH, 'utf8')) as TestPlan;
        } catch (error) {
            logger.error('[agent] Could not read plan.json:', error);
            return null;
        }
    }

    /**
     * File a Jira bug for a failing test case and link it back to the
     * requirement via a comment. Gated by AUTO_FILE_BUGS (default on).
     * Returns the created/linked issue key, or null.
     */
    async reportFailure(
        requirementKey: string,
        caseTitle: string,
        error: Error,
        screenshot?: string
    ): Promise<string | null> {
        if (process.env.AUTO_FILE_BUGS === 'false') {
            logger.info('[agent] AUTO_FILE_BUGS=false — not filing a bug.');
            return null;
        }

        const errorMessage = error?.message || String(error);
        const environment = `requirement=${requirementKey}, platform=${process.env.TEST_PLATFORM || 'mac'}, node=${process.version}`;

        const analysis = await this.ai.analyzeFailure({
            testName: caseTitle,
            errorMessage,
            stackTrace: error?.stack || '',
            screenshot,
            expectedBehavior: `Requirement ${requirementKey}: "${caseTitle}" should pass`,
            actualBehavior: errorMessage
        });

        const bug = await this.ai.generateBugReport(analysis, {
            testName: caseTitle,
            errorMessage,
            environment
        });

        const issueKey = await this.jira.createBug({
            ...bug,
            labels: [...bug.labels, `requirement:${requirementKey}`],
            environment
        });

        if (issueKey) {
            await this.jira.addComment(
                requirementKey,
                `Automated QA found a failing scenario "${caseTitle}". Logged bug ${issueKey}.`
            );
            logger.info(
                `[agent] Filed ${issueKey} for "${caseTitle}" and linked to ${requirementKey}`
            );
        } else {
            logger.info(`[agent] Would file a bug for "${caseTitle}" (Jira not configured).`);
        }
        return issueKey;
    }
}
