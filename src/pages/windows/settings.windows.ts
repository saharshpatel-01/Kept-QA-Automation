/// <reference types="@wdio/globals/types" />

import { step } from '../../utils/steps';

/**
 * Windows Settings helpers - same approach as the Python suite (pages/settings_page.py):
 * let the window settle, click the gear, wait for the "Find a setting" box,
 * and retry once if Settings did not open (tooltips / focus can swallow the first click).
 */
let appLoaded = false;

/**
 * Bring Kept to the front and maximise it (like ui.front() + app_launcher.py), so no other
 * window (e.g. the agent's terminal) sits over the gear when a real mouse click is sent.
 */
export async function bringToFront(): Promise<void> {
    try {
        await browser.maximizeWindow();
    } catch (e) {
        console.log(`[window] maximise not supported: ${(e as Error).message.split('\n')[0]}`);
    }
    await browser.pause(800);
}

/**
 * Kept has several top-level windows: the main window, a small floating bubble (~199x34)
 * and hidden helper windows that report an invalid size (e.g. -2147483647). The driver may
 * attach to any of them, so - like app_launcher.py - pick the BIGGEST VISIBLE window whose
 * title contains "Kept" (MAIN_WINDOW_HINT). Invalid, off-screen or tiny windows are skipped.
 */
export async function focusMainWindow(): Promise<void> {
    const hint = (process.env.MAIN_WINDOW_HINT || 'Kept').toLowerCase();
    const handles = await browser.getWindowHandles();
    const start = handles.length ? await browser.getWindowHandle().catch(() => handles[0]) : '';
    let best: string | undefined;
    let bestArea = 0;
    for (const h of handles) {
        try {
            await browser.switchToWindow(h);
            const r = await browser.getWindowRect();
            const title = (await browser.getTitle().catch(() => '')) || '';
            const valid =
                r.width >= 400 && r.height >= 300 && r.width <= 20000 && r.height <= 20000;
            const titleOk = !hint || title.toLowerCase().includes(hint);
            console.log(
                `[window] ${h}: ${r.width}x${r.height} "${title}"${valid && titleOk ? '' : ' (skipped)'}`
            );
            if (valid && titleOk && r.width * r.height > bestArea) {
                bestArea = r.width * r.height;
                best = h;
            }
        } catch (e) {
            console.log(`[window] ${h}: skipped (${(e as Error).message.split('\n')[0]})`);
        }
    }
    const target = best ?? start;
    if (target) await browser.switchToWindow(target);
    await bringToFront();
    console.log(
        best
            ? `[window] using main window ${best} (${handles.length} window(s) found)`
            : `[window] no valid Kept window found - staying on ${start}`
    );
}

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
        await focusMainWindow();
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
        await bringToFront();
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
