/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
    use: {
      headless: true,
      viewport: { width: 1280, height: 720 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      locale: 'en-US',
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
      screenshot: 'off',
      video: 'off',
      permissions: [],
    },
    timeout: 30000, // 30 seconds per test (adjust if needed)
    retries: 0,
    reporter: 'dot',
    workers: 1, // only 1 worker (important for Vercel serverless)
  };
  
  export default config;  