export interface AppiumConfig {
    host: string;
    port: number;
    logLevel: string;
}

export interface PlatformConfig {
    mac: {
        bundleId: string;
        appPath?: string;
        automationName: string;
    };
    windows: {
        appPath: string;
        automationName: string;
    };
}

export const appiumConfig: AppiumConfig = {
    host: process.env.APPIUM_HOST || 'localhost',
    port: parseInt(process.env.APPIUM_PORT || '4723'),
    logLevel: process.env.LOG_LEVEL || 'info'
};

export const platformConfig: PlatformConfig = {
    mac: {
        bundleId: process.env.MAC_BUNDLE_ID || 'com.aithinkers.ait-scribe',
        appPath: process.env.MAC_APP_PATH,
        automationName: 'Mac2'
    },
    windows: {
        appPath: process.env.WINDOWS_APP_PATH || 'C:\\Program Files\\Kept\\Kept.exe',
        automationName: 'Windows'
    }
};
