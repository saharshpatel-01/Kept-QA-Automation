import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { logger } from './logger';

function tryExec(cmd: string): { ok: boolean; out: string } {
    try {
        return {
            ok: true,
            out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
        };
    } catch (e) {
        const err = e as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
        return { ok: false, out: String(err.stderr || err.stdout || err.message || '').trim() };
    }
}

/**
 * Validates that the host is ready to run Mac2 automation. Throws a single
 * actionable error listing everything that needs fixing, so a run fails fast
 * with clear guidance instead of a cryptic Appium session crash.
 */
export function preflightMac(bundleId: string, appPath?: string): void {
    const problems: string[] = [];

    const devDir = tryExec('xcode-select -p');
    if (!devDir.ok || devDir.out.includes('CommandLineTools') || !devDir.out) {
        problems.push(
            'Full Xcode is not selected (Mac2 needs it to build WebDriverAgentMac).\n' +
                '    Fix: install Xcode from the App Store, then run:\n' +
                '      sudo xcode-select -s /Applications/Xcode.app/Contents/Developer\n' +
                '      sudo xcodebuild -license accept'
        );
    } else {
        const xcodebuild = tryExec('xcodebuild -version');
        if (!xcodebuild.ok) {
            problems.push(
                'xcodebuild is not usable: ' +
                    xcodebuild.out +
                    '\n' +
                    '    Fix: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer'
            );
        }
    }

    if (appPath && !existsSync(appPath)) {
        problems.push(
            `Kept app not found at MAC_APP_PATH="${appPath}". Install Kept or fix the path in .env.`
        );
    }

    const appium = tryExec('appium --version');
    if (!appium.ok) {
        problems.push('Appium is not installed or not on PATH. Install with: npm i -g appium');
    } else {
        const drivers = tryExec('appium driver list --installed 2>&1');
        if (!/mac2/i.test(drivers.out)) {
            problems.push(
                'Appium mac2 driver is not installed. Install with: appium driver install mac2'
            );
        }
    }

    if (problems.length > 0) {
        const msg =
            '\nPreflight checks failed for Mac2 automation (bundleId=' +
            bundleId +
            '):\n\n' +
            problems.map((p, i) => `  ${i + 1}. ${p}`).join('\n\n') +
            '\n\nAlso ensure your terminal/IDE has Accessibility permission:\n' +
            '  System Settings → Privacy & Security → Accessibility.\n';
        throw new Error(msg);
    }

    logger.info('Preflight OK: Xcode, Appium, mac2 driver and Kept app are ready.');
}
