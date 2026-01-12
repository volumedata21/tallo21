// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCRAPE_IMAGES") {
        const images = scrapeImages();
        sendResponse({ images: images });
    }
    return true; // Keep channel open for async response
});

function scrapeImages() {
    const uniqueImages = new Map();

    // Helper: Check if element is visible
    const isVisible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' && 
               el.offsetParent !== null; // Standard check for "connected to render tree"
    };

    // 1. Get standard <img> tags
    const imgTags = document.querySelectorAll('img');
    imgTags.forEach(img => {
        // FIX: Ignore hidden images (prevents stale SPA content)
        if (!isVisible(img)) return;

        const rawSrc = img.currentSrc || img.src;
        if (!rawSrc) return;

        try {
            const src = new URL(rawSrc, document.baseURI).href;
            if (src.startsWith('http')) {
                if (!uniqueImages.has(src)) {
                    uniqueImages.set(src, { 
                        width: img.naturalWidth, 
                        height: img.naturalHeight 
                    });
                }
            }
        } catch (e) { }
    });

    // 2. Get CSS Background Images
    const allElements = document.querySelectorAll('div, span, section, a');
    allElements.forEach(el => {
        // FIX: Ignore hidden elements
        if (!isVisible(el)) return;

        const style = window.getComputedStyle(el);
        const bg = style.backgroundImage;
        
        if (bg && bg !== 'none' && bg.startsWith('url(')) {
            const rawUrl = bg.slice(4, -1).replace(/["']/g, ""); 
            try {
                const url = new URL(rawUrl, document.baseURI).href;
                if (url.startsWith('http')) {
                    if (!uniqueImages.has(url)) {
                        uniqueImages.set(url, { width: 0, height: 0 });
                    }
                }
            } catch (e) { }
        }
    });

    return Array.from(uniqueImages.entries()).map(([url, dims]) => ({
        url: url,
        width: dims.width,
        height: dims.height
    }));
}