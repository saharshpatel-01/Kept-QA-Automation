/// <reference types="@wdio/globals/types" />

import { FeedbackScreen } from '../../../src/pages/screens/feedback.page';
import { logger } from '../../../src/utils/logger';

/**
 * Feedback screen - E2E content verification.
 */
describe('Kept E2E - Feedback screen @e2e @regression', () => {
    const feedback = new FeedbackScreen();

    before(async () => {
        await feedback.open();
    });

    it('offers bug-report / feedback entry points', async () => {
        const hasForms =
            (await feedback.hasText('bug')) ||
            (await feedback.hasText('feedback')) ||
            (await feedback.hasButton('Report')) ||
            (await feedback.hasButton('Share'));
        expect(hasForms).toBe(true);
    });

    it('displays the app version string', async () => {
        const version = await feedback.getVersionString();
        logger.info(`Version string: "${version}"`);
        expect(version).toMatch(/^Kept\s+\d+\.\d+\.\d+/);
    });

    it('keeps the global sidebar visible', async () => {
        expect(await feedback.hasSidebar()).toBe(true);
    });
});
