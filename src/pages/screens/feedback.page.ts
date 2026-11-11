/// <reference types="@wdio/globals/types" />

import { ScreenPage } from './screen.base';
import { Screen } from '../../utils/native-nav';

/** Feedback screen. */
export class FeedbackScreen extends ScreenPage {
    protected readonly screen = Screen.Feedback;

    /** Returns the "Kept x.y.z (build) · macOS ..." version string if visible. */
    async getVersionString(): Promise<string> {
        const texts = await this.staticTexts();
        return texts.find(t => /^Kept\s+\d+\.\d+\.\d+/.test(t)) ?? '';
    }
}
