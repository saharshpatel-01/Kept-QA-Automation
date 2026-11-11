/// <reference types="@wdio/globals/types" />

import { RequirementAgent } from '../../../src/ai/requirement-agent';
import { TestAction, ScreenTarget } from '../../../src/ai/test-plan';
import {
    AssistantScreen,
    MeetingsScreen,
    SpeechToTextScreen,
    VocabularyScreen,
    TasksScreen,
    InsightsScreen,
    FeedbackScreen,
    ScreenPage
} from '../../../src/pages/screens';
import { logger } from '../../../src/utils/logger';

/**
 * Executor for AI-generated, requirement-driven test plans.
 *
 * The plan (plan.json) is produced from a Jira ticket by RequirementAgent
 * (wired in wdio.conf onPrepare). This spec reads it at load time, turns each
 * case into an `it(...)`, runs the steps against the live app, and on any
 * failure asks the agent to file a Jira bug linked back to the requirement —
 * no human action required.
 */
const plan = RequirementAgent.loadPlan();
const agent = new RequirementAgent();

const assistant = new AssistantScreen();
const screens: Record<ScreenTarget, ScreenPage> = {
    'AI Assistant': assistant,
    Meetings: new MeetingsScreen(),
    'Speech to Text': new SpeechToTextScreen(),
    Vocabulary: new VocabularyScreen(),
    Tasks: new TasksScreen(),
    Insights: new InsightsScreen(),
    Feedback: new FeedbackScreen()
};

interface StepContext {
    current: ScreenPage;
    lastSent: string;
}

async function runStep(step: TestAction, ctx: StepContext): Promise<void> {
    switch (step.action) {
        case 'navigate': {
            const page = screens[step.screen];
            await page.open();
            ctx.current = page;
            return;
        }
        case 'sendMessage': {
            await assistant.open();
            ctx.current = assistant;
            await assistant.sendMessage(step.text);
            ctx.lastSent = step.text;
            return;
        }
        case 'expectReply': {
            const reply = await assistant.waitForReply(ctx.lastSent);
            expect(reply.length).toBeGreaterThan(0);
            return;
        }
        case 'expectReplyContains': {
            const reply = await assistant.waitForReply(ctx.lastSent);
            expect(assistant.replyContains(reply, step.text)).toBe(true);
            return;
        }
        case 'expectText': {
            expect(await ctx.current.hasText(step.text)).toBe(true);
            return;
        }
        case 'expectButton': {
            expect(await ctx.current.hasButton(step.label)).toBe(true);
            return;
        }
        case 'search': {
            await assistant.open();
            expect(await assistant.searchConversations(step.query)).toBe(true);
            return;
        }
    }
}

describe('Kept E2E - AI requirement-driven suite @e2e @agent', () => {
    if (!plan) {
        it('requirement plan', function () {
            // No plan.json yet — skip rather than fail default runs. Provide a
            // JIRA_REQUIREMENT_KEY to have the agent generate one.
            this.skip();
        });
        return;
    }

    logger.info(
        `[agent] Executing ${plan.cases.length} case(s) for ${plan.requirementKey}: "${plan.requirementSummary}"`
    );

    for (const testCase of plan.cases) {
        it(testCase.title, async function () {
            this.timeout(240000);
            const ctx: StepContext = { current: assistant, lastSent: '' };
            try {
                for (const step of testCase.steps) {
                    await runStep(step, ctx);
                }
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                // Autonomous logging: file a Jira bug linked to the requirement.
                let screenshot: string | undefined;
                try {
                    screenshot = await browser.takeScreenshot();
                } catch {
                    // screenshot is best-effort
                }
                await agent.reportFailure(plan.requirementKey, testCase.title, err, screenshot);
                throw err; // keep the test red so the run reflects reality
            }
        });
    }
});
