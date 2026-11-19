/// <reference types="@wdio/globals/types" />

import { step } from './steps';
import { openSettingsTab } from '../pages/windows/settings.windows';

/**
 * Shared "open a Settings tab and check texts" helpers for the Windows suite.
 * Same logic and judging as the Python suite (tests/test_ui_screens.py):
 * exact name (6 s), else escaped-text regex search, case-insensitive (3 s);
 * if something is missing: scroll down, then reopen the tab once.
 * Read-only: nothing is created, changed or deleted.
 */
export interface Check {
    id: string;
    title: string; // Sheet2 "Name" of the case
    tab: string;
    must: string[];
    /** Texts that must NOT be on the screen. */
    mustNot?: string[];
}

export function norm(t: string): string {
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

async function allNames(): Promise<string[]> {
    const xml = await browser.getPageSource();
    const names: string[] = [];
    const rx = /\sName="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(xml)) !== null) names.push(norm(unXml(m[1])));
    return names;
}

async function exists(match: (name: string) => boolean, timeoutSec: number): Promise<boolean> {
    const end = Date.now() + timeoutSec * 1000;
    for (;;) {
        if ((await allNames()).some(match)) return true;
        if (Date.now() > end) return false;
        await browser.pause(700);
    }
}

function escapeRx(t: string): RegExp {
    return new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

export async function shown(text: string): Promise<boolean> {
    const t = norm(text);
    if (await exists(n => n === t, 6)) return true;
    const rx = escapeRx(t);
    return exists(n => rx.test(n), 3);
}

async function scrollDown(): Promise<void> {
    try {
        const r = await browser.getWindowRect();
        const x = Math.round(r.x + r.width * 0.65);
        const y = Math.round(r.y + r.height * 0.6);
        for (let i = 0; i < 6; i++) {
            await browser.execute('windows: scroll', { x, y, deltaY: 500 });
            await browser.pause(400);
        }
    } catch (e) {
        console.log(`[scroll] scroll failed, continuing: ${(e as Error).message.split('\n')[0]}`);
    }
}

/** Run one Settings check. Throws (via expect) when texts are missing or unexpected texts show. */
export async function runSettingsCheck(c: Check): Promise<void> {
    await openSettingsTab(c.tab);
    let missing: string[] = [];
    for (const t of c.must) {
        step(`Check that "${t}" is shown`);
        if (!(await shown(t))) missing.push(t);
    }
    if (missing.length) {
        step('Scroll down in case the content is below the fold');
        await scrollDown();
        const still: string[] = [];
        for (const t of missing) if (!(await shown(t))) still.push(t);
        missing = still;
    }
    if (missing.length) {
        step(`Open the "${c.tab}" tab again - the page may not have finished loading`);
        await openSettingsTab(c.tab);
        const still: string[] = [];
        for (const t of missing) if (!(await shown(t))) still.push(t);
        missing = still;
    }
    const unexpected: string[] = [];
    for (const t of c.mustNot ?? []) {
        step(`Check that "${t}" is NOT shown`);
        const rx = escapeRx(norm(t));
        if (await exists(n => rx.test(n), 2)) unexpected.push(t);
    }
    await browser.saveScreenshot(`./screenshots/checks-${c.id}.png`);
    console.log(
        `[check] ${c.id} Settings > ${c.tab}: missing=${JSON.stringify(missing)} unexpected=${JSON.stringify(unexpected)}`
    );
    expect({ missing, unexpected }).toEqual({ missing: [], unexpected: [] });
}
