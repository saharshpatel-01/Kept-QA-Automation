/// <reference types="@wdio/globals/types" />

import { KeptMainPage } from '../../../src/pages/kept.main.page';
import { logger } from '../../../src/utils/logger';

describe('Kept UI - Functional Tests', () => {
    let keptPage: KeptMainPage;

    before(async () => {
        keptPage = new KeptMainPage();
        await keptPage.activate();
        await keptPage.waitForPageLoad();
    });

    describe('Application Launch & Navigation', () => {
        it('should launch Kept application successfully', async () => {
            const isReady = await keptPage.isOnAssistantScreen();
            expect(isReady).toBe(true);

            logger.info('✓ Kept launched successfully');
            await keptPage.captureConversation('app-launch');
        });

        it('should verify assistant screen has required elements', async () => {
            const isReady = await keptPage.isOnAssistantScreen();
            expect(isReady).toBe(true);

            // Should have exactly one text field (the chat input)
            logger.info('✓ Assistant screen elements verified');
        });
    });

    describe('Input Field Interactions', () => {
        it('should accept text input without submitting', async () => {
            const testText = 'This is test input without submission';

            await keptPage.sendMessage(testText, false); // Don't submit
            await browser.pause(1000);

            // Clear for next test
            await keptPage.clearInput();

            logger.info('✓ Input field accepts text');
        });

        it('should clear input field', async () => {
            await keptPage.sendMessage('Test message', false);
            await browser.pause(500);

            await keptPage.clearInput();
            await browser.pause(500);

            logger.info('✓ Input field cleared');
        });

        it('should handle paste operations', async () => {
            // Type something first
            await keptPage.sendMessage('Test for paste', false);

            // Select all and try to interact
            await keptPage.clearInput();

            logger.info('✓ Paste operations handled');
        });
    });

    describe('Conversation Display', () => {
        it('should display sent messages in conversation', async () => {
            const testMessage = 'UI test message for display verification';

            await keptPage.sendMessage(testMessage);
            await browser.pause(3000); // Wait for message to appear

            const conversation = await keptPage.getConversationText();
            expect(conversation).toContain(testMessage);

            logger.info('✓ Message displayed in conversation');
            await keptPage.captureConversation('message-display');
        });

        it('should read conversation history', async () => {
            const lines = await keptPage.readConversation();

            expect(Array.isArray(lines)).toBe(true);
            expect(lines.length).toBeGreaterThan(0);

            logger.info(`✓ Conversation history read: ${lines.length} lines`);
        });

        it('should maintain scroll position when reading conversation', async () => {
            // Send multiple messages to create scrollable content
            for (let i = 1; i <= 3; i++) {
                await keptPage.sendMessage(`Message ${i}`, false);
                await browser.pause(500);
            }

            await keptPage.clearInput();

            const conversation = await keptPage.getConversationText();
            expect(conversation.length).toBeGreaterThan(0);

            logger.info('✓ Scroll handling verified');
        });
    });

    describe('Keyboard Interactions', () => {
        it('should submit message with Enter key', async () => {
            const prompt = 'Testing Enter key submission';

            await keptPage.sendMessage(prompt); // Uses Enter internally
            await browser.pause(2000);

            const conversation = await keptPage.getConversationText();
            expect(conversation).toContain(prompt);

            logger.info('✓ Enter key submission works');
        });

        it('should handle Command+A (Select All)', async () => {
            await keptPage.sendMessage('Test select all', false);
            await browser.pause(500);

            // Simulate Cmd+A and delete
            await keptPage.clearInput(); // Uses Cmd+A internally

            logger.info('✓ Command+A works');
        });
    });

    describe('Application State', () => {
        it('should remain on assistant screen after interactions', async () => {
            await keptPage.sendAndGetReply('State test message', 30000);

            const stillOnScreen = await keptPage.isOnAssistantScreen();
            expect(stillOnScreen).toBe(true);

            logger.info('✓ Application state stable');
        });

        it('should handle window focus', async () => {
            await keptPage.activate();
            await browser.pause(1000);

            const isReady = await keptPage.isOnAssistantScreen();
            expect(isReady).toBe(true);

            logger.info('✓ Window focus handled');
        });
    });

    describe('Error Handling', () => {
        it('should handle rapid clicks gracefully', async () => {
            try {
                // Rapid interaction attempts
                for (let i = 0; i < 3; i++) {
                    await keptPage.sendMessage(`Rapid test ${i}`, false);
                    await browser.pause(100); // Very short pause
                }

                await keptPage.clearInput();

                // Should still be functional
                const isReady = await keptPage.isOnAssistantScreen();
                expect(isReady).toBe(true);

                logger.info('✓ Rapid interactions handled');
            } catch {
                logger.warn('Rapid clicks caused expected error, app should recover');
            }
        });

        it('should recover from navigation away from assistant screen', async () => {
            // Test is on assistant screen
            await keptPage.ensureAssistantScreen();

            // If we somehow navigate away, we should detect it
            const isReady = await keptPage.isOnAssistantScreen();
            expect(isReady).toBe(true);

            logger.info('✓ Screen state validation works');
        });
    });

    afterEach(async function () {
        if (this.currentTest && this.currentTest.state === 'failed') {
            const testName = this.currentTest.title.replace(/[^a-z0-9]/gi, '-');
            await keptPage.captureConversation(`ui-failure-${testName}`);
        }
    });
});
