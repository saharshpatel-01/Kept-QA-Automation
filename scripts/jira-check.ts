/**
 * Read-only Jira connection check. Creates nothing.
 * Usage:  npx ts-node -T scripts/jira-check.ts XTHIN-55
 */
import { config } from 'dotenv';
config();
import axios from 'axios';

const key = process.argv[2];
const base = (process.env.JIRA_BASE_URL || '').trim().replace(/\/+$/, '');
const project = (process.env.JIRA_PROJECT_KEY || '').trim();
const auth = {
    username: (process.env.JIRA_EMAIL || '').trim(),
    password: (process.env.JIRA_API_TOKEN || '').trim()
};
const missing = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'].filter(
    v => !process.env[v]
);

function status(e: unknown): string {
    const r = (e as { response?: { status?: number } }).response;
    return r?.status ? `HTTP ${r.status}` : (e as Error).message;
}

void (async () => {
    if (missing.length) return console.log(`Missing in .env: ${missing.join(', ')}`);
    console.log(`Site: ${base}   Email: ${auth.username}   Token length: ${auth.password.length}`);
    if (!/^https:\/\/[a-z0-9-]+\.atlassian\.net$/i.test(base)) {
        console.log(
            'WARNING: JIRA_BASE_URL should look like https://aithinkers.atlassian.net (nothing after .net)'
        );
    }

    // 1. Who am I? (tests email + token)
    try {
        const me = await axios.get(`${base}/rest/api/3/myself`, { auth });
        console.log(`1. Login OK - signed in as ${me.data.displayName}`);
    } catch (e) {
        console.log(
            `1. Login FAILED (${status(e)}) - email or token is wrong, or the token was revoked.`
        );
        return;
    }

    // 2. Can I see the project?
    try {
        const p = await axios.get(`${base}/rest/api/3/project/${project}`, { auth });
        const names = (p.data.issueTypes || []).map((t: { name: string }) => t.name);
        console.log(
            `2. Project ${project} OK - "${p.data.name}". Issue types: ${names.join(', ')}`
        );
        console.log(
            names.includes('Bug')
                ? '   Bug type found - auto-bugs can be created.'
                : '   WARNING: no "Bug" issue type.'
        );
    } catch (e) {
        console.log(
            `2. Project ${project} NOT visible (${status(e)}) - wrong key or no permission.`
        );
    }

    // 3. Optional ticket
    if (key) {
        try {
            const i = await axios.get(`${base}/rest/api/3/issue/${key}`, {
                auth,
                params: { fields: 'summary' }
            });
            console.log(`3. Ticket ${i.data.key} OK - ${i.data.fields.summary}`);
        } catch (e) {
            console.log(
                `3. Ticket ${key} not found (${status(e)}) - fine if that ticket no longer exists.`
            );
        }
    }
})();
