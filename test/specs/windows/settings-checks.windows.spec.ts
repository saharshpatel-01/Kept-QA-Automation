/// <reference types="@wdio/globals/types" />

import { step } from '../../../src/utils/steps';
import { openSettingsTab } from '../../../src/pages/windows/settings.windows';

/**
 * Settings screen checks - converted from the CHECKS table in the Python suite
 * (projects/aitscribe/automation/tests/test_ui_screens.py). Same data, same judging:
 * each row = open a Settings tab, then every text in `must` has to be shown.
 * Read-only: nothing is created, changed or deleted.
 *
 * Only cases that are in Sheet2 with Execution Type "Automated" (Hardeep, first batch).
 * Row order: case ID, Settings tab, texts that must show (exactly as in the Python table).
 *
 * NOTE AIT-WIN-014: the Sheet2 name says "name, email and sign-in method", but the Python
 * check (copied here as-is) looks for Name, Email, Workspace and the account name. The
 * sign-in check lives in AIT-WIN-313 (OBS-30). Hardeep decides separately.
 */
interface Check {
    id: string;
    title: string; // Sheet2 "Name" of the case
    tab: string;
    must: string[];
    /** Extra text read from KEPT_ACCOUNT_NAME in .env (the signed-in user's name). */
    accountName?: boolean;
}

const CHECKS: Check[] = [
    {
        id: 'AIT-WIN-014',
        title: 'Profile section shows name, email and sign-in method',
        tab: 'Profile',
        must: ['Name', 'Email', 'Workspace'],
        accountName: true
    },
    {
        id: 'AIT-WIN-018',
        title: 'Email me master switch controls sub-options',
        tab: 'Notifications',
        must: ['Email me', 'Tasks assigned to me', 'Meeting debriefs', 'Pre-meeting briefs']
    },
    {
        id: 'AIT-WIN-107',
        title: 'Local processing only disables cloud engines',
        tab: 'Privacy & data',
        must: ['Local processing only', 'Never send dictation audio to a cloud service']
    },
    {
        id: 'AIT-WIN-392',
        title: 'Appearance System / Light / Dark and accent colour',
        tab: 'General',
        must: ['Appearance', 'System', 'Light', 'Dark', 'Accent colour']
    },
    {
        id: 'AIT-WIN-294',
        title: "About version, What's new, links",
        tab: 'Help & about',
        must: ['Version', "What's new", 'Licences']
    }
];

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

/** Python ui.all_elements(): the (normalised) Name of every element on screen. */
async function allNames(): Promise<string[]> {
    const xml = await browser.getPageSource();
    const names: string[] = [];
    const rx = /\sName="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(xml)) !== null) names.push(norm(unXml(m[1])));
    return names;
}

/** Python ui.exists(): poll until `match` finds a name, or the timeout (seconds) runs out. */
async function exists(match: (name: string) => boolean, timeoutSec: number): Promise<boolean> {
    const end = Date.now() + timeoutSec * 1000;
    for (;;) {
        if ((await allNames()).some(match)) return true;
        if (Date.now() > end) return false;
        await browser.pause(700);
    }
}

/** Python _shown(): exact name (6 s), else escaped-text regex search, case-insensitive (3 s). */
async function shown(text: string): Promise<boolean> {
    const t = norm(text);
    if (await exists(n => n === t, 6)) return true;
    const rx = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return exists(n => rx.test(n), 3);
}

/** Python nav.scroll_down(): mouse wheel on the content area (errors are swallowed there too). */
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

describe('Kept (Windows) - Settings checks', () => {
    for (const c of CHECKS) {
        it(`[${c.id}] ${c.title}`, async () => {
            await openSettingsTab(c.tab);
            let missing: string[] = [];
            const texts = [...c.must];
            if (c.accountName) {
                const account = (process.env.KEPT_ACCOUNT_NAME || '').trim();
                if (account) texts.push(account);
                else
                    console.log(
                        `[warning] ${c.id}: KEPT_ACCOUNT_NAME is not set in .env - skipping the account-name text`
                    );
            }
            for (const t of texts) {
                // The account name itself is not written into the step text (public repo / bug drafts).
                step(
                    `Check that ${t === process.env.KEPT_ACCOUNT_NAME?.trim() && c.accountName ? 'the account name' : `"${t}"`} is shown`
                );
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
            await browser.saveScreenshot(`./screenshots/checks-${c.id}.png`);
            console.log(`[check] ${c.id} Settings > ${c.tab}: missing=${JSON.stringify(missing)}`);
            expect(missing).toEqual([]);
        });
    }
});
