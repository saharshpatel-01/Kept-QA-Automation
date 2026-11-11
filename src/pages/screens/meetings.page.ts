/// <reference types="@wdio/globals/types" />

import { ScreenPage } from './screen.base';
import { Screen } from '../../utils/native-nav';

/** Meetings screen. */
export class MeetingsScreen extends ScreenPage {
    protected readonly screen = Screen.Meetings;
}
