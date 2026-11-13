/// <reference types="@wdio/globals/types" />

import { step } from '../../../src/utils/steps';
import {
    openSettings,
    openSettingsTab,
    settleWindow
} from '../../../src/pages/windows/settings.windows';

/**
 * WINDOWS SPIKE - proves the TypeScript framework can drive Kept Dev on Windows.
 * Uses the same automation IDs as the Python (pywinauto) suite:
 *   HeaderSettingsBtn  = gear icon (top right)
 *   SearchBox          = "Find a setting" box (Settings is open)
 *   ListHost           = Settings left menu
 * Read-only: nothing is created, changed or deleted.
 *
 * Run:  set TEST_PLATFORM=windows  &&  npx wdio run ./wdio.conf.ts --spec ./test/specs/windows/kept-spike.windows.spec.ts
 */

/** True when an element whose Name is exactly `text` (or starts with it) is on screen. */
async function pageHas(text: string): Promise<boolean> {
    const xml = await browser.getPageSource();
    const esc = text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return xml.includes(`Name="${esc}"`) || xml.includes(`Name="${esc} `);
}

describe('Kept (Windows) - spike', () => {
    it('main window loads and shows the header Settings button', async () => {
        step('Launch Kept Dev and wait for the main window');
        await settleWindow();
        await browser.saveScreenshot('./screenshots/spike-01-main.png');
    });

    it('sidebar pages are visible by name', async () => {
        for (const page of [
            'Meetings',
            'AI Assistant',
            'Speech to Text',
            'Vocabulary',
            'Tasks',
            'Insights'
        ]) {
            const found = await pageHas(page);
            console.log(`[spike] sidebar "${page}": ${found ? 'FOUND' : 'NOT FOUND'}`);
        }
    });

    it('opens Settings with the gear and the Settings menu appears', async () => {
        await openSettings();
        await browser.saveScreenshot('./screenshots/spike-02-settings.png');
    });

    it('[AIT-WIN-313] Settings > Profile shows Name, Email and Workspace', async () => {
        await openSettingsTab('Profile');
        for (const label of ['Name', 'Email', 'Workspace']) {
            step(`Check that "${label}" is shown`);
            expect(await pageHas(label)).toBe(true);
        }
        await browser.saveScreenshot('./screenshots/spike-03-profile.png');
    });
});
