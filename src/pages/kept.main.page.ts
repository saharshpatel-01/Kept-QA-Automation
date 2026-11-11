/// <reference types="@wdio/globals/types" />

import { BasePage } from './base.page';
import { healLocate, withWdaRetry, LocatorStrategy } from '../utils/self-healing';

/**
 * Page Object for Kept main window (macOS)
 *
 * Kept is a native SwiftUI macOS app automated via Appium Mac2 (XCUIElementType
 * tree). Key UI elements on the AI Assistant screen:
 * - Chat input:  XCUIElementTypeTextView (the only TextView; the lone TextField
 *                is the sidebar "Search conversations" box, NOT the chat input)
 * - Send button: XCUIElementTypeButton, identifier "arrow.up", label "Send"
 * - Messages:    XCUIElementTypeStaticText elements
 */
export class KeptMainPage extends BasePage {
    /**
     * Ordered selector strategies for the chat input. The self-healing layer
     * tries these in order, then an AI-suggested selector if all fail.
     */
    private readonly inputStrategies: LocatorStrategy[] = [
        { description: 'chat text view', selector: '//XCUIElementTypeTextView' },
        {
            description: 'text view inside scroll view',
            selector: '//XCUIElementTypeScrollView//XCUIElementTypeTextView'
        }
    ];

    /**
     * Ordered selector strategies for the Send button.
     */
    private readonly sendStrategies: LocatorStrategy[] = [
        { description: 'send button by identifier', selector: '~arrow.up' },
        { description: 'send button by label', selector: '//XCUIElementTypeButton[@label="Send"]' }
    ];

    /**
     * Resolve the chat input with self-healing fallbacks.
     */
    private async resolveInput() {
        return healLocate(this.inputStrategies, {
            elementName: 'chat input field',
            timeout: 15000
        });
    }

    /**
     * Resolve the Send button with self-healing fallbacks.
     */
    private async resolveSend() {
        return healLocate(this.sendStrategies, { elementName: 'send button', timeout: 5000 });
    }

    /**
     * Get all static text elements (messages in conversation)
     */
    private get staticTexts() {
        return $$('//XCUIElementTypeStaticText');
    }

    /**
     * Wait for the main page (assistant screen) to load
     * Verified by presence of the chat input field
     */
    async waitForPageLoad(): Promise<void> {
        await this.resolveInput();
    }

    /**
     * Check if Kept is on the assistant chat screen, verified by the presence
     * of the chat input text view.
     */
    async isOnAssistantScreen(): Promise<boolean> {
        try {
            const textViews = await $$('//XCUIElementTypeTextView');
            return (await textViews.length) >= 1;
        } catch {
            return false;
        }
    }

    /**
     * Ensure we're on the assistant screen before sending
     */
    async ensureAssistantScreen(): Promise<void> {
        const isReady = await this.isOnAssistantScreen();
        if (!isReady) {
            throw new Error('Kept is not on the assistant chat screen');
        }
    }

    /**
     * Send a message to the AI assistant
     */
    async sendMessage(message: string, submit: boolean = true): Promise<void> {
        await this.ensureAssistantScreen();

        await withWdaRetry(
            async () => {
                const input = await this.resolveInput();
                await input.click(); // Focus the field
                await browser.pause(300); // Let it settle
                await input.setValue(message);
                await browser.pause(500); // Let the Send button enable

                if (submit) {
                    // Prefer clicking Send; fall back to Return if the button is absent.
                    try {
                        const send = await this.resolveSend();
                        await send.click();
                    } catch {
                        await browser.keys(['Return']);
                    }
                }
            },
            { label: 'sendMessage' }
        );
    }

    /**
     * Read all visible conversation text
     * Returns array of all AXStaticText values
     */
    async readConversation(): Promise<string[]> {
        const texts = await this.staticTexts;
        const values: string[] = [];

        for (const text of texts) {
            try {
                const value = await text.getText();
                if (value && value.trim()) {
                    values.push(value.trim());
                }
            } catch {
                // Skip elements that can't be read
            }
        }

        return values;
    }

    /**
     * Get full conversation as single string
     */
    async getConversationText(): Promise<string> {
        const lines = await this.readConversation();
        return lines.join('\n');
    }

    /**
     * Wait for expected text to appear in conversation
     */
    async waitForTextInConversation(
        expectedText: string,
        timeout: number = 30000
    ): Promise<string> {
        const pollInterval = 2000;
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const conversation = await this.getConversationText();

            if (conversation.toLowerCase().includes(expectedText.toLowerCase())) {
                return conversation;
            }

            await browser.pause(pollInterval);
        }

        // Return last seen conversation for assertion
        return await this.getConversationText();
    }

    /**
     * Send a message and wait for reply
     * Returns only the new text that appeared after sending
     */
    async sendAndGetReply(
        prompt: string,
        timeout: number = 30000,
        pollInterval: number = 1500,
        quietPeriod: number = 2000
    ): Promise<string> {
        await this.ensureAssistantScreen();

        // Snapshot conversation before sending
        const beforeLines = await this.readConversation();
        const beforeSet = new Set(beforeLines);

        // Send the prompt
        await this.sendMessage(prompt);

        // Poll for new content and wait for it to stabilize
        const deadline = Date.now() + timeout;
        let newLines: string[] = [];
        let lastChange = Date.now();

        while (Date.now() < deadline) {
            const currentLines = await this.readConversation();
            const current = currentLines.filter(line => !beforeSet.has(line));

            // Check if content changed
            if (JSON.stringify(current) !== JSON.stringify(newLines)) {
                newLines = current;
                lastChange = Date.now();
            } else if (newLines.length > 0 && Date.now() - lastChange >= quietPeriod) {
                // Content stable for quiet period - reply is complete
                break;
            }

            await browser.pause(pollInterval);
        }

        // Filter out the echoed prompt
        const replyLines = newLines.filter(line => line.trim() !== prompt.trim());

        return replyLines.join('\n');
    }

    /**
     * Check if assistant is currently responding (typing indicator visible)
     */
    async isAssistantResponding(): Promise<boolean> {
        try {
            // Look for typical "thinking" or "typing" indicators
            const conversation = await this.getConversationText();
            return (
                conversation.includes('...') ||
                conversation.includes('typing') ||
                conversation.includes('thinking')
            );
        } catch {
            return false;
        }
    }

    /**
     * Clear the input field without submitting
     */
    async clearInput(): Promise<void> {
        const input = await this.resolveInput();
        await input.click();
        await browser.keys(['Command', 'a']); // Select all
        await browser.keys(['Delete']);
    }

    /**
     * Take screenshot of the conversation
     * @param filename Optional filename for the screenshot
     */
    async captureConversation(filename?: string): Promise<void> {
        await this.takeScreenshot(filename);
    }

    /**
     * Activate/focus the Kept application window
     */
    async activate(): Promise<void> {
        // Mac2 driver should handle this automatically
        // But we can ensure window is focused
        try {
            await browser.execute('mobile: activateApp', {
                bundleId: 'com.aithinkers.ait-scribe'
            });
        } catch {
            // Fallback: just ensure we can see the input
            await this.waitForPageLoad();
        }
    }

    /**
     * Read-only: true when the chat input text view is present.
     */
    async hasChatInput(): Promise<boolean> {
        return (await $$('//XCUIElementTypeTextView').length) >= 1;
    }

    /**
     * Read-only: true when the Send button is present.
     */
    async hasSendButton(): Promise<boolean> {
        return (await $$('//XCUIElementTypeButton[@label="Send"]').length) >= 1;
    }

    /**
     * Read-only: labels of every button currently in the accessibility tree.
     */
    async getButtonLabels(): Promise<string[]> {
        const buttons = await $$('//XCUIElementTypeButton');
        const labels: string[] = [];
        for (const button of buttons) {
            try {
                const label = await button.getAttribute('label');
                if (label && label.trim()) {
                    labels.push(label.trim());
                }
            } catch {
                // Skip elements that can't be read
            }
        }
        return labels;
    }

    /**
     * Read-only: the Kept window title.
     */
    async getWindowTitle(): Promise<string> {
        try {
            const windowEl = await $('//XCUIElementTypeWindow');
            return (await windowEl.getAttribute('title')) || '';
        } catch {
            return '';
        }
    }
}
