import { test, expect, type Page } from '@playwright/test';

async function openSoundCheck(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tune in' }).click();
  await expect(page.getByRole('heading', { name: /Sound Check/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Broadcast' })).toBeEnabled();
}

test('title and sound check load', async ({ page }) => {
  await openSoundCheck(page);
});

test('the prologue keeps Start Broadcast disabled until it finishes', async ({ page }) => {
  await openSoundCheck(page);
  await page.getByRole('button', { name: 'Listen to Prologue' }).click();
  await expect(page.getByRole('button', { name: 'Start Broadcast' })).toBeDisabled();
});

test('Start Broadcast presents question one and starts its timer', async ({ page }) => {
  await openSoundCheck(page);
  await page.getByRole('button', { name: 'Start Broadcast' }).click();
  await expect(page.getByText('Question 1 of 5')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Answer input' })).toBeVisible();
  await expect(page.getByText(/Time: [1-5]s/)).toBeVisible();
});

test('pause preserves the answer window and leave cancels pending work', async ({ page }) => {
  test.setTimeout(30000);
  await openSoundCheck(page);
  await page.getByRole('button', { name: 'Start Broadcast' }).click();
  await expect(page.getByRole('textbox', { name: 'Answer input' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.waitForTimeout(5500);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('textbox', { name: 'Answer input' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Answer input' }).fill('Blue');
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Leave station' }).click();
  await expect(page.getByRole('heading', { name: 'THE LAST BROADCAST' })).toBeVisible();
  await page.waitForTimeout(3200);
  await expect(page.getByRole('heading', { name: 'THE LAST BROADCAST' })).toBeVisible();
});

test('pause stops speech and resume restarts it before leaving', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const events: string[] = [];
    (window as any).__audioEvents = events;
    (window as any).Audio = class extends NativeAudio {
      play(): Promise<void> {
        events.push(`${this.src}:play`);
        return Promise.resolve();
      }
      pause(): void {
        events.push(`${this.src}:pause`);
        super.pause();
      }
    };
  });
  await page.route('**/api/speech', route => route.fulfill({ json: { status: 'ready', audioId: 'test-voice' } }));
  await page.route('**/api/audio/test-voice*', route => route.fulfill({ path: 'apps/web/public/audio/station-bed.wav', contentType: 'audio/wav' }));
  await page.goto('/#token=abc123');
  await page.getByRole('button', { name: 'Tune in' }).click();
  await expect(page.getByRole('button', { name: 'Start Broadcast' })).toBeEnabled();
  await page.getByRole('button', { name: 'Start Broadcast' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__audioEvents.filter((event: string) => event.includes('/api/audio/') && event.endsWith(':play')).length)).toBe(1);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__audioEvents.filter((event: string) => event.includes('/api/audio/') && event.endsWith(':pause')).length)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__audioEvents.filter((event: string) => event.includes('/api/audio/') && event.endsWith(':play')).length)).toBe(2);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Leave station' }).click();
  await expect(page.getByRole('heading', { name: 'THE LAST BROADCAST' })).toBeVisible();
});

test('five answers lead through the performed ending to receipt and post-credits', async ({ page }) => {
  test.setTimeout(120000);
  await openSoundCheck(page);
  await page.getByRole('button', { name: 'Start Broadcast' }).click();
  for (let round = 1; round <= 5; round++) {
    await expect(page.getByText(`Question ${round} of 5`)).toBeVisible({ timeout: 15000 });
    const answer = page.getByRole('textbox', { name: 'Answer input' });
    await expect(answer).toBeVisible({ timeout: 15000 });
    await answer.fill(`Answer ${round}`);
    await page.getByRole('button', { name: 'Submit' }).click();
  }
  await expect(page.getByText('That is our time. Please remain on the line while the line ceases to exist.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Transmission Receipt' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Your feedback is important to us/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Answers submitted: 5')).toBeVisible();
});
