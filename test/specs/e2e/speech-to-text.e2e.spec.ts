/// <reference types="@wdio/globals/types" />

import { SpeechToTextScreen } from '../../../src/pages/screens/speech-to-text.page';

/**
 * Speech to Text screen - E2E content verification.
 */
describe('Kept E2E - Speech to Text screen @e2e @regression', () => {
    const speech = new SpeechToTextScreen();

    before(async () => {
        await speech.open();
    });

    it('explains the push-to-talk hotkey', async () => {
        const hasHotkey =
            (await speech.hasText('Hold')) ||
            (await speech.hasText('Shift')) ||
            (await speech.hasText('key'));
        expect(hasHotkey).toBe(true);
    });

    it('offers a place to try dictation', async () => {
        const hasTryArea =
            (await speech.hasButton('Try it here')) ||
            (await speech.hasButton('Model')) ||
            (await speech.hasButton('Change the key')) ||
            (await speech.hasText('dictated'));
        expect(hasTryArea).toBe(true);
    });

    it('keeps the global sidebar visible', async () => {
        expect(await speech.hasSidebar()).toBe(true);
    });
});
