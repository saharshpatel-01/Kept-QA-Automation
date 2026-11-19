/// <reference types="@wdio/globals/types" />

import { Check, runSettingsCheck } from '../../../src/utils/screen-checks';

/**
 * Settings batch 2 - read-only display checks, ported from the CHECKS table of the Python suite
 * (projects/aitscribe/automation/tests/test_ui_screens.py). Same data, same judging as batch 1
 * (settings-checks.windows.spec.ts). Only cases in Sheet2 with Execution Type "Automated".
 * Nothing is created, changed or deleted.
 *
 * Left out on purpose: AIT-WIN-374 (Obsolete in Sheet2), AIT-WIN-393 (held, waiting for developer confirmation), AIT-WIN-388 (also checks switch states Off - needs a toggle-state helper).
 * Cases already in batch 1 or other specs are not repeated.
 */
const CHECKS: Check[] = [
    {
        id: 'AIT-WIN-315',
        title: 'Your devices shows current device with correct version',
        tab: 'Profile',
        must: ['Your devices', 'THIS PC']
    },
    {
        id: 'AIT-WIN-316',
        title: 'Sign out from Profile keeps notes in account',
        tab: 'Profile',
        must: ['Sign out', 'Your notes stay in your account']
    },
    {
        id: 'AIT-WIN-096',
        title: 'Acceleration Auto / CPU only / GPU preferred',
        tab: 'AI providers',
        must: ['Graphics card']
    },
    {
        id: 'AIT-WIN-108',
        title: 'Stale engine labels',
        tab: 'AI providers',
        must: ['Parakeet v3'],
        mustNot: ['Whisper', 'WhisperKit']
    },
    {
        id: 'AIT-WIN-337',
        title: 'Parakeet v3 details, storage path and Show in File Explorer',
        tab: 'AI providers',
        must: ['Parakeet v3', 'Show in File Explorer']
    },
    {
        id: 'AIT-WIN-344',
        title: 'Graphics card detection',
        tab: 'AI providers',
        must: ['Graphics card', 'Found:']
    },
    {
        id: 'AIT-WIN-345',
        title: 'Model for AI notes and the Assistant',
        tab: 'AI providers',
        must: ['Model for AI notes and the Assistant']
    },
    {
        id: 'AIT-WIN-417',
        title: "AI providers: 'Use my own OpenAI key for AI notes'",
        tab: 'AI providers',
        must: ['Use my own OpenAI key for AI notes']
    },
    {
        id: 'AIT-WIN-437',
        title: "Privacy & data: Windows permissions summary and Where it's processed",
        tab: 'Privacy & data',
        must: [
            'Windows permissions',
            'All 7 allowed',
            "Where it's processed",
            'Meeting transcription'
        ]
    },
    {
        id: 'AIT-WIN-439',
        title: 'Privacy & data: Activity log',
        tab: 'Privacy & data',
        must: ['Activity log', 'Sign-ins, shares and permission changes']
    },
    {
        id: 'AIT-WIN-434',
        title: 'Emails to others: sender, what gets sent and delivery',
        tab: 'Emails to others',
        must: [
            'What gets sent',
            'Workspace invitations',
            'Shared summaries and folders',
            'Task assigned',
            'Delivery'
        ]
    },
    {
        id: 'AIT-WIN-378',
        title: 'Tasks settings defaults',
        tab: 'Tasks',
        must: [
            'Open Tasks showing',
            'Reminder for tasks with a date',
            'Overdue nudge',
            'Evening summary',
            'Keep done tasks visible for',
            'Sync my tasks to'
        ]
    },
    {
        id: 'AIT-WIN-256',
        title: 'Tasks settings copy says reminders not delivered on Windows',
        tab: 'Tasks',
        must: ['Evening summary'],
        mustNot: ["aren't delivered on Windows"]
    },
    {
        id: 'AIT-WIN-383',
        title: 'AI Assistant settings and Memory',
        tab: 'AI Assistant',
        must: [
            'Start new chats with',
            'Remember things about me',
            'Web search',
            'New tools start as',
            'Apps and tools'
        ]
    },
    {
        id: 'AIT-WIN-384',
        title: "New tools start as' default is safe",
        tab: 'AI Assistant',
        must: ['New tools start as']
    },
    {
        id: 'AIT-WIN-421',
        title: 'AI notes: summary templates Edit and New template',
        tab: 'AI notes',
        must: ['General', '1:1', 'Sales / Discovery', 'Standup', 'Interview', 'New template']
    },
    {
        id: 'AIT-WIN-426',
        title: 'Speech to Text: Code editors style and Add an app',
        tab: 'Speech to Text',
        must: ['Code editors', 'Add an app']
    },
    {
        id: 'AIT-WIN-430',
        title: 'Speech to Text: Detect the language on the on-device model',
        tab: 'Speech to Text',
        must: ['Detect the language', 'Cloud models only']
    },
    {
        id: 'AIT-WIN-403',
        title: 'App icon: Taskbar and tray',
        tab: 'General',
        must: ['App icon', 'Closing the window keeps Kept running']
    },
    {
        id: 'AIT-WIN-405',
        title: 'General: Check for updates automatically toggle',
        tab: 'General',
        must: ['Check for updates automatically']
    },
    {
        id: 'AIT-WIN-293',
        title: 'About → Check for updates',
        tab: 'General',
        must: ['Check for updates automatically', 'Check now']
    },
    {
        id: 'AIT-WIN-412',
        title: "Accounts & connectors: connected Google account and 'Contacts not granted'",
        tab: 'Accounts & connectors',
        must: ['Accounts', 'Add account', '@']
    },
    {
        id: 'AIT-WIN-413',
        title: "Accounts & connectors: 'When you have more than one account'",
        tab: 'Accounts & connectors',
        must: [
            'When you have more than one account',
            'New events and Join links go on',
            'Send recap emails from'
        ]
    },
    {
        id: 'AIT-WIN-320',
        title: 'Help & about → Replay the tips',
        tab: 'Help & about',
        must: ['Replay the tips']
    },
    {
        id: 'AIT-WIN-443',
        title: 'Help & about: Licences',
        tab: 'Help & about',
        must: ['Licences', 'Open-source notices']
    },
    {
        id: 'AIT-WIN-323',
        title: 'Meeting hotkey Ctrl+Alt+M is fixed and not editable',
        tab: 'Hotkeys',
        must: ['Start / stop meeting', 'Changing it is coming soon']
    },
    {
        id: 'AIT-WIN-324',
        title: "Talk to the AI hotkey shows 'Not set' / coming soon",
        tab: 'Hotkeys',
        must: ['Talk to the AI', 'Not set', 'coming soon']
    },
    {
        id: 'AIT-WIN-326',
        title: 'All keyboard shortcuts page and tips for picking a key',
        tab: 'Hotkeys',
        must: ['All keyboard shortcuts', 'Tips for picking a key', 'Use at most 3 keys']
    },
    {
        id: 'AIT-WIN-433',
        title: 'Voice conversation: Memory and History',
        tab: 'Voice conversation',
        must: ['Memory', 'History', 'New conversation', 'Clear all chats']
    }
];

describe('Kept (Windows) - Settings checks, batch 2', () => {
    for (const c of CHECKS) {
        it(`[${c.id}] ${c.title}`, async () => {
            await runSettingsCheck(c);
        });
    }

    // Both screens (AI providers and Speech to Text) must state the same languages.
    it('[AIT-WIN-338] Parakeet language copy is consistent across screens', async () => {
        const languages = 'English and 24 European languages';
        for (const tab of ['AI providers', 'Speech to Text']) {
            await runSettingsCheck({ id: 'AIT-WIN-338', title: tab, tab, must: [languages] });
        }
    });
});
