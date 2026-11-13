/// <reference types="@wdio/globals/types" />

import { step } from '../../utils/steps';

/**
 * Windows Settings helpers - same approach as the Python suite (pages/settings_page.py):
 * let the window settle, click the gear, wait for the "Find a setting" box,
 * and retry once if Settings did not open (tooltips / focus can swallow the first click).
 */
let appLoaded = false;

/**
 * Wait until Kept's window content is really loaded. Like app_launcher.py: after the
 * window appears, the web content inside needs a few seconds; we also wait until the
 * sidebar ("Meetings") is readable before the first click.
 */
export async function settleWindow(): Promise<void> {
    const gear = await $('~HeaderSettingsBtn');
    await gear.waitForExist({ timeout: 60000 });
    if (!appLoaded) {
        await browser.pause(5000);
        await browser.waitUntil(async () => (await browser.getPageSource()).includes('Meetings'), {
            timeout: 30000,
            interval: 1500,
            timeoutMsg: 'Kept sidebar did not load within 30s'
        });
        appLoaded = true;
    }
    await browser.pause(1500);
}

export async function openSettings(): Promise<void> {
    step('Click the Settings (gear) icon at the top right');
    if (await (await $('~SearchBox')).isExisting()) return; // already open
    for (let attempt = 1; attempt <= 2; attempt++) {
        await settleWindow();
        await (await $('~HeaderSettingsBtn')).click();
        try {
            await (await $('~SearchBox')).waitForExist({ timeout: 15000 });
            await (await $('~ListHost')).waitForExist({ timeout: 15000 });
            await browser.pause(1000);
            return;
        } catch {
            await browser.keys('Escape'); // close any tooltip/menu, then retry
            await browser.pause(1500);
        }
    }
    throw new Error('Settings did not open after clicking the gear icon twice');
}

export async function openSettingsTab(tab: string): Promise<void> {
    await openSettings();
    step(`Click "${tab}" in the Settings left menu`);
    await (await $(`//Button[@Name="${tab}"]`)).click();
    await browser.pause(2000);
}
