import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { TestPlan, TestCase, ACTION_VOCABULARY } from './test-plan';

/**
 * AI Analyzer for test failure analysis and defect report generation
 */
export class AIAnalyzer {
    private openai: OpenAI;

    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            logger.warn('OPENAI_API_KEY not set. AI analysis will be disabled.');
        }
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || ''
        });
    }

    /**
     * Analyze test failure and generate insights
     */
    async analyzeFailure(context: {
        testName: string;
        errorMessage: string;
        stackTrace: string;
        screenshot?: string;
        expectedBehavior: string;
        actualBehavior: string;
    }): Promise<string> {
        if (!process.env.OPENAI_API_KEY) {
            return 'AI analysis disabled: OPENAI_API_KEY not configured';
        }

        try {
            const prompt = `
Analyze this test failure:

Test: ${context.testName}
Error: ${context.errorMessage}
Stack Trace: ${context.stackTrace}

Expected: ${context.expectedBehavior}
Actual: ${context.actualBehavior}

Provide:
1. Root cause analysis
2. Whether this is a product bug or test issue
3. Steps to reproduce
4. Suggested fix
5. Priority assessment (Critical/High/Medium/Low)
`;

            const response = await this.openai.chat.completions.create({
                model: process.env.AI_MODEL || 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a QA engineer analyzing test failures. Provide concise, actionable analysis.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3
            });

            return response.choices[0]?.message?.content || 'No analysis generated';
        } catch (error) {
            logger.error('AI analysis failed:', error);
            return `AI analysis error: ${error}`;
        }
    }

    /**
     * Generate Jira bug report draft
     */
    async generateBugReport(
        analysis: string,
        context: {
            testName: string;
            errorMessage: string;
            environment: string;
        }
    ): Promise<{
        summary: string;
        description: string;
        priority: string;
        labels: string[];
    }> {
        if (!process.env.OPENAI_API_KEY) {
            return {
                summary: context.testName,
                description: `Error: ${context.errorMessage}\n\nEnvironment: ${context.environment}`,
                priority: 'Medium',
                labels: ['automation-detected']
            };
        }

        try {
            const prompt = `
Based on this test failure analysis, generate a Jira bug report:

${analysis}

Test: ${context.testName}
Environment: ${context.environment}

Generate JSON with:
- summary: concise bug title (max 120 chars)
- description: detailed bug description in Jira markdown format
- priority: Critical/High/Medium/Low
- labels: relevant labels as array

Return only valid JSON.
`;

            const response = await this.openai.chat.completions.create({
                model: process.env.AI_MODEL || 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a QA engineer creating bug reports. Return only valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content || '{}';
            return JSON.parse(content);
        } catch (error) {
            logger.error('Bug report generation failed:', error);
            return {
                summary: `Bug detected in ${context.testName}`,
                description: `Error: ${context.errorMessage}\n\nEnvironment: ${context.environment}\n\nAnalysis:\n${analysis}`,
                priority: 'Medium',
                labels: ['automation-detected', 'needs-review']
            };
        }
    }

    /**
     * Check if response is valid and meets expectations
     */
    async validateResponse(
        expectedBehavior: string,
        actualResponse: string
    ): Promise<{
        isValid: boolean;
        confidence: number;
        reasoning: string;
    }> {
        if (!process.env.OPENAI_API_KEY) {
            return {
                isValid: true,
                confidence: 0,
                reasoning: 'AI validation disabled'
            };
        }

        try {
            const prompt = `
Expected behavior: ${expectedBehavior}
Actual response: ${actualResponse}

Is the actual response valid? Return JSON with:
- isValid: boolean
- confidence: number 0-1
- reasoning: brief explanation
`;

            const response = await this.openai.chat.completions.create({
                model: process.env.AI_MODEL || 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are validating AI assistant responses. Return only valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.2,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content || '{}';
            return JSON.parse(content);
        } catch (error) {
            logger.error('Response validation failed:', error);
            return {
                isValid: true,
                confidence: 0,
                reasoning: 'Validation error'
            };
        }
    }

    /**
     * Suggest an alternative selector for a locator that stopped matching.
     * Used by the self-healing layer. Returns a WebdriverIO-compatible selector
     * string (e.g. an accessibility id "~AXTextField" or an XPath), or null.
     */
    async suggestLocator(context: {
        elementName: string;
        triedSelectors: string[];
        pageSource: string;
    }): Promise<string | null> {
        if (!process.env.OPENAI_API_KEY) {
            return null;
        }

        try {
            const prompt = `
A desktop UI automation locator stopped matching. Suggest ONE replacement selector.

Element we need: ${context.elementName}
Selectors already tried (all failed): ${context.triedSelectors.join(', ')}

This is a macOS app automated via Appium Mac2. Valid selector forms:
- Accessibility id:  "~SomeId"
- XPath by AX role:  "//XCUIElementTypeTextField"
- Predicate string:  "-ios predicate string:elementType == 48"

Here is the current accessibility tree (XML), possibly truncated:
${context.pageSource.slice(0, 6000)}

Return JSON only: {"selector": "<one selector string>", "reasoning": "<short>"}.
If nothing suitable exists, return {"selector": null, "reasoning": "<short>"}.
`;

            const response = await this.openai.chat.completions.create({
                model: process.env.AI_MODEL || 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You repair broken UI automation selectors. Return only valid JSON.'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content || '{}';
            const parsed = JSON.parse(content) as { selector: string | null };
            return parsed.selector || null;
        } catch (error) {
            logger.error('Locator suggestion failed:', error);
            return null;
        }
    }

    /**
     * Generate a capability-based test plan from a Jira requirement. The AI only
     * composes steps from the allowed action vocabulary (see test-plan.ts) so the
     * output is safe to execute. Falls back to a minimal smoke plan when no API
     * key is configured.
     */
    async generateTestPlan(requirement: {
        key: string;
        summary: string;
        description: string;
    }): Promise<TestPlan> {
        const fallback: TestPlan = {
            requirementKey: requirement.key,
            requirementSummary: requirement.summary,
            cases: [
                {
                    title: `Smoke: AI Assistant is reachable for ${requirement.key}`,
                    steps: [
                        { action: 'navigate', screen: 'AI Assistant' },
                        { action: 'expectButton', label: 'Send' }
                    ]
                }
            ]
        };

        if (!process.env.OPENAI_API_KEY) {
            logger.warn('OPENAI_API_KEY not set; using fallback smoke test plan.');
            return fallback;
        }

        try {
            const prompt = `
You are a senior QA automation engineer for the "Kept" macOS app (an AI assistant
with screens: AI Assistant, Meetings, Speech to Text, Vocabulary, Tasks, Insights,
Feedback).

Generate end-to-end test cases that verify this requirement:

Key: ${requirement.key}
Summary: ${requirement.summary}
Description:
${requirement.description || '(no description provided)'}

${ACTION_VOCABULARY}

Rules:
- Produce 3-6 focused test cases covering happy path, an edge case, and a negative/robustness case where relevant.
- Each case: a short "title" and an ordered "steps" array using ONLY the allowed actions.
- Start chat cases with a navigate to "AI Assistant".
- Prefer "expectReply" over asserting exact AI wording (replies are non-deterministic).
- Keep prompts short.

Return ONLY valid JSON: { "cases": [ { "title": string, "steps": [...] } ] }
`.trim();

            const response = await this.openai.chat.completions.create({
                model: process.env.AI_MODEL || 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You generate executable QA test plans as strict JSON using only the allowed action vocabulary.'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content || '{}';
            const parsed = JSON.parse(content) as { cases?: TestCase[] };
            const cases = Array.isArray(parsed.cases) ? parsed.cases : [];
            if (cases.length === 0) {
                logger.warn('AI returned no test cases; using fallback plan.');
                return fallback;
            }
            return {
                requirementKey: requirement.key,
                requirementSummary: requirement.summary,
                cases
            };
        } catch (error) {
            logger.error('Test plan generation failed; using fallback plan:', error);
            return fallback;
        }
    }
}
