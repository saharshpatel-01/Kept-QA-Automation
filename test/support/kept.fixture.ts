import { KeptMainPage } from '../../src/pages/kept.main.page';
import { logger } from '../../src/utils/logger';

/**
 * Launch Kept and return a ready page object. Shared by specs so setup lives
 * in one place instead of being duplicated in every `before` hook.
 */
export async function launchKept(): Promise<KeptMainPage> {
    const page = new KeptMainPage();
    await page.activate();
    await page.waitForPageLoad();
    logger.info('Kept launched and ready');
    return page;
}
