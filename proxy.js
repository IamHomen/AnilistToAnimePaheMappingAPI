import axios from "axios";
import { ProxyConfig } from "./types.js"; // Ensure types.js is also ESM

class Proxy {
    /**
     * @param {ProxyConfig} [proxyConfig] - The proxy configuration (optional)
     * @param {Function} [adapter] - The Axios adapter (optional)
     */
    constructor(proxyConfig, adapter) {
        this.client = axios.create();
        this.validUrl = /^https?:\/\/.+/;

        if (proxyConfig) this.setProxy(proxyConfig);
        if (adapter) this.setAxiosAdapter(adapter);
    }

    /**
     * Set or change the proxy configuration
     * @param {ProxyConfig} proxyConfig - The proxy configuration
     */
    setProxy(proxyConfig) {
        if (!proxyConfig?.url) return;

        if (typeof proxyConfig.url === "string") {
            if (!this.validUrl.test(proxyConfig.url)) throw new Error("Proxy URL is invalid!");
        }

        if (Array.isArray(proxyConfig.url)) {
            for (const [i, url] of this.toMap(proxyConfig.url)) {
                if (!this.validUrl.test(url)) throw new Error(`Proxy URL at index ${i} is invalid!`);
            }
            this.rotateProxy({ ...proxyConfig, urls: proxyConfig.url });
            return;
        }

        this.client.interceptors.request.use((config) => {
            if (proxyConfig?.url) {
                config.headers["x-api-key"] = proxyConfig.key || "";
                config.url = `${proxyConfig.url}${config.url ? config.url : ""}`;
            }

            if (config?.url?.includes("anify")) config.headers["User-Agent"] = "consumet";

            return config;
        });
    }

    /**
     * Set or change the Axios adapter
     * @param {Function} adapter - The Axios adapter
     */
    setAxiosAdapter(adapter) {
        this.client.defaults.adapter = adapter;
    }

    /**
     * Rotate the proxy at a defined interval
     * @param {Object} proxy - Proxy configuration
     */
    rotateProxy(proxy) {
        setInterval(() => {
            const url = proxy.urls.shift();
            if (url) proxy.urls.push(url);
            this.setProxy({ url: proxy.urls[0], key: proxy.key });
        }, proxy.rotateInterval || 5000);
    }

    /**
     * Convert an array to a map-like structure
     * @param {Array} arr - Array to be converted
     * @returns {Array} - Array of key-value pairs
     */
    toMap(arr) {
        return arr.map((v, i) => [i, v]);
    }
}

export default Proxy;