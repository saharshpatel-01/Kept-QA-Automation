import { existsSync, readFileSync } from 'node:fs';

/**
 * Test titles carry the test case ID in square brackets, e.g.
 *   it('[AIT-WIN-313] Profile shows Name, Email, Workspace', ...)
 * The ID can be a sheet ID (AIT-WIN-313) or a Zephyr key (KEPT-T123).
 * Sheet IDs are mapped to Zephyr keys through config/zephyr-map.json.
 */
const ID_RE = /\[([A-Z][A-Z0-9]*-(?:[A-Z]+-)?T?\d+)\]/;
const ZEPHYR_KEY_RE = /^[A-Z][A-Z0-9]*-T\d+$/;

let map: Record<string, string> | null = null;

function zephyrMap(): Record<string, string> {
    if (map) return map;
    const path = './config/zephyr-map.json';
    map = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    return map as Record<string, string>;
}

/** The case ID written in the test title, or null. */
export function caseIdFromTitle(title: string): string | null {
    return title.match(ID_RE)?.[1] ?? null;
}

/** The Zephyr test case key for a test title, or null when it has none. */
export function zephyrKeyFromTitle(title: string): string | null {
    const id = caseIdFromTitle(title);
    if (!id) return null;
    if (ZEPHYR_KEY_RE.test(id)) return id;
    return zephyrMap()[id] ?? null;
}
