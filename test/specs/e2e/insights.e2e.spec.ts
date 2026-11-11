/// <reference types="@wdio/globals/types" />

import { InsightsScreen } from '../../../src/pages/screens/insights.page';

/**
 * Insights screen - E2E content verification.
 */
describe('Kept E2E - Insights screen @e2e @regression', () => {
    const insights = new InsightsScreen();

    before(async () => {
        await insights.open();
    });

    it('renders insight / recap content', async () => {
        const hasInsightContent =
            (await insights.hasText('recap')) ||
            (await insights.hasText('Insight')) ||
            (await insights.hasText('Time range')) ||
            (await insights.hasText('week'));
        expect(hasInsightContent).toBe(true);
    });

    it('offers refresh / export controls', async () => {
        const hasControls =
            (await insights.hasButton('Refresh')) ||
            (await insights.hasButton('Export')) ||
            (await insights.hasText('Export CSV'));
        expect(hasControls).toBe(true);
    });

    it('keeps the global sidebar visible', async () => {
        expect(await insights.hasSidebar()).toBe(true);
    });
});
