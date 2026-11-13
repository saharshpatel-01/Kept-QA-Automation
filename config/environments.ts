/**
 * Centralised environment profiles. Select with TEST_ENV (local | ci).
 * Keeps timeouts, retries and Appium connection settings out of wdio.conf.
 */

export type Platform = 'mac' | 'windows';

export interface EnvironmentConfig {
    name: string;
    platform: Platform;
    appium: {
        host: string;
        port: number;
        path: string;
    };
    timeouts: {
        waitforTimeout: number;
        connectionRetryTimeout: number;
        mochaTimeout: number;
    };
    retries: {
        specFileRetries: number;
        mochaRetries: number;
    };
}

const appium = {
    host: process.env.APPIUM_HOST || '127.0.0.1',
    port: Number(process.env.APPIUM_PORT) || 4723,
    path: '/'
};

// Read lazily: this module is imported before wdio.conf loads .env, so reading
// TEST_PLATFORM at import time would ignore a value set in .env.
const platform = (): Platform => (process.env.TEST_PLATFORM || 'mac').toLowerCase() as Platform;

const environments: Record<string, EnvironmentConfig> = {
    local: {
        name: 'local',
        platform: 'mac',
        appium,
        timeouts: {
            waitforTimeout: 15000,
            connectionRetryTimeout: 120000,
            mochaTimeout: 90000
        },
        retries: {
            specFileRetries: 0,
            // Rerun a failing test once before it counts (filters flaky/timing failures).
            mochaRetries: Number(process.env.TEST_RETRIES ?? 1)
        }
    },
    ci: {
        name: 'ci',
        platform: 'mac',
        appium,
        timeouts: {
            waitforTimeout: 20000,
            connectionRetryTimeout: 180000,
            mochaTimeout: 120000
        },
        retries: {
            specFileRetries: 1,
            mochaRetries: 1
        }
    }
};

export function getEnvironment(): EnvironmentConfig {
    const key = (process.env.TEST_ENV || 'local').toLowerCase();
    const env = environments[key];
    if (!env) {
        throw new Error(
            `Unknown TEST_ENV "${key}". Valid values: ${Object.keys(environments).join(', ')}`
        );
    }
    return { ...env, platform: platform() };
}
