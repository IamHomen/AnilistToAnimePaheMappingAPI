import express from 'express';
import axios from "axios";
import cors from 'cors';
import cloudscraper from 'cloudscraper';
import { createClient } from 'redis';
import { getAniListTitle } from '../utils/anilist.js';
import { getVideoSource } from '../utils/gojo.js';
import { searchAnimePahe, getEpisodeList, getEpisodeSources } from '../utils/animepahe.js';

// Constants
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
const ANIMEPAHE_BASE_URL = "https://animepahe.ru/";

const redisClient = createClient({
  username: 'default',
  password: '1r2L61UWpkt2JVoB2TQq6tVw0ojoHHRK',
  socket: {
    host: 'redis-18114.c14.us-east-1-2.ec2.redns.redis-cloud.com',
    port: 18114
  }
});

redisClient.on('error', (err) => console.error('Redis error:', err));

// Ensure Redis is connected before handling any requests
await redisClient.connect();

const router = express.Router();
// Enable CORS
router.use(cors());

// ✅ Endpoint to get episodes (with pagination)
router.get("/:anilistId", async (req, res) => {
  try {
    const anilistId = parseInt(req.params.anilistId);
    const page = parseInt(req.query.page || "1");
    const cacheKey = `episodes:${anilistId}:${page}`;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const title = await getAniListTitle(anilistId);
    const results = await searchAnimePahe(title);

    if (!results.length) {
      return res.status(404).json({ error: "Anime not found on AnimePahe" });
    }

    const match = results.find(a => a.title.toLowerCase() === title.toLowerCase()) || results[0];
    const { episodeList, pageInfo } = await getEpisodeList(match.session, page);

    const response = {
      anilistId,
      title,
      animepaheId: match.id,
      animepaheTitle: match.title,
      animepaheSession: match.session,
      pageInfo,
      episodeList
    };

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Endpoint to get episode sources (AnimePahe)
router.get("/sources/:animeSession/:session", async (req, res) => {
  try {
    const { animeSession, session } = req.params;
    const cacheKey = `sources:${animeSession}:${session}`;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const sources = await getEpisodeSources(animeSession, session);
    const response = { animeSession, session, sources };

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get episode sources" });
  }
});

// ✅ Endpoint to get Gojo sources
router.get("/sources/gojo/:id/:episode", async (req, res) => {
  try {
    const { id, episode } = req.params;
    const cacheKey = `gojo-source:${id}:${episode}`;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const source = await getVideoSource(id, episode);
    const response = { source };

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get Gojo episode source" });
  }
});

// Build the cookie string
const cookieHeader = [
  "laravel_session=eyJpdiI6ImhNQklDdkd2bWIyYWVMS2NJWkNzbUE9PSIsInZhbHVlIjoiQT...",
  "XSRF-TOKEN=eyJpdiI6IitCS2xqL1FMaENIaW5YM3FMTndmOEE9PSIsInZhbHVlIjoibE9n...",
  "__ddg10_=1745741200",
  "__ddg8_=kxr4LYS3MOgUV8Iv",
  "__ddg1_=xxmRlqo1ERLAD6RSumxm",
  "__ddgmark_=JiVXMVVkVisDFhoa",
  "__ddg2_=YDB2egmGQxqITOkJ",
  "__ddg9_=174.140.209.19",
  "__ddgid_=mTEyysdtXBKK3LoA"
].join('; ');

// Helper to mimic a browser AND solve basic DDoS-Guard challenges
async function fetchWithCloudscraper(url) {
  try {
    const body = await cloudscraper.get({
      uri: url,
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://animepahe.ru/',
        'Origin': 'https://animepahe.ru',
      },
      json: true, // Automatically parses JSON
      timeout: 15000,
    });

    return body;
  } catch (error) {
    console.error('Cloudscraper fetch error:', error.message);
    throw error;
  }
}

// 🔥 Optimized /list/:anilistId route without puppeteer
router.get('/list/:anilistId', async (req, res) => {
  const { anilistId } = req.params;
  const cacheKey = `animepahe:list:${anilistId}`;

  try {
    // Check Redis first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log('Cache hit');
      return res.json(JSON.parse(cached));
    }

    // 1. Get title from AniList
    const graphqlQuery = {
      query: `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            title {
              romaji
              english
              native
            }
          }
        }
      `,
      variables: { id: parseInt(anilistId) }
    };

    const anilistResponse = await axios.post('https://graphql.anilist.co', graphqlQuery);
    const titles = anilistResponse.data.data.Media.title;
    const title = titles.romaji || titles.english || titles.native;

    // 2. Search Animepahe without Puppeteer
    const searchUrl = `https://animepahe.ru/api?m=search&q=${encodeURIComponent(title)}`;
    const searchResponse = await fetchWithCloudscraper(searchUrl);

    if (!searchResponse.data.length) {
      return res.status(404).json({ error: 'Anime not found on AnimePahe' });
    }

    const bestMatch = searchResponse.data[0];
    const animepaheId = bestMatch.session;

    // 3. Get episodes list
    const releaseUrl = `https://animepahe.ru/api?m=release&id=${animepaheId}`;
    const episodesResponse = await fetchWithCloudscraper(releaseUrl);
    const episodes = episodesResponse.data;

    const response = {
      animeTitle: title,
      animepaheId,
      anilistId,
      episodes
    };

    // Save to Redis (1 hour)
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));

    res.json(response);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch episode list.' });
  }
});

export default router;