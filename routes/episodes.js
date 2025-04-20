import * as cheerio from "cheerio";
import { getAniListTitle } from '../utils/anilist.js';
import { searchAnimePahe, getEpisodeList, getEpisodeSources } from '../utils/animepahe.js';
import express from 'express';

const router = express.Router();

// Endpoint to get episodes
router.get("/:anilistId", async (req, res) => {
  try {
    const anilistId = parseInt(req.params.anilistId);
    const title = await getAniListTitle(anilistId);
    const results = await searchAnimePahe(title);

    if (!results.length) return res.status(404).json({ error: "Anime not found on AnimePahe" });

    const match = results.find(a => a.title.toLowerCase() === title.toLowerCase()) || results[0];
    const episodes = await getEpisodeList(match.session);

    res.json({
      anilistId,
      title,
      animepaheId: match.id,
      animepaheTitle: match.title,
      animepaheSession: match.session,
      episodes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Endpoint to get episode sources
router.get("/sources/:animeSession/:session", async (req, res) => {
  try {
    const { animeSession, session } = req.params;
    const sources = await getEpisodeSources(animeSession, session);
    res.json({ animeSession, session, sources });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get episode sources" });
  }
});

export default router;  // Use export default for ES modules
