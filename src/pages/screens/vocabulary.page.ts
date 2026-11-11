/// <reference types="@wdio/globals/types" />

import { ScreenPage } from './screen.base';
import { Screen } from '../../utils/native-nav';

/** Vocabulary screen (Words / Replacements / Snippets). */
export class VocabularyScreen extends ScreenPage {
    protected readonly screen = Screen.Vocabulary;

    async hasTab(name: string): Promise<boolean> {
        return (await this.hasButton(name)) || (await this.hasText(name));
    }
}
