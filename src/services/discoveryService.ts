
import { DiscoverySource, PinnedImage } from '../../shared/types';

const PROXY_URL = '/api/rss?url=';

interface ParsedItem {
  title: string;
  link: string;
  image?: string;
  description: string;
  pubDate: number;
}

export const discoveryService = {
  // Convert standard platform URLs to their RSS equivalents
  normalizeSourceUrl(inputUrl: string): { url: string; name: string, type: 'rss' } {
    let url = inputUrl.trim();
    
    // 1. Auto-prepend https:// if missing
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    // 2. Remove trailing slash for consistency (simplifies appending .rss later)
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    
    let hostname = 'Unknown';
    try {
      hostname = new URL(url).hostname.replace('www.', '');
    } catch (e) {
      console.warn('Invalid URL format', e);
    }

    let name = hostname;

    // Pinterest User or Board
    if (url.includes('pinterest.com')) {
      if (!url.endsWith('.rss')) url = `${url}.rss`;
      name = 'Pinterest';
    }
    // Reddit Subreddit or User
    else if (url.includes('reddit.com')) {
      // Check if it already ends with .rss (or .rss/)
      if (!url.match(/\.rss\/?$/)) {
         url = `${url}/.rss`;
      }
      name = 'Reddit';
    }
    // Vimeo User
    else if (url.includes('vimeo.com')) {
       // vimeo.com/username -> vimeo.com/username/videos/rss
       const parts = url.split('/');
       const last = parts[parts.length - 1];
       if (last !== 'rss') {
         url = `${url}/videos/rss`;
       }
       name = 'Vimeo';
    }
    // YouTube Channel/User
    else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        name = 'YouTube';
    }

    // 3. Clean up double slashes (excluding protocol)
    // This fixes cases where we might have appended /.rss to a url that already had a slash, e.g. .com//.rss
    try {
        const urlObj = new URL(url);
        urlObj.pathname = urlObj.pathname.replace(/\/\/+/g, '/');
        url = urlObj.toString();
    } catch (e) {
        // Fallback regex if URL parsing fails (though we prepended https so it should work)
        url = url.replace(/([^:])\/\//g, '$1/');
    }

    return { url, name, type: 'rss' };
  },

  async fetchFeed(source: DiscoverySource): Promise<ParsedItem[]> {
    try {
      const response = await fetch(`${PROXY_URL}${encodeURIComponent(source.feedUrl)}`);
      const data = await response.json();
      
      if (!data.contents) return [];

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.contents, "text/xml");
      
      const items = Array.from(xmlDoc.querySelectorAll("item, entry"));
      
      return items.map(item => {
        const title = item.querySelector("title")?.textContent || "Untitled";
        const link = item.querySelector("link")?.textContent || item.querySelector("link")?.getAttribute("href") || "";
        
        let image = '';
        
        // Strategy 1: media:thumbnail (Standard for RSS images)
        // We prioritize this as it's specifically meant to be the thumbnail
        const thumbnails = item.getElementsByTagName("media:thumbnail");
        if (thumbnails.length > 0) {
            image = thumbnails[0].getAttribute("url") || '';
        }

        // Strategy 2: media:content (Often contains the main media)
        // Only use if it explicitly claims to be an image or has no type (fallback)
        if (!image) {
            const mediaContents = Array.from(item.getElementsByTagName("media:content"));
            const imageContent = mediaContents.find(el => {
                const type = el.getAttribute("type");
                const medium = el.getAttribute("medium");
                // Check if it's explicitly an image
                return (type && type.startsWith("image")) || (medium === "image");
            });
            
            // If we found an explicit image, use it
            if (imageContent) {
                image = imageContent.getAttribute("url") || '';
            } else if (mediaContents.length > 0 && !mediaContents[0].getAttribute("type")?.startsWith("video")) {
                // Fallback: use first media content if it's NOT explicitly a video
                // This helps with feeds that don't specify type but provide an image
                image = mediaContents[0].getAttribute("url") || '';
            }
        }

        // Strategy 3: Enclosure (Podcasts/News often use this)
        if (!image) {
            const enclosure = item.querySelector("enclosure");
            if (enclosure?.getAttribute("type")?.startsWith("image")) {
                image = enclosure.getAttribute("url") || '';
            }
        }

        // Strategy 4: Content Description scraping (The "classic" RSS way)
        if (!image) {
            const content = item.querySelector("description")?.textContent || item.querySelector("content\\:encoded")?.textContent || "";
            // Basic regex is safer/faster than DOM parsing for simple extraction
            const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) {
                image = imgMatch[1];
            }
        }

        // Strategy 5: Reddit specific fallback (content tag sometimes has generic html)
        if (!image && source.feedUrl && source.feedUrl.includes('reddit')) {
             const content = item.getElementsByTagName("content")[0]?.textContent || "";
             // Reddit often puts the image in a simplified format in the content tag
             const match = content.match(/src="([^"]+)"/);
             if (match) image = match[1];
        }

        const pubDateStr = item.querySelector("pubDate")?.textContent || item.querySelector("published")?.textContent || "";
        const pubDate = pubDateStr ? new Date(pubDateStr).getTime() : Date.now();

        return {
          title,
          link,
          image,
          description: source.name,
          pubDate
        };
      }).filter(i => i.image && i.image.startsWith('http')); // Filter out items without images
    } catch (e) {
      console.warn(`Failed to fetch feed for ${source.name}`, e);
      return [];
    }
  },

  async getDiscoveryStream(sources: DiscoverySource[], limitPerSource = 5): Promise<PinnedImage[]> {
    if (sources.length === 0) return [];

    // Shuffle sources order to randomize priority in case of parallel fetch limits (though we await all)
    const shuffledSources = [...sources].sort(() => 0.5 - Math.random());
    
    // Fetch all active sources
    const activeSources = shuffledSources.filter(s => s.enabled);
    
    // Fetch in parallel
    const feedResults = await Promise.all(activeSources.map(async source => {
        const items = await this.fetchFeed(source);
        // Cap items per source
        return items.slice(0, limitPerSource).map(item => ({ item, source }));
    }));

    // Flatten
    const flatItems = feedResults.flat();

    // Map to PinnedImage structure (Ephemeral)
    const discoveryPins: PinnedImage[] = flatItems.map(({ item, source }) => ({
      id: `discovery-${Math.random().toString(36).substr(2, 9)}`,
      url: item.image!,
      thumbnailUrl: item.image!,
      title: item.title,
      description: `Via ${source.name}`, // Store source name in description for display
      tags: [source.name, 'Discovery'],
      boardIds: [],
      createdAt: item.pubDate,
      ownerId: 'discovery-bot',
      visibility: 'public',
      sourceUrl: item.link,
      mediaType: 'image'
    }));

    // Shuffle final results
    return discoveryPins.sort(() => 0.5 - Math.random());
  }
};
    