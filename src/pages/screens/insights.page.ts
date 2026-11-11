/// <reference types="@wdio/globals/types" />

import { ScreenPage } from './screen.base';
import { Screen } from '../../utils/native-nav';

/** Insights screen. */
export class InsightsScreen extends ScreenPage {
    protected readonly screen = Screen.Insights;
}
