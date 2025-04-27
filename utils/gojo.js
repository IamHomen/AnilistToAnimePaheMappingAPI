import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

export async function getVideoSource(id, episode) {
  const url = `https://gojo.wtf/watch/${id}/?provider=strix&ep=${episode}`;

  const options = new chrome.Options();
  options.addArguments('--headless'); // run headless
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    await driver.get(url);

    // Wait for the video element to be available
    const video = await driver.wait(
      until.elementLocated(By.css('video.art-video')),
      60000
    );

    const videoSrc = await video.getAttribute('src');

    if (!videoSrc) {
      throw new Error('Video source not found.');
    }

    return videoSrc;
  } catch (err) {
    console.error('[Selenium Error]', err);
    throw err;
  } finally {
    await driver.quit();
  }
}
