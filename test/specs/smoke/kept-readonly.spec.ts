/// <reference types="@wdio/globals/types" />

import { KeptMainPage } from '../../../src/pages/kept.main.page';
import { logger } from '../../../src/utils/logger';
import { launchKept } from '../../support/kept.fixture';

/**
 * Read-only UI verification for the Kept Assistant screen. These checks do not
 * synthesize input (click/type), so they run reliably even on hosts where
 * WebDriverAgentMac input is blocked (see README "Known Limitations").
 */
describe('Kept - Read-only UI verification @smoke @readonly', () => {
    let keptPage: KeptMainPage;

    before(async () => {
        keptPage = await launchKept();
    });

    it('launches on the AI Assistant screen', async () => {
        expect(await keptPage.isOnAssistantScreen()).toBe(true);
    });

    it('has the Kept window open', async () => {
        const title = await keptPage.getWindowTitle();
        logger.info(`Window title: "${title}"`);
        expect(title.toLowerCase()).toContain('kept');
    });

    it('shows the chat input', async () => {
        expect(await keptPage.hasChatInput()).toBe(true);
    });

    it('shows the Send button', async () => {
        expect(await keptPage.hasSendButton()).toBe(true);
    });

    it('shows the core sidebar navigation', async () => {
        const labels = await keptPage.getButtonLabels();
        logger.info(`Found ${labels.length} buttons`);
        for (const expectedLabel of ['AI Assistant', 'Meetings', 'Tasks']) {
            expect(labels).toContain(expectedLabel);
        }
    });

    it('renders visible conversation text', async () => {
        const text = await keptPage.getConversationText();
        logger.info(`Conversation text length: ${text.length}`);
        expect(text.length).toBeGreaterThan(0);
    });

    it('captures a screenshot of the assistant screen', async () => {
        await keptPage.captureConversation('readonly-assistant-screen');
        expect(true).toBe(true);
    });
});
