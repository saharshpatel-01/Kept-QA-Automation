import { execFileSync } from 'node:child_process';
import { logger } from './logger';

/**
 * Native macOS Accessibility (AX) interaction layer for Kept.
 *
 * Appium Mac2 / WebDriverAgentMac synthetic input (click/setValue/keys) crashes
 * with SIGABRT on this host (macOS 26 + Xcode 27 SkyLight assert — see README
 * "Known Limitations"). Driving the app through `osascript` + System Events does
 * NOT go through XCUITest event synthesis, so it works reliably. We use this for
 * interaction (navigation, clicks, typing) and keep Appium strictly read-only
 * for assertions.
 *
 * Sidebar destinations are identified by their AX `help` (tooltip) attribute —
 * their `description`/`title` are empty on this build.
 */

const PROCESS = 'Kept';

/** Sidebar / top-bar destinations addressable by their AX `help` attribute. */
export const Screen = {
    Assistant: 'AI Assistant',
    Meetings: 'Meetings',
    SpeechToText: 'Speech to Text',
    Vocabulary: 'Vocabulary',
    Tasks: 'Tasks',
    Insights: 'Insights',
    Feedback: 'Feedback'
} as const;

export type ScreenName = (typeof Screen)[keyof typeof Screen];

function osascript(script: string, timeoutMs = 15000): string {
    try {
        const out = execFileSync('osascript', ['-e', script], {
            timeout: timeoutMs,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        return out.trim();
    } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        throw new Error(`osascript failed: ${message}`);
    }
}

/** Run a multi-line AppleScript (one `-e` per line) and return trimmed stdout. */
function osascriptLines(lines: string[], timeoutMs = 30000): string {
    const args: string[] = [];
    for (const line of lines) {
        args.push('-e', line);
    }
    try {
        return execFileSync('osascript', args, {
            timeout: timeoutMs,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        }).trim();
    } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        throw new Error(`osascript failed: ${message}`);
    }
}

/** Escape a string for safe interpolation inside an AppleScript string literal. */
function escapeForAppleScript(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Bring the Kept window to the front so AX actions target the right process. */
export function activateKept(): void {
    osascript(`tell application "${PROCESS}" to activate`);
}

/**
 * Click the first sidebar button whose AX `help` matches `helpLabel`.
 * Retries briefly to ride out transient AX errors (-1728/-1700).
 */
export function clickByHelp(helpLabel: string, retries = 3): void {
    const script =
        `tell application "System Events" to tell process "${PROCESS}" ` +
        `to click (first button of group 1 of front window whose help is "${helpLabel}")`;

    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            osascript(script);
            return;
        } catch (error) {
            lastError = error;
            // brief backoff before retrying a transient AX failure
            try {
                execFileSync('sleep', ['0.5']);
            } catch {
                // ignore
            }
        }
    }
    throw new Error(
        `clickByHelp("${helpLabel}") failed after ${retries} attempts: ` +
            (lastError instanceof Error ? lastError.message : String(lastError))
    );
}

/** Navigate to a Kept screen and give it time to render before asserting. */
export function navigateTo(screen: ScreenName): void {
    // Make sure a window exists (app may have launched window-less) before
    // trying to click a sidebar button, otherwise `front window` fails.
    ensureKeptWindow();
    clickByHelp(screen);
    logger.info(`[native-nav] navigated to "${screen}"`);
}

/**
 * Read every button's AX `help` label on the current front window. Useful to
 * confirm the sidebar is present regardless of which screen is active.
 */
export function getSidebarHelpLabels(): string[] {
    const script =
        `tell application "System Events" to tell process "${PROCESS}" ` +
        `to get help of every button of group 1 of front window`;
    try {
        const raw = osascript(script);
        return raw
            .split(',')
            .map(s => s.trim())
            .filter(s => s && s !== 'missing value');
    } catch {
        return [];
    }
}

/**
 * Ensure Kept has a front window. The app can run window-less (all windows
 * closed) — `reopen` recreates the main window exactly like clicking the Dock
 * icon. Returns true once a window is present.
 */
export function ensureKeptWindow(retries = 25): boolean {
    const lines = [
        `tell application "${PROCESS}" to reopen`,
        'delay 0.3',
        `tell application "${PROCESS}" to activate`,
        'delay 0.4',
        `tell application "System Events" to tell process "${PROCESS}"`,
        `  repeat ${retries} times`,
        '    if (count of windows) > 0 then return "OK"',
        '    delay 0.3',
        '  end repeat',
        '  return "NO_WINDOW"',
        'end tell'
    ];
    try {
        return osascriptLines(lines) === 'OK';
    } catch {
        return false;
    }
}

export type SendResult = 'SENT' | 'NO_WINDOW' | 'NO_TA' | 'NO_SEND' | 'SEND_DISABLED';

/**
 * Send a message to the AI Assistant chat via pure Accessibility actions.
 *
 * This deliberately avoids XCUITest/CGEvent synthetic input (which crashes
 * WebDriverAgentMac on macOS 26 / Xcode 27). Instead it writes the text area's
 * AXValue and performs AXPress on the Send button — the same AX API family that
 * drives navigation. One atomic AppleScript avoids window-availability races.
 */
function sendChatMessageOnce(message: string): SendResult {
    const lines = [
        `tell application "${PROCESS}" to reopen`,
        'delay 0.3',
        `tell application "${PROCESS}" to activate`,
        'delay 0.4',
        `tell application "System Events" to tell process "${PROCESS}"`,
        '  set ok to false',
        '  repeat 25 times',
        '    if (count of windows) > 0 then',
        '      set ok to true',
        '      exit repeat',
        '    end if',
        '    delay 0.3',
        '  end repeat',
        '  if not ok then return "NO_WINDOW"',
        '  set theWin to front window',
        '  set q to {theWin}',
        '  set ta to missing value',
        '  repeat while (count of q) > 0 and ta is missing value',
        '    set el to item 1 of q',
        '    set q to rest of q',
        '    try',
        '      if role of el is "AXTextArea" then',
        '        set ta to el',
        '      else',
        '        set q to q & (UI elements of el)',
        '      end if',
        '    end try',
        '  end repeat',
        '  if ta is missing value then return "NO_TA"',
        '  set focused of ta to true',
        `  set value of ta to "${escapeForAppleScript(message)}"`,
        '  delay 0.4',
        '  set q to {theWin}',
        '  set b to missing value',
        '  repeat while (count of q) > 0 and b is missing value',
        '    set el to item 1 of q',
        '    set q to rest of q',
        '    try',
        '      if role of el is "AXButton" and (value of attribute "AXIdentifier" of el) is "arrow.up" then',
        '        set b to el',
        '      else',
        '        set q to q & (UI elements of el)',
        '      end if',
        '    end try',
        '  end repeat',
        '  if b is missing value then return "NO_SEND"',
        '  if (enabled of b) is false then return "SEND_DISABLED"',
        '  perform action "AXPress" of b',
        '  return "SENT"',
        'end tell'
    ];
    const result = osascriptLines(lines);
    return (result as SendResult) ?? 'NO_WINDOW';
}

/**
 * Send a chat message, retrying on any transient failure. The osascript AX
 * actions can intermittently fail mid-conversation (SEND_DISABLED/NO_SEND/NO_TA)
 * when Appium is polling the same tree; re-asserting the Assistant screen and
 * retrying clears it. Up to 3 attempts with a short backoff.
 */
export function sendChatMessage(message: string): SendResult {
    let result: SendResult = 'NO_WINDOW';
    for (let attempt = 1; attempt <= 3; attempt++) {
        result = sendChatMessageOnce(message);
        if (result === 'SENT') break;

        // Re-assert a clean Assistant screen before the next attempt.
        try {
            ensureKeptWindow();
            clickByHelp(Screen.Assistant);
        } catch {
            // best-effort; retry regardless
        }
        try {
            execFileSync('sleep', ['1']);
        } catch {
            // ignore
        }
    }
    logger.info(`[native-nav] sendChatMessage -> ${result}`);
    return result;
}

export type SearchResult = 'SEARCHED' | 'NO_WINDOW' | 'NO_FIELD';

/**
 * Type into the "Search conversations" box via pure Accessibility actions.
 * The assistant sidebar exposes a single AXTextField (the search box); we set
 * its AXValue directly, same crash-safe approach used for the chat input.
 */
export function searchConversations(query: string): SearchResult {
    const lines = [
        `tell application "${PROCESS}" to reopen`,
        'delay 0.3',
        `tell application "${PROCESS}" to activate`,
        'delay 0.4',
        `tell application "System Events" to tell process "${PROCESS}"`,
        '  set ok to false',
        '  repeat 25 times',
        '    if (count of windows) > 0 then',
        '      set ok to true',
        '      exit repeat',
        '    end if',
        '    delay 0.3',
        '  end repeat',
        '  if not ok then return "NO_WINDOW"',
        '  set theWin to front window',
        '  set q to {theWin}',
        '  set tf to missing value',
        '  repeat while (count of q) > 0 and tf is missing value',
        '    set el to item 1 of q',
        '    set q to rest of q',
        '    try',
        '      if role of el is "AXTextField" then',
        '        set tf to el',
        '      else',
        '        set q to q & (UI elements of el)',
        '      end if',
        '    end try',
        '  end repeat',
        '  if tf is missing value then return "NO_FIELD"',
        '  set focused of tf to true',
        `  set value of tf to "${escapeForAppleScript(query)}"`,
        '  return "SEARCHED"',
        'end tell'
    ];
    const result = (osascriptLines(lines) as SearchResult) ?? 'NO_WINDOW';
    logger.info(`[native-nav] searchConversations -> ${result}`);
    return result;
}
