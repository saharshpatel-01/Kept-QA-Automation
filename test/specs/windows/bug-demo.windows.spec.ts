/// <reference types="@wdio/globals/types" />

/**
 * DEMO ONLY - fails on purpose to show the automatic Jira bug.
 * DELETE this file after the demo.
 */
import { step } from '../../../src/utils/steps';

describe('Kept (Windows) - auto-bug demo', () => {
    it('[AIT-WIN-313] AUTOMATION DEMO please ignore - Profile shows Workspace123', async () => {
        step('Launch Kept Dev and wait for the main window');
        await (await $('~HeaderSettingsBtn')).waitForExist({ timeout: 60000 });
        step('Click the Settings (gear) icon at the top right');
        await (await $('~HeaderSettingsBtn')).click();
        await (await $('~SearchBox')).waitForExist({ timeout: 25000 });
        step('Click "Profile" in the Settings left menu');
        await (await $('//Button[@Name="Profile"]')).click();
        await browser.pause(2000);
        step('Check that "Workspace123" is shown');
        const xml = await browser.getPageSource();
        expect(xml.includes('Workspace123')).toBe(true); // fails on purpose
    });
});
