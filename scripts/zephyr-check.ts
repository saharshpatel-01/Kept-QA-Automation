/**
 * Read-only Zephyr Scale connection check. Creates nothing.
 * Usage:  npx ts-node -T scripts/zephyr-check.ts
 */
import { config } from 'dotenv';
config();
import axios from 'axios';

const token = (process.env.ZEPHYR_API_TOKEN || '').trim();
const project = (process.env.ZEPHYR_PROJECT_KEY || '').trim();
const api = axios.create({
    baseURL: process.env.ZEPHYR_BASE_URL || 'https://api.zephyrscale.smartbear.com/v2',
    headers: { Authorization: `Bearer ${token}` }
});

void (async () => {
    if (!token || !project)
        return console.log('Missing in .env: ZEPHYR_API_TOKEN and/or ZEPHYR_PROJECT_KEY');
    console.log(`Project: ${project}   Token length: ${token.length}`);
    try {
        const tc = await api.get('/testcases', { params: { projectKey: project, maxResults: 5 } });
        const list = tc.data.values || [];
        console.log(
            `1. Zephyr OK - ${tc.data.total ?? list.length} test case(s) in ${project}. First keys:`
        );
        for (const t of list) console.log(`   ${t.key}  ${t.name}`);
    } catch (e) {
        const s = (e as { response?: { status?: number } }).response?.status;
        return console.log(
            `1. Zephyr FAILED (HTTP ${s ?? '?'}) ${s === 401 ? '- token wrong or expired' : s === 400 || s === 404 ? '- project key wrong or Zephyr not enabled for it' : ''}`
        );
    }
    try {
        const st = await api.get('/statuses', {
            params: { projectKey: project, statusType: 'TEST_EXECUTION' }
        });
        console.log(
            `2. Execution statuses: ${(st.data.values || []).map((v: { name: string }) => v.name).join(', ')}`
        );
    } catch {
        console.log('2. Could not read execution statuses (not critical).');
    }
})();
