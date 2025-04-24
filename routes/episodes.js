import express from 'express';
import { createClient } from 'redis';
import { getAniListTitle } from '../utils/anilist.js';
import { getVideoSource } from '../utils/gojo.js';
import { searchAnimePahe, getEpisodeList, getEpisodeSources } from '../utils/animepahe.js';

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

export default router;
