/// <reference types="@wdio/globals/types" />

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Base Page Object - Parent class for all page objects
 * Provides common functionality for element interaction and waiting
 */
export abstract class BasePage {
    /**
     * Wait for an element to be displayed
     */
    protected async waitForElement(element: any, timeout: number = 10000): Promise<void> {
        const el = await Promise.resolve(element);
        await el.waitForDisplayed({ timeout });
    }

    /**
     * Wait for an element to be clickable
     */
    protected async waitForClickable(element: any, timeout: number = 10000): Promise<void> {
        const el = await Promise.resolve(element);
        await el.waitForClickable({ timeout });
    }

    /**
     * Click with retry mechanism
     */
    protected async clickElement(element: any, retries: number = 3): Promise<void> {
        const el = await Promise.resolve(element);
        for (let i = 0; i < retries; i++) {
            try {
                await el.waitForClickable({ timeout: 10000 });
                await el.click();
                return;
            } catch (error) {
                if (i === retries - 1) throw error;
                await browser.pause(1000);
            }
        }
    }

    /**
     * Type text with clear first
     */
    protected async typeText(element: any, text: string): Promise<void> {
        const el = await Promise.resolve(element);
        await el.waitForDisplayed({ timeout: 10000 });
        await el.clearValue();
        await el.setValue(text);
    }

    /**
     * Get element text
     */
    protected async getText(element: any): Promise<string> {
        const el = await Promise.resolve(element);
        await el.waitForDisplayed({ timeout: 10000 });
        return await el.getText();
    }

    /**
     * Check if element is displayed
     */
    protected async isDisplayed(element: any): Promise<boolean> {
        try {
            const el = await Promise.resolve(element);
            return await el.isDisplayed();
        } catch {
            return false;
        }
    }

    /**
     * Take screenshot. Always attempted for the Allure report; also saved to
     * ./screenshots/<filename>.png when a filename is provided. Never throws —
     * a transient WebDriverAgent blip must not fail a test or hook.
     */
    protected async takeScreenshot(filename?: string): Promise<void> {
        try {
            await browser.takeScreenshot();
            if (filename) {
                const safe = filename.replace(/[^a-z0-9-_]/gi, '-');
                await browser.saveScreenshot(`./screenshots/${safe}.png`);
            }
        } catch {
            // Screenshot capture is best-effort; ignore failures.
        }
    }

    /**
     * Wait for page to load (implement in child classes)
     */
    abstract waitForPageLoad(): Promise<void>;
}
