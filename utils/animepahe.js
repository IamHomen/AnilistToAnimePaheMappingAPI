import axios from "axios";
import * as cheerio from "cheerio";
import Kwik from "../kwik.js";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const ANIMEPAHE_BASE_URL = "https://animepahe.ru";

// AnimePahe search
export async function searchAnimePahe(title) {
    const url = `${ANIMEPAHE_BASE_URL}/api?m=search&q=${encodeURIComponent(title)}`;
    const res = await axios.get(url, {
        headers: {
            "User-Agent": USER_AGENT,
            "Referer": ANIMEPAHE_BASE_URL,
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": "__ddg2_=; res=1080; aud=jpn;"
        }
    });
    return res.data.data;
}

// Get episode list from AnimePahe using session
export async function getEpisodeList(animeSession, page = 1) {
    const res = await axios.get(`${ANIMEPAHE_BASE_URL}/api?m=release&id=${animeSession}&sort=episode_asc&page=${page}`, {
        headers: {
            "User-Agent": USER_AGENT,
            "Referer": ANIMEPAHE_BASE_URL,
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": "__ddg2_=; res=1080; aud=jpn;"
        }
    });

    const pageInfo = {
        total: res.data.total,
        per_page: res.data.per_page,
        current_page: res.data.current_page,
        last_page: res.data.last_page,
    };

    const episodeList = res.data.data.map(data => ({
        episode: data.episode,
        session: data.session,
        snapshot: data.snapshot,
        created_at: data.created_at,
        duration: data.duration
    }));

    return { pageInfo, episodeList };
}

// Get stream sources
export async function getEpisodeSources(animeSession, session) {
    const url = `${ANIMEPAHE_BASE_URL}/play/${animeSession}/${session}`;
    const res = await axios.get(url, { headers: Headers(animeSession) });
    const $ = cheerio.load(res.data);

    const sources = [];

    const links = $("div#resolutionMenu > button")
        .map((_, el) => ({
            url: $(el).attr("data-src"),
            quality: $(el).text(),
            audio: $(el).attr("data-audio"),
        }))
        .get();

    for (const link of links) {
        const kwikResponse = await new Kwik().extract(new URL(link.url));
        if (kwikResponse.length > 0) {
            kwikResponse[0].quality = link.quality;
            kwikResponse[0].isDub = link.audio === "eng";
            sources.push(kwikResponse[0]);
        }
    }

    return sources;
}

// Custom headers
function Headers(sessionId) {
    return {
        authority: "animepahe.ru",
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-US,en;q=0.9",
        cookie: "__ddg2_=;",
        dnt: "1",
        "sec-ch-ua": '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
        referer: `${ANIMEPAHE_BASE_URL}/anime/${sessionId}`,
        "user-agent": USER_AGENT
    };
}