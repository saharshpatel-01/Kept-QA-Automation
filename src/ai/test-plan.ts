/**
 * Capability-based test plan. The AI does NOT emit runnable code — it composes
 * steps from this fixed vocabulary, and a generic executor runs them against the
 * real app. This keeps agent-generated tests safe, reviewable and reliable.
 */

/** The only actions the AI is allowed to use when generating a test plan. */
export type TestAction =
    | { action: 'navigate'; screen: ScreenTarget }
    | { action: 'sendMessage'; text: string }
    | { action: 'expectReply' }
    | { action: 'expectReplyContains'; text: string }
    | { action: 'expectText'; text: string }
    | { action: 'expectButton'; label: string }
    | { action: 'search'; query: string };

export type ScreenTarget =
    | 'AI Assistant'
    | 'Meetings'
    | 'Speech to Text'
    | 'Vocabulary'
    | 'Tasks'
    | 'Insights'
    | 'Feedback';

export interface TestCase {
    /** Short, human-readable test title (becomes the `it(...)` name). */
    title: string;
    steps: TestAction[];
}

export interface TestPlan {
    /** Jira requirement key this plan was generated from (e.g. "KEPT-123"). */
    requirementKey: string;
    requirementSummary: string;
    cases: TestCase[];
}

/** Documentation of the vocabulary, injected into the AI prompt. */
export const ACTION_VOCABULARY = `
Allowed step actions (use ONLY these):
- { "action": "navigate", "screen": "<AI Assistant|Meetings|Speech to Text|Vocabulary|Tasks|Insights|Feedback>" }
- { "action": "sendMessage", "text": "<prompt to type into the AI Assistant chat>" }
- { "action": "expectReply" }                              // assert the assistant replied with something
- { "action": "expectReplyContains", "text": "<keyword>" } // assert the reply contains a keyword
- { "action": "expectText", "text": "<visible text>" }     // assert text is visible on the current screen
- { "action": "expectButton", "label": "<button label>" }  // assert a button/control is present
- { "action": "search", "query": "<text>" }                // type into the Search conversations box
`.trim();
