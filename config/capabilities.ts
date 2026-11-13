/**
 * Appium capability profiles per platform. Keeps capability shape in one place
 * so wdio.conf stays declarative.
 */
import type { Platform } from './environments';

// WebdriverIO capabilities are loosely typed; Appium vendor caps need `any`.
/* eslint-disable @typescript-eslint/no-explicit-any */

export function getCapabilities(platform: Platform): any[] {
    if (platform === 'windows') {
        return [
            {
                platformName: 'windows',
                // NovaWindows: maintained UI Automation driver (WinAppDriver is no longer updated).
                'appium:automationName': 'NovaWindows',
                'appium:app': process.env.WINDOWS_APP_PATH,
                'appium:newCommandTimeout': 300
            }
        ];
    }

    return [
        {
            platformName: 'mac',
            'appium:automationName': 'Mac2',
            'appium:bundleId': process.env.MAC_BUNDLE_ID || 'com.aithinkers.ait-scribe',
            'appium:showServerLogs': true
        }
    ];
}
