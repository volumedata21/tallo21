// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCRAPE_IMAGES") {
        const images = scrapeImages();
        sendResponse({ images: images });
    }
    return true; // Keep channel open for async response
});

function scrapeImages() {
    const uniqueImages = new Set();

    // 1. Get standard <img> tags
    const imgTags = document.querySelectorAll('img');
    imgTags.forEach(img => {
        // Use currentSrc if available (handles srcset/responsive images)
        const src = img.currentSrc || img.src;
        if (src && src.startsWith('http')) {
            uniqueImages.add(src);
        }
    });

    // 2. Get CSS Background Images (optional but powerful)
    // We scan all divs/spans to see if they have a background-image set
    const allElements = document.querySelectorAll('div, span, section, a');
    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundImage;
        
        if (bg && bg !== 'none' && bg.startsWith('url(')) {
            // Extract URL from: url("http://...")
            const url = bg.slice(4, -1).replace(/["']/g, ""); 
            if (url.startsWith('http')) {
                uniqueImages.add(url);
            }
        }
    });

    return Array.from(uniqueImages);
}