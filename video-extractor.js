import Proxy from "./proxy.js";

class VideoExtractor extends Proxy {
    /**
     * @param {string} serverName - The server name of the video provider
     */
    constructor(serverName) {
        super();
        this.serverName = serverName;
        this.sources = [];
    }

    /**
     * Extract video sources from a given URL
     * @param {URL} videoUrl - The video URL
     * @param {...any} args - Additional arguments
     * @returns {Promise<Array>} - Returns an array of video sources
     */
    async extract(videoUrl, ...args) {
        throw new Error("extract() must be implemented by subclasses");
    }
}

export default VideoExtractor; // ✅ Use ESM export