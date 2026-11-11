// Temporary: dumps Kept's accessibility tree to find real selectors.
import { remote } from 'webdriverio';

const driver = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    logLevel: 'error',
    capabilities: {
        platformName: 'mac',
        'appium:automationName': 'Mac2',
        'appium:bundleId': 'com.aithinkers.ait-scribe'
    }
});

try {
    const src = await driver.getPageSource();
    console.log('=== PAGE SOURCE START ===');
    console.log(src);
    console.log('=== PAGE SOURCE END ===');
} finally {
    await driver.deleteSession();
}
