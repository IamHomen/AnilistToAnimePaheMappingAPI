import puppeteer from 'puppeteer';

export async function getVideoSource(id, episode) {
  const url = `https://gojo.wtf/watch/${id}/?provider=strix&ep=${episode}`;
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 0 });

    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector('video.art-video');
      return video ? video.src : null;
    });

    await browser.close();

    if (!videoSrc) {
      throw new Error('Video source not found after full render');
    }

    return videoSrc;
  } catch (err) {
    await browser.close();
    console.error(`[Gojo] Puppeteer Error: ${err.message}`);
    throw err;
  }
}
