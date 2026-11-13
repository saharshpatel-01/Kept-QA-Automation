import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

/**
 * Flatten Atlassian Document Format (ADF) to plain text. Jira returns rich
 * description content as a nested node tree; we only need the readable text for
 * the AI to generate test cases from.
 */
function adfToPlainText(node: unknown): string {
    if (!node || typeof node !== 'object') return '';
    const n = node as { text?: string; content?: unknown[]; type?: string };
    if (typeof n.text === 'string') return n.text;
    const inner = Array.isArray(n.content) ? n.content.map(adfToPlainText).join('') : '';
    // Preserve paragraph / list-item boundaries as line breaks.
    return n.type === 'paragraph' || n.type === 'listItem' ? inner + '\n' : inner;
}

export interface FormattedBug {
    title: string;
    description: string;
    steps: string[];
    actual: string;
    expected: string;
    environment: string;
    priority?: string;
    labels?: string[];
}

export interface JiraIssue {
    key: string;
    fields: {
        summary: string;
        description: string;
        priority: { name: string };
        labels: string[];
    };
}

/**
 * Jira API client for searching and creating issues
 */
export class JiraClient {
    private client: AxiosInstance;
    private baseUrl: string;
    private projectKey: string;

    constructor() {
        this.baseUrl = process.env.JIRA_BASE_URL || '';
        this.projectKey = process.env.JIRA_PROJECT_KEY || 'KEPT';

        if (!this.baseUrl || !process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
            logger.warn('Jira not configured. Issue creation will be disabled.');
        }

        this.client = axios.create({
            baseURL: `${this.baseUrl}/rest/api/3`,
            auth: {
                username: process.env.JIRA_EMAIL || '',
                password: process.env.JIRA_API_TOKEN || ''
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Fetch a single issue (e.g. a requirement/story) with its plain-text
     * description so the AI can generate test cases from it. Returns null when
     * Jira isn't configured or the issue can't be read.
     */
    async getIssue(issueKey: string): Promise<{
        key: string;
        summary: string;
        description: string;
        labels: string[];
    } | null> {
        if (!this.baseUrl) {
            logger.warn('Jira not configured; cannot fetch issue.');
            return null;
        }
        try {
            const response = await this.client.get(`/issue/${issueKey}`, {
                params: { fields: 'summary,description,labels' }
            });
            const fields = response.data.fields ?? {};
            return {
                key: response.data.key,
                summary: fields.summary ?? '',
                description: adfToPlainText(fields.description),
                labels: fields.labels ?? []
            };
        } catch (error) {
            logger.error(`Failed to fetch Jira issue ${issueKey}:`, error);
            return null;
        }
    }

    /**
     * Search for existing issues by summary
     */
    async searchDuplicates(summary: string): Promise<JiraIssue[]> {
        if (!this.baseUrl) {
            logger.warn('Jira not configured');
            return [];
        }

        try {
            const jql = `project = ${this.projectKey} AND summary ~ "${summary}" AND resolution = Unresolved`;

            // Jira Cloud replaced GET /search with GET /search/jql (2024+).
            const response = await this.client.get('/search/jql', {
                params: {
                    jql,
                    fields: 'summary,description,priority,labels',
                    maxResults: 5
                }
            });

            return response.data.issues || [];
        } catch (error) {
            logger.error('Failed to search Jira:', error);
            return [];
        }
    }

    /**
     * Create a new bug issue
     */
    async createBug(bug: {
        summary: string;
        description: string;
        priority: string;
        labels: string[];
        environment?: string;
    }): Promise<string | null> {
        if (!this.baseUrl) {
            logger.warn('Jira not configured. Bug not created.');
            return null;
        }

        try {
            // First check for duplicates
            const duplicates = await this.searchDuplicates(bug.summary);
            if (duplicates.length > 0) {
                logger.info(
                    `Found ${duplicates.length} potential duplicate(s): ${duplicates[0].key}`
                );
                return duplicates[0].key;
            }

            // Create new issue
            const response = await this.client.post('/issue', {
                fields: {
                    project: {
                        key: this.projectKey
                    },
                    summary: bug.summary,
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'text',
                                        text: bug.description
                                    }
                                ]
                            }
                        ]
                    },
                    issuetype: {
                        name: 'Bug'
                    },
                    priority: {
                        name: bug.priority
                    },
                    labels: [...bug.labels, 'automation-detected'],
                    environment: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'text',
                                        text: bug.environment || 'Automation Test'
                                    }
                                ]
                            }
                        ]
                    }
                }
            });

            logger.info(`Created Jira issue: ${response.data.key}`);
            return response.data.key;
        } catch (error) {
            logger.error('Failed to create Jira issue:', error);
            return null;
        }
    }

    /**
     * Create a bug in Hardeep's Jira board format:
     * Bug Title, Description, Steps to Reproduce (numbered), Actual Result, Expected Result.
     * Skips creation and returns the existing issue when an open duplicate has the same title.
     */
    async createFormattedBug(
        bug: FormattedBug
    ): Promise<{ key: string; id: number; duplicate: boolean } | null> {
        if (!this.baseUrl) {
            logger.warn('Jira not configured. Bug not created.');
            return null;
        }
        try {
            // JQL text search rejects [ ] > " etc. - search on words only.
            const words = bug.title
                .replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const duplicates = await this.searchDuplicates(words);
            if (duplicates.length > 0) {
                const key = duplicates[0].key;
                logger.info(
                    `Open bug with the same title already exists: ${key} (not filing again)`
                );
                return { key, id: await this.getIssueId(key), duplicate: true };
            }
            // Layout matches the team's manual bugs: bold labels, not headings.
            const para = (text: string) => ({
                type: 'paragraph',
                content: text ? [{ type: 'text', text }] : []
            });
            const label = (name: string, value = '') => ({
                type: 'paragraph',
                content: [
                    { type: 'text', text: name, marks: [{ type: 'strong' }] },
                    ...(value ? [{ type: 'text', text: ` ${value}` }] : [])
                ]
            });
            const steps = bug.steps.length ? bug.steps : ['(steps were not recorded by this test)'];
            const plainTitle = bug.title.replace(/^\[[^\]]+\]\s*/, '');
            const description = {
                type: 'doc',
                version: 1,
                content: [
                    label('Bug Title:', plainTitle),
                    label('Description:'),
                    para(`${bug.description} ${bug.environment}`.trim()),
                    label('Steps to Reproduce:'),
                    {
                        type: 'orderedList',
                        content: steps.map(s => ({ type: 'listItem', content: [para(s)] }))
                    },
                    label('Actual Result:'),
                    para(bug.actual),
                    label('Expected Result:'),
                    para(bug.expected)
                ]
            };
            const res = await this.client.post('/issue', {
                fields: {
                    project: { key: this.projectKey },
                    summary: bug.title,
                    description,
                    issuetype: { name: 'Bug' },
                    ...(bug.priority ? { priority: { name: bug.priority } } : {}),
                    labels: [...(bug.labels || []), 'automation-detected']
                }
            });
            logger.info(`Created Jira bug ${res.data.key}: ${bug.title}`);
            return { key: res.data.key, id: Number(res.data.id), duplicate: false };
        } catch (error) {
            logger.error('Failed to create Jira bug:', error);
            return null;
        }
    }

    /** Numeric Jira id for an issue key (Zephyr links need the id, not the key). */
    async getIssueId(key: string): Promise<number> {
        const res = await this.client.get(`/issue/${key}`, { params: { fields: 'summary' } });
        return Number(res.data.id);
    }

    /** Attach a PNG screenshot (base64) to an issue. */
    async attachScreenshot(
        key: string,
        base64Png: string,
        filename = 'failure.png'
    ): Promise<void> {
        if (!this.baseUrl) return;
        try {
            const form = new FormData();
            form.append(
                'file',
                new Blob([Buffer.from(base64Png, 'base64')], { type: 'image/png' }),
                filename
            );
            await this.client.post(`/issue/${key}/attachments`, form, {
                headers: { 'X-Atlassian-Token': 'no-check', 'Content-Type': 'multipart/form-data' }
            });
        } catch (error) {
            logger.warn(`Could not attach screenshot to ${key}: ${error}`);
        }
    }

    /**
     * Add comment to existing issue
     */
    async addComment(issueKey: string, comment: string): Promise<boolean> {
        if (!this.baseUrl) {
            return false;
        }

        try {
            await this.client.post(`/issue/${issueKey}/comment`, {
                body: {
                    type: 'doc',
                    version: 1,
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                {
                                    type: 'text',
                                    text: comment
                                }
                            ]
                        }
                    ]
                }
            });

            logger.info(`Added comment to ${issueKey}`);
            return true;
        } catch (error) {
            logger.error('Failed to add comment:', error);
            return false;
        }
    }
}
