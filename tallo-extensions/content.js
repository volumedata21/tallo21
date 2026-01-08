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
        const src = img.currentSrc || img.src;
        if (src && src.startsWith('http')) {
            // Only store if not already present or if this one is larger
            if (!uniqueImages.has(src)) {
                uniqueImages.set(src, { 
                    width: img.naturalWidth, 
                    height: img.naturalHeight 
                });
            }
        }
    });

    // 2. Get CSS Background Images
    const allElements = document.querySelectorAll('div, span, section, a');
    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundImage;
        
        if (bg && bg !== 'none' && bg.startsWith('url(')) {
            const url = bg.slice(4, -1).replace(/["']/g, ""); 
            if (url.startsWith('http')) {
                // Background images don't have naturalWidth/Height readily available
                // without loading them, so we set them to 0 or null for now.
                if (!uniqueImages.has(url)) {
                    uniqueImages.set(url, { width: 0, height: 0 });
                }
            }
        }
    });

    // Convert Map to array of objects
    return Array.from(uniqueImages.entries()).map(([url, dims]) => ({
        url: url,
        width: dims.width,
        height: dims.height
    }));
}