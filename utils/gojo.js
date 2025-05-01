import cloudscraper from 'cloudscraper';
import NodeCache from 'node-cache';

// Create a cache instance with a TTL of 1 hour (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

export async function getVideoSource(id, episode) {
  const url = `https://backend.gojo.wtf/api/anime/tiddies?provider=strix&id=${id}&num=${episode}&subType=sub&watchId=1&dub_id=null`;

  // Check if the response is cached
  const cacheKey = `videoSource-${id}-${episode}`;
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    console.log('Cache hit: Returning cached response');
    return cachedResponse;  // Return cached response
  }

  try {
    const json = await cloudscraper({
      method: 'GET',
      uri: url,
      encoding: 'utf8', // let cloudscraper handle decompression and convert to string
      json: true,       // auto-parses JSON
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'dnt': '1',
        'origin': 'https://gojo.wtf',
        'referer': 'https://gojo.wtf/',
        'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      }
    });

    if (!json) {
      throw new Error('Video source not found in response.');
    }

    // Cache the response
    cache.set(cacheKey, json);
    console.log('Cache miss: Caching the response');

    return json;
  } catch (err) {
    console.error('[Cloudscraper Error]', err.message);
    throw err;
  }
}
