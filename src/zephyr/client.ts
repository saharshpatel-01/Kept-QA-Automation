import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

/**
 * Zephyr Scale Cloud client (REST API v2).
 * Needs ZEPHYR_API_TOKEN (Jira > Zephyr > API Access Tokens) and ZEPHYR_PROJECT_KEY.
 * Without them every method is a safe no-op, so runs never break.
 */
export class ZephyrClient {
    private client: AxiosInstance;
    readonly projectKey: string;
    readonly enabled: boolean;

    constructor() {
        const token = process.env.ZEPHYR_API_TOKEN || '';
        this.projectKey = process.env.ZEPHYR_PROJECT_KEY || process.env.JIRA_PROJECT_KEY || '';
        this.enabled = Boolean(token && this.projectKey);
        this.client = axios.create({
            baseURL: process.env.ZEPHYR_BASE_URL || 'https://api.zephyrscale.smartbear.com/v2',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            timeout: 30000
        });
    }

    /** Create a test cycle for this run. Returns its key (e.g. KEPT-R12) or null. */
    async createCycle(name: string, description = ''): Promise<string | null> {
        if (!this.enabled) return null;
        try {
            const res = await this.client.post('/testcycles', {
                projectKey: this.projectKey,
                name,
                description
            });
            logger.info(`[zephyr] Created test cycle ${res.data.key}: ${name}`);
            return res.data.key ?? null;
        } catch (e) {
            logger.error(`[zephyr] Could not create test cycle: ${errText(e)}`);
            return null;
        }
    }

    /** Record one result. Returns the execution id (needed to link a bug) or null. */
    async createExecution(r: {
        testCaseKey: string;
        testCycleKey: string;
        status: 'Pass' | 'Fail' | 'Blocked' | 'Not Executed';
        comment?: string;
        environmentName?: string;
        executionTimeMs?: number;
    }): Promise<number | null> {
        if (!this.enabled) return null;
        try {
            const res = await this.client.post('/testexecutions', {
                projectKey: this.projectKey,
                testCaseKey: r.testCaseKey,
                testCycleKey: r.testCycleKey,
                statusName: r.status,
                ...(r.comment ? { comment: r.comment } : {}),
                ...(r.environmentName ? { environmentName: r.environmentName } : {}),
                ...(r.executionTimeMs ? { executionTime: r.executionTimeMs } : {})
            });
            logger.info(`[zephyr] ${r.testCaseKey} = ${r.status} (cycle ${r.testCycleKey})`);
            return res.data.id ?? null;
        } catch (e) {
            logger.error(`[zephyr] Could not record ${r.testCaseKey}: ${errText(e)}`);
            return null;
        }
    }

    /** Link a Jira issue (by numeric id) to a test execution. */
    async linkIssue(executionId: number, jiraIssueId: number): Promise<boolean> {
        if (!this.enabled) return false;
        try {
            await this.client.post(`/testexecutions/${executionId}/links/issues`, {
                issueId: jiraIssueId
            });
            return true;
        } catch (e) {
            logger.error(`[zephyr] Could not link issue ${jiraIssueId}: ${errText(e)}`);
            return false;
        }
    }
}

function errText(e: unknown): string {
    const ax = e as { response?: { status?: number; data?: unknown }; message?: string };
    return ax.response
        ? `HTTP ${ax.response.status} ${JSON.stringify(ax.response.data)}`
        : String(ax.message || e);
}
