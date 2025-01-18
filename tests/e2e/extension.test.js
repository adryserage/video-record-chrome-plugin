const path = require('path');
const puppeteer = require('puppeteer');

describe('Screen Recorder Extension E2E', () => {
  let browser;
  let page;
  const extensionPath = path.join(__dirname, '../..');

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--allow-file-access-from-files',
      ],
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto('chrome://extensions');
  });

  afterEach(async () => {
    await page.close();
  });

  test('extension loads correctly', async () => {
    // Get the extension id
    const targets = await browser.targets();
    const extensionTarget = targets.find(
      (target) => target.type() === 'service_worker'
    );
    expect(extensionTarget).toBeTruthy();
  });

  test('popup opens and shows correct initial state', async () => {
    const extensionPopup = await getExtensionPopup(browser);
    
    // Check initial UI state
    const startButton = await extensionPopup.$('#startButton');
    const stopButton = await extensionPopup.$('#stopButton');
    const timer = await extensionPopup.$('#timer');
    
    expect(await startButton.evaluate(el => !el.disabled)).toBe(true);
    expect(await stopButton.evaluate(el => el.disabled)).toBe(true);
    expect(await timer.evaluate(el => el.textContent)).toBe('00:00:00');
  });

  test('quality selector changes work', async () => {
    const extensionPopup = await getExtensionPopup(browser);
    
    // Change quality
    await extensionPopup.select('#qualitySelector', '4k');
    
    // Verify storage was updated
    const storage = await extensionPopup.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.local.get('settings', resolve);
      });
    });
    
    expect(storage.settings.quality).toBe('4k');
  });
});

async function getExtensionPopup(browser) {
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    (target) => target.type() === 'service_worker'
  );
  const extensionUrl = extensionTarget.url();
  const [,, extensionID] = extensionUrl.split('/');

  const extensionPopup = await browser.newPage();
  await extensionPopup.goto(
    `chrome-extension://${extensionID}/popup.html`
  );
  
  return extensionPopup;
}
