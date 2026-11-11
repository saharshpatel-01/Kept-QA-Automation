import { BasePage } from '../base.page';

/**
 * Page Object for Kept main window on Windows
 * Windows-specific selectors and interactions
 */
export class KeptMainPageWindows extends BasePage {
    /**
     * Windows selectors (using name, automation ID, or XPath)
     * Update these based on WinAppDriver inspector findings
     */
    private get inputField() {
        return $('[name="Input Field"]'); // Windows control name
    }

    private get sendButton() {
        return $('[name="Send"]');
    }

    private get lastMessage() {
        return $('[AutomationId="LastMessage"]');
    }

    private get aiResponseArea() {
        return $('[AutomationId="AIResponse"]');
    }

    /**
     * Wait for the main page to load
     */
    async waitForPageLoad(): Promise<void> {
        await this.waitForElement(this.inputField, 15000);
        await this.waitForElement(this.sendButton);
    }

    /**
     * Check if the app is ready
     */
    async isAppReady(): Promise<boolean> {
        return (
            (await this.isDisplayed(this.inputField)) && (await this.isDisplayed(this.sendButton))
        );
    }

    /**
     * Send a message to the AI assistant
     */
    async sendMessage(message: string): Promise<void> {
        await this.typeText(this.inputField, message);
        await this.clickElement(this.sendButton);
        await browser.pause(1000);
    }

    /**
     * Get the last message sent
     */
    async getLastMessage(): Promise<string> {
        await this.waitForElement(this.lastMessage);
        return await this.getText(this.lastMessage);
    }

    /**
     * Wait for AI response
     */
    async waitForAIResponse(timeout: number = 30000): Promise<void> {
        await this.waitForElement(this.aiResponseArea, timeout);
        await browser.pause(2000);
    }

    /**
     * Get AI response text
     */
    async getAIResponse(): Promise<string> {
        await this.waitForElement(this.aiResponseArea);
        return await this.getText(this.aiResponseArea);
    }

    /**
     * Take screenshot of conversation
     * @param filename Optional filename for the screenshot
     */
    async captureConversation(filename?: string): Promise<void> {
        await this.takeScreenshot(filename);
    }
}
