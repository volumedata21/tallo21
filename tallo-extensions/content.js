// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCRAPE_IMAGES") {
        const images = scrapeImages();
        sendResponse({ images: images });
    }
    return true; // Keep channel open for async response
});

function scrapeImages() {
    const uniqueImages = new Map(); // Use Map to store url -> dimensions

    // 1. Get standard <img> tags
    const imgTags = document.querySelectorAll('img');
    imgTags.forEach(img => {
        const rawSrc = img.currentSrc || img.src;
        if (!rawSrc) return;

        try {
            // FIX: Convert relative paths to absolute URLs
            const src = new URL(rawSrc, document.baseURI).href;
            
            if (src.startsWith('http')) {
                // Only store if not already present or if this one is larger
                if (!uniqueImages.has(src)) {
                    uniqueImages.set(src, { 
                        width: img.naturalWidth, 
                        height: img.naturalHeight 
                    });
                }
            }
        } catch (e) { /* Ignore invalid */ }
    });

    // 2. Get CSS Background Images
    const allElements = document.querySelectorAll('div, span, section, a');
    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundImage;
        
        if (bg && bg !== 'none' && bg.startsWith('url(')) {
            // Remove 'url("' and '")'
            const rawUrl = bg.slice(4, -1).replace(/["']/g, ""); 
            
            try {
                // FIX: Convert relative paths here too
                const url = new URL(rawUrl, document.baseURI).href;
                
                if (url.startsWith('http')) {
                    if (!uniqueImages.has(url)) {
                        uniqueImages.set(url, { width: 0, height: 0 });
                    }
                }
            } catch (e) { /* Ignore invalid */ }
        }
    });

    // Convert Map to array of objects
    return Array.from(uniqueImages.entries()).map(([url, dims]) => ({
        url: url,
        width: dims.width,
        height: dims.height
    }));
}