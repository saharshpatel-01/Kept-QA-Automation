/// <reference types="@wdio/globals/types" />

import { KeptMainPage } from '../../../src/pages/kept.main.page';
import { logger } from '../../../src/utils/logger';
import { launchKept } from '../../support/kept.fixture';
import { prompts, markers, expected } from '../../data/prompts';

describe('Kept AI Assistant - Smoke Tests @smoke', () => {
    let keptPage: KeptMainPage;

    before(async () => {
        keptPage = await launchKept();
    });

    beforeEach(async () => {
        // Ensure we're on the assistant screen before each test
        const isReady = await keptPage.isOnAssistantScreen();
        if (!isReady) {
            logger.warn('Not on assistant screen, attempting to navigate...');
            await keptPage.waitForPageLoad();
        }
    });

    it('should be on assistant screen with chat input visible', async () => {
        const isReady = await keptPage.isOnAssistantScreen();
        expect(isReady).toBe(true);
        logger.info('✓ Assistant screen is ready');
    });

    it('should send prompt and verify assistant replies', async () => {
        const marker = markers.echo;
        const prompt = prompts.echoMarker(marker);

        logger.info(`Sending prompt: ${prompt}`);
        await keptPage.sendMessage(prompt);

        // Wait for reply containing the marker
        const conversation = await keptPage.waitForTextInConversation(marker, 30000);

        // Marker should appear at least twice (in prompt echo + reply)
        const markerCount = (conversation.match(new RegExp(marker, 'gi')) || []).length;

        expect(markerCount).toBeGreaterThanOrEqual(2);
        logger.info(`✓ Found marker ${markerCount} times in conversation`);

        await keptPage.captureConversation('echo-marker-test');
    });

    it('should handle simple math question', async () => {
        const prompt = prompts.simpleMath;

        logger.info('Testing simple math...');
        const reply = await keptPage.sendAndGetReply(prompt, 30000);

        logger.info(`Received reply: ${reply}`);

        expect(reply.toLowerCase()).toContain(expected.simpleMathAnswer);

        await keptPage.captureConversation('simple-math-test');
    });

    it('should handle follow-up questions in same conversation', async () => {
        const firstPrompt = prompts.capitalOfFrance;
        const secondPrompt = prompts.followUpPopulation;

        logger.info('Testing conversation continuity...');

        // First question
        const firstReply = await keptPage.sendAndGetReply(firstPrompt, 30000);
        expect(firstReply.toLowerCase()).toContain(expected.capitalOfFrance);
        logger.info(`First reply received: ${firstReply.substring(0, 100)}...`);

        // Follow-up question (should understand "its" refers to Paris)
        const secondReply = await keptPage.sendAndGetReply(secondPrompt, 30000);
        expect(secondReply.length).toBeGreaterThan(0);
        logger.info(`Second reply received: ${secondReply.substring(0, 100)}...`);

        await keptPage.captureConversation('follow-up-test');
    });

    it('should display conversation history correctly', async () => {
        const prompt = 'Hello, please confirm you received this message.';

        await keptPage.sendMessage(prompt);
        await browser.pause(2000); // Wait a bit for response to start

        const conversation = await keptPage.getConversationText();

        // Conversation should contain our prompt
        expect(conversation.toLowerCase()).toContain('hello');

        logger.info(`Conversation history captured (${conversation.length} chars)`);

        await keptPage.captureConversation('conversation-history');
    });

    afterEach(async function () {
        if (this.currentTest?.state === 'failed') {
            const testName = this.currentTest.title.replace(/[^a-z0-9]/gi, '-');
            await keptPage.captureConversation(`failure-${testName}`);

            // Log conversation for debugging
            const conversation = await keptPage.getConversationText();
            logger.error(`Test failed. Last conversation:\n${conversation}`);
        }
    });
});
