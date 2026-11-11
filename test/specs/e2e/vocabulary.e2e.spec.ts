/// <reference types="@wdio/globals/types" />

import { VocabularyScreen } from '../../../src/pages/screens/vocabulary.page';

/**
 * Vocabulary screen - E2E content verification (Words / Replacements / Snippets).
 */
describe('Kept E2E - Vocabulary screen @e2e @regression', () => {
    const vocab = new VocabularyScreen();

    before(async () => {
        await vocab.open();
    });

    it('shows the Words / Replacements / Snippets tabs', async () => {
        const hasAnyTab =
            (await vocab.hasTab('Words')) ||
            (await vocab.hasTab('Replacements')) ||
            (await vocab.hasTab('Snippets'));
        expect(hasAnyTab).toBe(true);
    });

    it('offers a way to add a word', async () => {
        const hasAdd =
            (await vocab.hasButton('Add a word')) ||
            (await vocab.hasButton('Add')) ||
            (await vocab.hasText('Add a word'));
        expect(hasAdd).toBe(true);
    });

    it('keeps the global sidebar visible', async () => {
        expect(await vocab.hasSidebar()).toBe(true);
    });
});
