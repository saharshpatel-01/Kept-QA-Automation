/// <reference types="@wdio/globals/types" />

import { ScreenPage } from './screen.base';
import { sendChatMessage, searchConversations, SendResult, Screen } from '../../utils/native-nav';

/** AI Assistant (default) screen. */
export class AssistantScreen extends ScreenPage {
    protected readonly screen = Screen.Assistant;

    async hasChatInput(): Promise<boolean> {
        return (await this.count('TextView')) >= 1;
    }

    async hasSendButton(): Promise<boolean> {
        return this.hasButton('Send');
    }

    /** True when the sidebar "Search conversations" field is present. */
    async hasSearchBox(): Promise<boolean> {
        return (await this.count('TextField')) >= 1;
    }

    /**
     * Send a prompt to the assistant via the native AX layer (crash-safe input).
     * Throws if the message could not be composed/submitted.
     */
    async sendMessage(message: string): Promise<void> {
        const result: SendResult = sendChatMessage(message);
        if (result !== 'SENT') {
            throw new Error(`Failed to send chat message: ${result}`);
        }
    }

    /**
     * Poll the conversation until an assistant reply appears after `sentMarker`
     * was sent, or the timeout elapses. Returns the new text lines captured.
     */
    async waitForReply(sentMarker: string, timeoutMs = 45000): Promise<string[]> {
        const before = new Set(await this.staticTexts());
        const deadline = Date.now() + timeoutMs;
        let markerSeen = false;

        while (Date.now() < deadline) {
            await browser.pause(2000);
            const current = await this.staticTexts();
            if (current.some(t => t.includes(sentMarker))) markerSeen = true;
            const fresh = current.filter(
                t => !before.has(t) && !t.includes(sentMarker) && t.length > 3
            );
            if (markerSeen && fresh.length > 0) {
                return fresh;
            }
        }
        return [];
    }

    /** Send a prompt and return the assistant's reply lines. */
    async sendAndGetReply(message: string, timeoutMs = 45000): Promise<string[]> {
        await this.sendMessage(message);
        return this.waitForReply(message, timeoutMs);
    }

    /** Send a prompt and measure how long until a reply appears (ms). */
    async sendAndTimeReply(
        message: string,
        timeoutMs = 60000
    ): Promise<{ reply: string[]; ms: number }> {
        const start = Date.now();
        await this.sendMessage(message);
        const reply = await this.waitForReply(message, timeoutMs);
        return { reply, ms: Date.now() - start };
    }

    /** Full visible conversation text (all static-text lines joined). */
    async getConversationText(): Promise<string> {
        return (await this.staticTexts()).join('\n');
    }

    /** True when the assistant's reply text contains `needle` (case-insensitive). */
    replyContains(reply: string[], needle: string): boolean {
        return reply.join('\n').toLowerCase().includes(needle.toLowerCase());
    }

    /** True when the conversations-history control ("Show conversations") is present. */
    async hasConversationsList(): Promise<boolean> {
        return this.hasButton('conversations');
    }

    /**
     * Type a query into the "Search conversations" box via the native AX layer.
     * Returns true when the query was accepted by the field.
     */
    async searchConversations(query: string): Promise<boolean> {
        return searchConversations(query) === 'SEARCHED';
    }
}
