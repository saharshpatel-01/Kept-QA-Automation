/**
 * Centralised test data. Keeps prompts/markers/expected values out of specs so
 * they can be reused and maintained in one place.
 */

export const markers = {
    echo: 'KEPT_QA_OK_42'
} as const;

export const prompts = {
    echoMarker: (marker: string): string =>
        `This is an automated QA test. Reply with exactly: ${marker}`,
    simpleMath: 'Reply with only the number that is the sum of 2 and 2.',
    capitalOfFrance: 'What is the capital of France?',
    followUpPopulation: 'What is its population?'
} as const;

export const expected = {
    simpleMathAnswer: '4',
    capitalOfFrance: 'paris'
} as const;
