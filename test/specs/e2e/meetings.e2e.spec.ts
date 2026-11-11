/// <reference types="@wdio/globals/types" />

import { MeetingsScreen } from '../../../src/pages/screens/meetings.page';

/**
 * Meetings screen - E2E content verification.
 */
describe('Kept E2E - Meetings screen @e2e @regression', () => {
    const meetings = new MeetingsScreen();

    before(async () => {
        await meetings.open();
    });

    it('renders meeting-related content', async () => {
        const hasMeetingContent =
            (await meetings.hasText('meeting')) ||
            (await meetings.hasText('Nothing booked')) ||
            (await meetings.hasText('folder'));
        expect(hasMeetingContent).toBe(true);
    });

    it('offers a calendar connection entry point', async () => {
        const hasConnect =
            (await meetings.hasText('Connect')) ||
            (await meetings.hasButton('Connect')) ||
            (await meetings.hasText('Calendar'));
        expect(hasConnect).toBe(true);
    });

    it('keeps the global sidebar visible', async () => {
        expect(await meetings.hasSidebar()).toBe(true);
    });
});
