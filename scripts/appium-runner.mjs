#!/usr/bin/env node
/**
 * One-command test runner: ensures an Appium server is available (starting one
 * if needed), runs WebdriverIO against it, then tears down anything it started.
 * Avoids the flaky @wdio/appium-service by managing Appium explicitly.
 *
 * Usage: node scripts/appium-runner.mjs [wdio args...]
 *   e.g. node scripts/appium-runner.mjs --suite smoke
 */
import { spawn } from 'node:child_process';
import http from 'node:http';

const HOST = process.env.APPIUM_HOST || '127.0.0.1';
const PORT = Number(process.env.APPIUM_PORT) || 4723;
const STATUS_URL = `http://${HOST}:${PORT}/status`;

function ping(url) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            res.resume();
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1500, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function waitForAppium(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await ping(STATUS_URL)) return true;
        await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
}

function run(cmd, args, opts = {}) {
    return spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
}

async function main() {
    const wdioArgs = process.argv.slice(2);
    let appium = null;

    const alreadyUp = await ping(STATUS_URL);
    if (alreadyUp) {
        console.log(`[runner] Reusing Appium already running on ${HOST}:${PORT}`);
    } else {
        console.log(`[runner] Starting Appium on ${HOST}:${PORT}...`);
        appium = run('appium', [
            '--base-path', '/',
            '--relaxed-security',
            '--address', HOST,
            '--port', String(PORT),
        ]);
        appium.on('error', (e) => {
            console.error(`[runner] Failed to start Appium: ${e.message}`);
            console.error('[runner] Is Appium installed? See README setup.');
            process.exit(1);
        });
        if (!(await waitForAppium(60000))) {
            console.error('[runner] Appium did not become ready in time.');
            appium?.kill('SIGTERM');
            process.exit(1);
        }
        console.log('[runner] Appium is ready.');
    }

    const wdio = run('npx', ['wdio', 'run', './wdio.conf.ts', ...wdioArgs], {
        env: { ...process.env, EXTERNAL_APPIUM: 'true' },
    });

    const cleanup = () => {
        if (appium && !appium.killed) {
            console.log('[runner] Stopping Appium...');
            appium.kill('SIGTERM');
        }
    };
    process.on('SIGINT', () => { cleanup(); process.exit(130); });

    wdio.on('exit', (code) => {
        cleanup();
        process.exit(code ?? 1);
    });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
