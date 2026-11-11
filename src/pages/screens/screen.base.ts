/// <reference types="@wdio/globals/types" />

import { BasePage } from '../base.page';
import { navigateTo, getSidebarHelpLabels, Screen, ScreenName } from '../../utils/native-nav';

/**
 * Shared base for Kept screen page objects.
 *
 * Interaction (navigation) goes through the native-nav osascript layer; reads
 * and assertions go through Appium's accessibility tree (read-only, crash-safe).
 */
export abstract class ScreenPage extends BasePage {
    /** The sidebar destination this page represents. */
    protected abstract readonly screen: ScreenName;

    /** Navigate to this screen and wait for it to settle. */
    async open(): Promise<void> {
        navigateTo(this.screen);
        await browser.pause(1800);
    }

    async waitForPageLoad(): Promise<void> {
        await browser.pause(500);
    }

    /**
     * Extract de-duplicated attribute values for a given element type from a
     * single page-source snapshot. One round-trip instead of one per element —
     * reading elements individually is ~1s each and times the suite out.
     */
    private static extractAttr(xml: string, type: string, attr: string): string[] {
        const out: string[] = [];
        const re = new RegExp(`<XCUIElementType${type}\\b[^>]*\\s${attr}="([^"]*)"`, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(xml)) !== null) {
            const value = match[1].trim();
            if (value && !out.includes(value)) out.push(value);
        }
        return out;
    }

    /**
     * Snapshot the page source, tolerating a slow/failed read. The AX tree can
     * grow large during a long conversation and a single getPageSource may time
     * out — returning '' lets callers keep polling instead of failing the test.
     */
    private static async safePageSource(): Promise<string> {
        try {
            return await browser.getPageSource();
        } catch {
            return '';
        }
    }

    /** All visible static-text strings on the current screen (trimmed, non-empty). */
    protected async staticTexts(): Promise<string[]> {
        const xml = await ScreenPage.safePageSource();
        // SwiftUI surfaces some text in `value` and some in `label` (e.g. the
        // Tasks Kanban column headers are label-only) — merge both.
        const values = ScreenPage.extractAttr(xml, 'StaticText', 'value');
        const labels = ScreenPage.extractAttr(xml, 'StaticText', 'label');
        return Array.from(new Set([...values, ...labels]));
    }

    /** All visible button labels on the current screen. */
    protected async buttonLabels(): Promise<string[]> {
        const xml = await ScreenPage.safePageSource();
        return ScreenPage.extractAttr(xml, 'Button', 'label');
    }

    /** True when any static text contains `needle` (case-insensitive). */
    async hasText(needle: string): Promise<boolean> {
        const haystack = (await this.staticTexts()).join('\n').toLowerCase();
        return haystack.includes(needle.toLowerCase());
    }

    /** True when any button label contains `needle` (case-insensitive). */
    async hasButton(needle: string): Promise<boolean> {
        const labels = (await this.buttonLabels()).map(l => l.toLowerCase());
        return labels.some(l => l.includes(needle.toLowerCase()));
    }

    /** Count of a given XCUIElementType on the current screen. */
    protected async count(type: string): Promise<number> {
        return (await $$(`//XCUIElementType${type}`).length) as number;
    }

    /** True when the Kept sidebar is present (navigation chrome intact). */
    async hasSidebar(): Promise<boolean> {
        const labels = getSidebarHelpLabels();
        return [Screen.Assistant, Screen.Meetings, Screen.Tasks].every(s => labels.includes(s));
    }

    /** Best-effort screenshot of the current screen (never throws). */
    async captureScreenshot(filename?: string): Promise<void> {
        await this.takeScreenshot(filename);
    }
}
