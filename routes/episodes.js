import express from 'express';
import axios from "axios";
import puppeteer from 'puppeteer';
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

// /list/:anilistId
router.get('/list/:anilistId', async (req, res) => {
  const { anilistId } = req.params;
  let browser, page;

  try {
    // 1. Fetch title from AniList
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
      variables: { id: parseInt(anilistId) },
    };

    const anilistResponse = await axios.post('https://graphql.anilist.co', graphqlQuery);
    const titles = anilistResponse.data.data.Media.title;
    const title = titles.romaji || titles.english || titles.native;
    console.log(`[AniList] Title: ${title}`);

    // 2. Launch Puppeteer to pass DDOS-Guard
    browser = await puppeteer.launch({
      headless: 'new', // or just true if using old versions
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    page = await browser.newPage();

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1280, height: 800 });

    console.log('[AnimePahe] Visiting homepage to pass DDOS-Guard...');
    await page.goto('https://animepahe.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 4000));

    // 👇 GET COOKIES dynamically
    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // 4. Now fetch search results directly via API
    const searchUrl = `https://animepahe.ru/api?m=search&q=${encodeURIComponent(title)}`;
    console.log(`[AnimePahe] Searching via API: ${searchUrl}`);

    const searchResponse = await axios.get(searchUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Cookie": cookieString,
        "Referer": ANIMEPAHE_BASE_URL,
        "Accept-Language": "en-US,en;q=0.9",
      }
    });

    const searchData = searchResponse.data.data;
    if (!searchData || searchData.length === 0) {
      throw new Error('No results found for this anime.');
    }

    const firstAnime = searchData[0];
    const { session, title: animepaheTitle } = firstAnime;

    console.log(`[AnimePahe] Found: ${animepaheTitle}, Session ID: ${session}`);

    // 5. Fetch episode list
    const episodesResponse = await axios.get(
      `https://animepahe.ru/api?m=release&id=${session}&sort=episode_asc&page=1`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Cookie": cookieString, 
          "Referer": ANIMEPAHE_BASE_URL, 
          "Accept-Language": "en-US,en;q=0.9",
        }
      }
    );

    const episodes = episodesResponse.data.data;
    const current_page = episodesResponse.data.current_page;
    const last_page = episodesResponse.data.last_page;

    // 6. Return JSON
    res.json({
      animeTitle: title,
      animepaheTitle,
      animepaheSessionId: session,
      current_page,
      last_page,
      episodes,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

export default router;
