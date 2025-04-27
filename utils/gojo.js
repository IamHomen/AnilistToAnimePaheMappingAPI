import puppeteer from 'puppeteer';

export async function getVideoSource(id, episode) {
  const url = `https://gojo.wtf/watch/${id}/?provider=strix&ep=${episode}`;

  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector('video.art-video');
      return video?.src || null;
    });

    if (!videoSrc) {
      throw new Error('Video source not found.');
    }

    return videoSrc;
  } catch (err) {
    console.error('[Puppeteer Error]', err);
    throw err;
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}