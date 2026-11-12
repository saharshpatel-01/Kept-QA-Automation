/**
 * Step recorder: tests call step('...') so that, if the test fails, the Jira bug
 * gets real "Steps to Reproduce" instead of a stack trace. Reset before each test.
 */
const steps: string[] = [];

export function step(text: string): void {
    steps.push(text);
}

export function resetSteps(): void {
    steps.length = 0;
}

export function getSteps(): string[] {
    return [...steps];
}
