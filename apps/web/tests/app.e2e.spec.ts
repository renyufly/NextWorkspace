import { expect, test } from '@playwright/test';

function workspaceHeading(page: import('@playwright/test').Page, name: string) {
  return page.locator('.conversation-header h2', { hasText: name });
}

test.describe('WorkNext web flows', () => {
  test('registers, switches workspaces, creates a channel, and sends a message', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const ownerEmail = `owner-${suffix}@example.com`;
    const workspaceName = `Workspace ${suffix}`;
    const channelName = `focus-${suffix}`;
    const messageBody = `Hello from browser ${suffix}`;

    await registerUser(page, {
      email: ownerEmail,
      displayName: `Owner ${suffix}`,
      password: 'password123',
    });

    await page.getByTestId('create-workspace-input').fill(workspaceName);
    await page.getByTestId('create-workspace-button').click();
    await selectWorkspace(page, workspaceName);

    await page.getByTestId('create-channel-name-input').fill(channelName);
    await page.getByTestId('create-channel-description-input').fill('Channel created by Playwright');
    await page.getByTestId('create-channel-button').click();
    await expect(page.getByTestId('channel-item').filter({ hasText: `#${channelName}` })).toBeVisible();

    await page.getByTestId('composer-input').fill(messageBody);
    await page.getByTestId('send-message-button').click();
    await expect(page.getByTestId('message-card').last()).toContainText(messageBody);
  });

  test('accepts an invitation and reads a mention notification', async ({ browser }) => {
    const suffix = `${Date.now().toString(36)}-invite`;
    const ownerEmail = `owner-${suffix}@example.com`;
    const memberEmail = `member-${suffix}@example.com`;
    const memberDisplayName = `Member ${suffix}`;
    const memberAlias = memberEmail.split('@')[0] ?? 'member';
    const workspaceName = `Invite Workspace ${suffix}`;
    const channelName = `leaders-${suffix}`;

    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();

    await registerUser(ownerPage, {
      email: ownerEmail,
      displayName: `Owner ${suffix}`,
      password: 'password123',
    });

    await registerUser(memberPage, {
      email: memberEmail,
      displayName: memberDisplayName,
      password: 'password123',
    });

    await ownerPage.getByTestId('create-workspace-input').fill(workspaceName);
    await ownerPage.getByTestId('create-workspace-button').click();
    await selectWorkspace(ownerPage, workspaceName);

    await openWorkspaceSettings(ownerPage);
    await expect(ownerPage.getByTestId('invite-email-input')).toBeVisible();
    await ownerPage.getByTestId('invite-email-input').fill(memberEmail);
    await ownerPage.getByTestId('create-invite-button').click();

    const invitationToken = await ownerPage.getByTestId('invitation-token').first().textContent();
    expect(invitationToken).toBeTruthy();

    await memberPage.getByTestId('accept-invitation-input').fill(invitationToken ?? '');
    await memberPage.getByTestId('accept-invitation-button').click();
    await memberPage.reload();
    await expect(workspaceHeading(memberPage, workspaceName)).toBeVisible();

    await ownerPage.reload();
    await expect(workspaceHeading(ownerPage, workspaceName)).toBeVisible();

    await ownerPage.getByTestId('create-channel-name-input').fill(channelName);
    await ownerPage.getByTestId('create-channel-description-input').fill('Private room');
    await ownerPage.getByTestId('create-channel-type-select').selectOption('PRIVATE');
    await ownerPage.getByTestId('create-channel-button').click();
    await expect(ownerPage.getByTestId('channel-item').filter({ hasText: `#${channelName}` })).toBeVisible();

    await ownerPage.getByTestId('channel-item').filter({ hasText: `#${channelName}` }).click();
    await openWorkspaceSettings(ownerPage);
    await expect(ownerPage.getByTestId('channel-member-select')).toBeVisible();
    await ownerPage.getByTestId('channel-member-select').selectOption({ label: `${memberDisplayName} (${memberEmail})` });
    await ownerPage.getByTestId('add-channel-member-button').click();

    await ownerPage.keyboard.press('Escape');
    await ownerPage.getByTestId('composer-input').fill(`Hello @${memberAlias}`);
    await ownerPage.getByTestId('send-message-button').click();

    await memberPage.reload();
    await expect(workspaceHeading(memberPage, workspaceName)).toBeVisible();
    await memberPage.getByTestId('channel-item').filter({ hasText: `#${channelName}` }).click();
    await openWorkspaceSettings(memberPage);
    await expect(memberPage.getByTestId('notification-card-unread').first()).toContainText('mentioned you');

    await memberPage.getByTestId('notification-card-unread').first().click({ force: true });
    await expect(memberPage.getByTestId('message-card').last()).toContainText(`Hello @${memberAlias}`);

    await ownerContext.close();
    await memberContext.close();
  });
});

async function registerUser(
  page: import('@playwright/test').Page,
  user: { email: string; displayName: string; password: string },
) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByTestId('auth-email-input').fill(user.email);
  await page.getByTestId('auth-display-name-input').fill(user.displayName);
  await page.getByTestId('auth-password-input').fill(user.password);
  await page.getByTestId('auth-submit-button').click();
  await expect(page.getByText(/Signed in as/i)).toContainText(user.displayName);
}

async function selectWorkspace(page: import('@playwright/test').Page, name: string) {
  const heading = workspaceHeading(page, name);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await heading.isVisible().catch(() => false)) {
      return;
    }

    const item = page.getByTestId('workspace-item').filter({ hasText: name }).first();
    await expect(item).toBeVisible();

    try {
      await item.click();
      await expect(heading).toBeVisible({ timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }

      await page.waitForTimeout(250);
    }
  }
}

async function openWorkspaceSettings(page: import('@playwright/test').Page) {
  const trigger = page.getByTestId('workspace-settings-trigger');
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await expect(page.locator('.workspace-settings-drawer.open')).toBeVisible();
}