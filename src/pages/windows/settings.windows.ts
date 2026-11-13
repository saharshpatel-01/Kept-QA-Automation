/// <reference types="@wdio/globals/types" />

import { step } from '../../utils/steps';

/**
 * Windows Settings helpers - same approach as the Python suite (pages/settings_page.py):
 * let the window settle, click the gear, wait for the "Find a setting" box,
 * and retry once if Settings did not open (tooltips / focus can swallow the first click).
 */
let appLoaded = false;

/**
 * Press a control the way pywinauto's el.invoke() does: UI Automation Invoke pattern
 * ("windows: invoke"), which needs no mouse coordinates. Falls back to a normal click.
 * (The driver's mouse click ignores Windows display scaling, so it can miss the target.)
 */
export async function invokeClick(selector: string): Promise<void> {
    const el = await $(selector);
    await el.waitForExist({ timeout: 15000 });
    try {
        await browser.execute('windows: invoke', el);
    } catch (e) {
        console.log(
            `[click] invoke failed, using mouse click: ${(e as Error).message.split('\n')[0]}`
        );
        await el.click();
    }
}

/** Click a page in Kept's left sidebar (Meetings, AI Assistant, Tasks, ...) - like nav.go_page(). */
export async function goPage(name: string): Promise<void> {
    step(`Click "${name}" in the left sidebar`);
    await settleWindow();
    await invokeClick(`//Button[@Name="${name}"]`);
    await browser.pause(2000);
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
        // The 07:07 run passed WITHOUT switching windows; switching broke the gear click.
        // So only switch when the driver is attached to a tiny/invalid window (the bubble).
        const r = await browser.getWindowRect().catch(() => ({ width: 0, height: 0 }));
        console.log(`[window] attached window is ${r.width}x${r.height}`);
        if (r.width < 400 || r.height < 300 || r.width > 20000 || r.height > 20000) {
            await focusMainWindow();
        }
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
        await invokeClick('~HeaderSettingsBtn');
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

/** Python ui.norm(): curly quotes -> straight quotes, trim. */
function norm(t: string): string {
    return (t || '').replace(/’/g, "'").replace(/‘/g, "'").trim();
}

function unXml(s: string): string {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
        .replace(/&amp;/g, '&');
}

let tabCheckLogged = false;

/**
 * Heading of the Settings page that is shown - like SettingsPage.current_tab() in Python:
 * the first Text with a Name after the left menu's ScrollBar (which follows "Settings sections").
 * Fallback (only if "Settings sections" is not in the tree): the first Text with a Name
 * after the end of the ListHost element. The method used is logged once.
 */
export async function currentSettingsTab(): Promise<string> {
    const xml = await browser.getPageSource();
    const els: { type: string; name: string }[] = [];
    const rx = /<(\w+)\b([^>]*)>/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(xml)) !== null) {
        const nm = /\sName="([^"]*)"/.exec(m[2]);
        els.push({ type: m[1], name: nm ? norm(unXml(nm[1])) : '' });
    }
    const start = els.findIndex(e => e.name === 'Settings sections');
    if (start >= 0) {
        let pastMenu = false;
        for (const e of els.slice(start + 1)) {
            if (!pastMenu) {
                if (e.type === 'ScrollBar') pastMenu = true;
                continue;
            }
            if (e.type === 'Text' && e.name) {
                if (!tabCheckLogged) console.log('[tab] heading read like Python current_tab()');
                tabCheckLogged = true;
                return e.name;
            }
        }
        return '';
    }
    // Fallback: the first Text with a Name AFTER the end of the ListHost element.
    // Walk the tags and count nesting depth to find where ListHost closes.
    const tag = /<(\/?)(\w+)\b([^>]*?)(\/?)>/g;
    let depth = 0;
    let inList = false;
    let listEnded = false;
    while ((m = tag.exec(xml)) !== null) {
        const closing = m[1] === '/';
        const selfClosing = m[4] === '/';
        if (!inList && !listEnded) {
            if (!closing && m[3].includes('AutomationId="ListHost"')) {
                if (selfClosing) listEnded = true;
                else {
                    inList = true;
                    depth = 1;
                }
            }
            continue;
        }
        if (inList) {
            if (closing) depth--;
            else if (!selfClosing) depth++;
            if (depth === 0) {
                inList = false;
                listEnded = true;
            }
            continue;
        }
        if (!closing && m[2] === 'Text') {
            const nm = /\sName="([^"]*)"/.exec(m[3]);
            const name = nm ? norm(unXml(nm[1])) : '';
            if (name) {
                if (!tabCheckLogged)
                    console.log('[tab] heading read with FALLBACK (Text after ListHost)');
                tabCheckLogged = true;
                return name;
            }
        }
    }
    return '';
}

async function scrollMenu(down: boolean): Promise<void> {
    try {
        const list = await $('~ListHost');
        await browser.execute('windows: scroll', {
            elementId: await list.elementId,
            deltaY: down ? 600 : -600
        });
        await browser.pause(600);
    } catch (e) {
        console.log(`[tab] menu scroll failed, continuing: ${(e as Error).message.split('\n')[0]}`);
    }
}

/**
 * Open a Settings tab like SettingsPage.open_tab() in Python: find the Button inside the
 * ListHost menu, scroll it into view, click it, and verify (up to 8 s) that the page heading
 * equals the tab name. Up to 4 attempts.
 */
export async function openSettingsTab(tab: string): Promise<void> {
    await openSettings();
    const want = norm(tab);
    if ((await currentSettingsTab()) === want) return;
    step(`Click "${tab}" in the Settings left menu`);
    const selector = `//*[@AutomationId="ListHost"]//Button[@Name="${tab}"]`;
    for (let attempt = 0; attempt < 4; attempt++) {
        const btn = await $(selector);
        await btn.waitForExist({ timeout: 12000 });
        try {
            await browser.execute('windows: scrollIntoView', btn);
        } catch (e) {
            console.log(`[tab] scrollIntoView failed: ${(e as Error).message.split('\n')[0]}`);
        }
        if (attempt >= 1) await scrollMenu(attempt % 2 === 1);
        await invokeClick(selector);
        const end = Date.now() + 8000;
        while (Date.now() < end) {
            if ((await currentSettingsTab()) === want) {
                await browser.pause(500);
                return;
            }
            await browser.pause(600);
        }
        console.log(`[tab] attempt ${attempt + 1}: "${tab}" not open yet`);
    }
    throw new Error(
        `Settings tab ${tab} did not open (page shows ${(await currentSettingsTab()) || 'nothing'})`
    );
}
