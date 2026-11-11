/// <reference types="@wdio/globals/types" />

/* eslint-disable @typescript-eslint/no-explicit-any */

import { AIAnalyzer } from '../ai/analyzer';
import { logger } from './logger';

export interface LocatorStrategy {
    description: string;
    selector: string;
}

export interface HealOptions {
    elementName: string;
    timeout?: number;
}

async function existsWithin(selector: string, timeout: number): Promise<any | null> {
    try {
        const el = await $(selector);
        await el.waitForExist({ timeout });
        return el;
    } catch {
        return null;
    }
}

/**
 * Locate an element using an ordered list of selector strategies, falling back
 * to an AI-suggested selector derived from the live accessibility tree.
 *
 * - Tries each strategy in order; the first strategy gets the full timeout,
 *   fallbacks get a shorter slice so a run doesn't stall on every lookup.
 * - When a non-primary strategy succeeds, the heal is logged so the brittle
 *   primary selector can be updated.
 * - AI fallback runs only when SELF_HEAL != 'false' and OPENAI_API_KEY is set.
 */
export async function healLocate(
    strategies: LocatorStrategy[],
    options: HealOptions
): Promise<any> {
    const timeout = options.timeout ?? 8000;
    const tried: string[] = [];

    for (let i = 0; i < strategies.length; i++) {
        const { description, selector } = strategies[i];
        tried.push(selector);
        const perTry = i === 0 ? timeout : Math.min(timeout, 3000);
        const el = await existsWithin(selector, perTry);
        if (el) {
            if (i > 0) {
                logger.warn(
                    `[self-heal] "${options.elementName}": primary selector failed; ` +
                        `healed via fallback "${description}" (${selector}).`
                );
            }
            return el;
        }
    }

    if (process.env.SELF_HEAL !== 'false' && process.env.OPENAI_API_KEY) {
        try {
            const pageSource = await browser.getPageSource();
            const suggestion = await new AIAnalyzer().suggestLocator({
                elementName: options.elementName,
                triedSelectors: tried,
                pageSource
            });
            if (suggestion) {
                const el = await existsWithin(suggestion, 3000);
                if (el) {
                    logger.warn(
                        `[self-heal] "${options.elementName}": healed via AI-suggested selector ` +
                            `"${suggestion}". Consider adding it to the page object.`
                    );
                    return el;
                }
            }
        } catch (e) {
            logger.error(`[self-heal] AI fallback failed for "${options.elementName}":`, e);
        }
    }

    throw new Error(
        `[self-heal] Could not locate "${options.elementName}". Tried: ${tried.join(', ')}`
    );
}

/**
 * True when an error is a WebDriverAgentMac proxy/crash error (port 10100).
 */
export function isWdaProxyError(e: unknown): boolean {
    const m = e instanceof Error ? e.message : String(e);
    return /ECONNREFUSED 127\.0\.0\.1:10100|Could not proxy command|probably crashed/i.test(m);
}

/**
 * Run an action, retrying when WebDriverAgentMac crashes (it auto-restarts).
 * Non-WDA errors propagate immediately.
 */
export async function withWdaRetry<T>(
    action: () => Promise<T>,
    options: { label: string; retries?: number; backoffMs?: number }
): Promise<T> {
    const retries = options.retries ?? 3;
    const backoff = options.backoffMs ?? 5000;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await action();
        } catch (e) {
            lastErr = e;
            if (!isWdaProxyError(e) || attempt === retries) throw e;
            logger.warn(
                `[wda-retry] "${options.label}" hit a WebDriverAgent crash ` +
                    `(attempt ${attempt + 1}/${retries}); waiting ${backoff}ms for WDA to restart...`
            );
            await browser.pause(backoff);
        }
    }
    throw lastErr;
}
