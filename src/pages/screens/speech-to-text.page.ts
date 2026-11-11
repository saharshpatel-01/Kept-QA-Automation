/// <reference types="@wdio/globals/types" />

import { ScreenPage } from './screen.base';
import { Screen } from '../../utils/native-nav';

/** Speech to Text screen. */
export class SpeechToTextScreen extends ScreenPage {
    protected readonly screen = Screen.SpeechToText;
}
