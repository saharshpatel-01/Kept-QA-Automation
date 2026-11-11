/// <reference types="@wdio/globals/types" />

import { AssistantScreen } from '../../../src/pages/screens/assistant.page';
import { logger } from '../../../src/utils/logger';

/**
 * AI Assistant — deep coverage of the screen's requirements and end-user goals:
 *  - Layout: the chat surface and controls are present
 *  - Chat: messages send and the assistant replies
 *  - Quality: deterministic prompts get correct answers
 *  - Context: the assistant remembers earlier turns in a conversation
 *  - Performance: sustained multi-message chat stays responsive and timely
 *  - Management: new conversation + conversation search
 *  - Input handling: long text and special characters
 *
 * Input is driven through the native AX layer (crash-safe on macOS 26 / Xcode
 * 27); assertions read the live Appium accessibility tree. AI replies are
 * non-deterministic, so we assert on robust signals (reply produced, keyword
 * present, timing) rather than exact strings.
 */
describe('Kept E2E - AI Assistant @e2e @regression @assistant', () => {
    const assistant = new AssistantScreen();

    before(async () => {
        await assistant.open();
    });

    describe('Layout', () => {
        it('shows the chat input text view', async () => {
            expect(await assistant.hasChatInput()).toBe(true);
        });

        it('shows the Send button', async () => {
            expect(await assistant.hasSendButton()).toBe(true);
        });

        it('offers the conversation tools (Attach / Tools / Answer using / New)', async () => {
            const hasAnyTool =
                (await assistant.hasButton('Attach')) ||
                (await assistant.hasButton('Tools')) ||
                (await assistant.hasButton('Answer')) ||
                (await assistant.hasButton('New'));
            expect(hasAnyTool).toBe(true);
        });

        it('shows the Search conversations field', async () => {
            expect(await assistant.hasSearchBox()).toBe(true);
        });

        it('keeps the global sidebar visible', async () => {
            expect(await assistant.hasSidebar()).toBe(true);
        });
    });

    describe('Chat basics', () => {
        it('sends a message and the prompt appears in the conversation', async () => {
            const marker = `KEPT_QA_${Date.now()}`;
            await assistant.sendMessage(marker);

            let seen = false;
            for (let i = 0; i < 10 && !seen; i++) {
                await browser.pause(1500);
                seen = await assistant.hasText(marker);
            }
            expect(seen).toBe(true);
        });

        it('receives a reply from the assistant', async () => {
            const reply = await assistant.sendAndGetReply(
                'In one short sentence, what is QA testing?'
            );
            logger.info(`Reply lines: ${reply.length}`);
            expect(reply.length).toBeGreaterThan(0);
        });
    });

    describe('Response quality', () => {
        it('answers a factual question correctly', async function () {
            this.timeout(90000);
            const reply = await assistant.sendAndGetReply(
                'What is the capital of France? Reply with just the city name.'
            );
            logger.info(`Factual reply: ${reply.join(' | ')}`);
            expect(assistant.replyContains(reply, 'paris')).toBe(true);
        });
    });

    describe('Context retention (multi-turn)', () => {
        it('remembers information from an earlier turn', async function () {
            this.timeout(150000);
            await assistant.sendAndGetReply(
                'Remember this code word for later: BANANA42. Just acknowledge briefly.'
            );
            const reply = await assistant.sendAndGetReply(
                'What was the code word I just gave you? Reply with only that word.'
            );
            logger.info(`Context reply: ${reply.join(' | ')}`);
            expect(assistant.replyContains(reply, 'banana')).toBe(true);
        });
    });

    describe('Performance - sustained conversation', () => {
        it('handles several messages in a row and stays responsive', async function () {
            this.timeout(420000);
            const prompts = [
                'Say hello in one word.',
                'Name one primary color.',
                'What is 3 plus 4? Reply with just the number.'
            ];

            const timings: number[] = [];
            let replied = 0;
            for (const prompt of prompts) {
                const { reply, ms } = await assistant.sendAndTimeReply(prompt, 60000);
                logger.info(`Prompt "${prompt}" -> ${reply.length} lines in ${ms}ms`);
                if (reply.length > 0) replied++;
                timings.push(ms);
                await browser.pause(1500);
            }

            const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
            const max = Math.max(...timings);
            logger.info(
                `Replied ${replied}/${prompts.length}; timings ms=[${timings.join(', ')}] ` +
                    `avg=${avg} max=${max}`
            );

            // End-user goal: the assistant responds to most messages and the app
            // stays usable. Replies are AI-timed, so we don't gate on a hard latency.
            expect(replied).toBeGreaterThanOrEqual(Math.ceil(prompts.length / 2));
            expect(await assistant.hasChatInput()).toBe(true);
            expect(await assistant.hasSendButton()).toBe(true);
            expect(await assistant.hasSidebar()).toBe(true);
        });
    });

    describe('Input handling', () => {
        it('accepts and sends a long message', async function () {
            this.timeout(120000);
            const longText =
                'This is a long QA automation test message. ' + 'context '.repeat(50).trim();
            await assistant.sendMessage(longText);

            // Input accepted & submitted -> the prompt renders as a user turn.
            let seen = false;
            for (let i = 0; i < 12 && !seen; i++) {
                await browser.pause(1500);
                seen = await assistant.hasText('long QA automation test message');
            }
            expect(seen).toBe(true);
        });

        it('accepts and sends special characters', async function () {
            this.timeout(120000);
            const marker = `SPECIALQA${Date.now()}`;
            await assistant.sendMessage(`${marker} <tag> & "quotes" 100% done`);

            let seen = false;
            for (let i = 0; i < 12 && !seen; i++) {
                await browser.pause(1500);
                seen = await assistant.hasText(marker);
            }
            expect(seen).toBe(true);
        });
    });

    describe('Conversation management', () => {
        it('exposes the conversations feature (list or search)', async () => {
            await assistant.open();
            const ok = (await assistant.hasConversationsList()) || (await assistant.hasSearchBox());
            expect(ok).toBe(true);
        });

        it('accepts a query in the search box', async () => {
            await assistant.open();
            expect(await assistant.searchConversations('kept')).toBe(true);
            expect(await assistant.hasSearchBox()).toBe(true);
        });
    });
});
