/// <reference types="@wdio/globals/types" />

import { ScreenPage } from './screen.base';
import { Screen } from '../../utils/native-nav';

/** Tasks (Kanban) screen. */
export class TasksScreen extends ScreenPage {
    protected readonly screen = Screen.Tasks;

    async hasColumn(name: string): Promise<boolean> {
        return this.hasText(name);
    }
}
