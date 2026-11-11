/// <reference types="@wdio/globals/types" />

import { TasksScreen } from '../../../src/pages/screens/tasks.page';

/**
 * Tasks (Kanban) screen - E2E content verification.
 */
describe('Kept E2E - Tasks screen @e2e @regression', () => {
    const tasks = new TasksScreen();

    before(async () => {
        await tasks.open();
    });

    it('renders the Kanban columns', async () => {
        const columnsPresent =
            (await tasks.hasColumn('Upcoming')) ||
            (await tasks.hasColumn('To do')) ||
            (await tasks.hasColumn('In progress')) ||
            (await tasks.hasColumn('Completed'));
        expect(columnsPresent).toBe(true);
    });

    it('offers a way to create a new task', async () => {
        const hasNew =
            (await tasks.hasButton('New task')) ||
            (await tasks.hasButton('New')) ||
            (await tasks.hasText('New task'));
        expect(hasNew).toBe(true);
    });

    it('keeps the global sidebar visible', async () => {
        expect(await tasks.hasSidebar()).toBe(true);
    });
});
