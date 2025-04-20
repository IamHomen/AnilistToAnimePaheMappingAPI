import VideoExtractor from './video-extractor.js';

class Kwik extends VideoExtractor {
  constructor() {
    super();
    this.serverName = 'kwik';
    this.sources = [];
    this.host = 'https://animepahe.ru/';
  }

  async extract(videoUrl) {
    try {
      const response = await fetch(`${videoUrl.href}`, {
        headers: { Referer: this.host },
      });
      
      const data = await response.text();
      
      const match = /(eval)(\(f.*?)(\n<\/script>)/s.exec(data);
      if (!match) throw new Error('No valid source found');
      
      const source = eval(match[2].replace('eval', '')).match(/https.*?m3u8/);
      if (!source) throw new Error('No M3U8 URL found');
      
      this.sources.push({
        url: source[0],
        isM3U8: source[0].includes('.m3u8'),
      });

      return this.sources;
    } catch (err) {
      throw new Error(err.message);
    }
  }
}

export default Kwik;