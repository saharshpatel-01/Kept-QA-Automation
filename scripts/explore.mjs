// Temporary: explore Kept's screens to design tests.
// Navigation uses macOS Accessibility AXPress (osascript) to avoid the XCUITest
// synthetic-input crash; Appium is used read-only to capture each screen.
import { remote } from 'webdriverio';
import { execSync } from 'node:child_process';

const SCREENS = [
    'AI Assistant',
    'Meetings',
    'Speech to Text',
    'Vocabulary',
    'Tasks',
    'Insights',
    'Feedback',
];

function axPress(helpLabel) {
    const script =
        `tell application "System Events" to tell process "Kept" to click ` +
        `(first button of group 1 of front window whose help is "${helpLabel}")`;
    try {
        execSync(`osascript -e '${script}'`, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 });
        return true;
    } catch (e) {
        console.log(`  (navigation to "${helpLabel}" failed: ${String(e.message).split('\n')[0]})`);
        return false;
    }
}

function summarize(xml) {
    const count = (re) => (xml.match(re) || []).length;
    const attrs = (tag, attr) => {
        const out = [];
        const re = new RegExp(`<XCUIElementType${tag}[^>]*\\b${attr}="([^"]+)"`, 'g');
        let m;
        while ((m = re.exec(xml)) !== null) {
            const v = m[1].trim();
            if (v && !out.includes(v)) out.push(v);
        }
        return out;
    };
    return {
        counts: {
            buttons: count(/<XCUIElementTypeButton\b/g),
            staticTexts: count(/<XCUIElementTypeStaticText\b/g),
            textFields: count(/<XCUIElementTypeTextField\b/g),
            textViews: count(/<XCUIElementTypeTextView\b/g),
            cells: count(/<XCUIElementTypeCell\b/g),
            tables: count(/<XCUIElementTypeTable\b/g),
            scrollViews: count(/<XCUIElementTypeScrollView\b/g),
            images: count(/<XCUIElementTypeImage\b/g),
        },
        buttonLabels: attrs('Button', 'label').slice(0, 25),
        staticTexts: attrs('StaticText', 'value').slice(0, 25),
        textFieldPlaceholders: attrs('TextField', 'placeholderValue'),
    };
}

const driver = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    logLevel: 'error',
    capabilities: {
        platformName: 'mac',
        'appium:automationName': 'Mac2',
        'appium:bundleId': 'com.aithinkers.ait-scribe',
    },
});

try {
    for (const screen of SCREENS) {
        console.log(`\n================ SCREEN: ${screen} ================`);
        if (screen !== 'AI Assistant') axPress(screen);
        await new Promise((r) => setTimeout(r, 1800));
        const xml = await driver.getPageSource();
        const s = summarize(xml);
        console.log('counts:', JSON.stringify(s.counts));
        console.log('buttons:', s.buttonLabels.join(' | '));
        console.log('texts  :', s.staticTexts.join(' | '));
        if (s.textFieldPlaceholders.length) {
            console.log('inputs :', s.textFieldPlaceholders.join(' | '));
        }
    }
} finally {
    try { await driver.deleteSession(); } catch { /* ignore */ }
}
