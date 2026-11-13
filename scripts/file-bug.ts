/**
 * File ONE approved bug draft in Jira (team format + screenshot).
 * Use only after Hardeep has approved the draft.
 * Usage:  npx ts-node -T scripts/file-bug.ts bug-drafts/<file>.json
 */
import { config } from 'dotenv';
config();
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { JiraClient } from '../src/jira/client';

void (async () => {
    const path = process.argv[2];
    if (!path || !existsSync(path))
        return console.log(
            'Give the draft .json file, e.g. bug-drafts/2026-11-12T16-51-00_AIT-WIN-313.json'
        );
    const draft = JSON.parse(readFileSync(path, 'utf8'));
    if (draft.filed) return console.log(`Already filed as ${draft.filed} - not filing again.`);
    const jira = new JiraClient();
    const issue = await jira.createFormattedBug(draft);
    if (!issue) return console.log('Not filed - check Jira settings in .env.');
    if (!issue.duplicate && draft.screenshot && existsSync(draft.screenshot)) {
        await jira.attachScreenshot(
            issue.key,
            readFileSync(draft.screenshot).toString('base64'),
            draft.screenshot.split('/').pop()
        );
    }
    draft.filed = issue.key;
    writeFileSync(path, JSON.stringify(draft, null, 2));
    console.log(
        issue.duplicate
            ? `Open bug already exists: ${issue.key} (not filed again)`
            : `Filed ${issue.key}`
    );
})();
