document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
    const views = {
        settings: document.getElementById('settings-view'),
        main: document.getElementById('main-view')
    };
    
    // State
    let config = { serverUrl: '', username: '', apiKey: '' };
    let pageData = { title: '', url: '' };
    let selectedImages = new Set();
    let isDataLoaded = false;

    // 1. Initialize
    const stored = await chrome.storage.local.get(['serverUrl', 'username', 'apiKey']);
    if (stored.serverUrl && stored.username && stored.apiKey) {
        config = stored;
        
        // Check if user navigated since last open
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if(tab && tab.url !== pageData.url) {
            isDataLoaded = false;
        }
        showMain();
    } else {
        switchView('settings');
    }

    // --- NAVIGATION ---
    
    document.getElementById('settingsBtn').addEventListener('click', () => switchView('settings'));
    
    document.getElementById('cancelSettings').addEventListener('click', () => {
        if(config.serverUrl) switchView('main');
    });

    document.getElementById('saveSettings').addEventListener('click', () => {
        const url = document.getElementById('serverUrl').value.replace(/\/$/, "");
        const user = document.getElementById('username').value.trim();
        const key = document.getElementById('apiKey').value.trim();

        if(url && user && key) {
            chrome.storage.local.set({ serverUrl: url, username: user, apiKey: key }, () => {
                config = { serverUrl: url, username: user, apiKey: key };
                isDataLoaded = false;
                showMain();
            });
        } else {
            alert("All fields are required.");
        }
    });

    // --- MAIN LOGIC ---

    async function showMain() {
        switchView('main');

        if (isDataLoaded && document.getElementById('grid').hasChildNodes()) {
            return; 
        }

        // Reset UI
        document.getElementById('grid').innerHTML = '';
        document.getElementById('loading').style.display = 'block';
        document.getElementById('controls').classList.add('hidden');
        document.getElementById('message').innerText = '';
        selectedImages.clear();
        updateCount();

        // 1. Fetch Boards 
        fetchBoards();

        // --- BOARD CREATION ---

    const createContainer = document.getElementById('createBoardContainer');
    const toggleBtn = document.getElementById('toggleCreateBoard');
    const createBtn = document.getElementById('createBoardBtn');
    const newBoardInput = document.getElementById('newBoardName');

    toggleBtn.addEventListener('click', () => {
        createContainer.classList.toggle('hidden');
        if(!createContainer.classList.contains('hidden')) {
            newBoardInput.focus();
            toggleBtn.innerText = "Cancel";
        } else {
            toggleBtn.innerText = "+ New";
        }
    });

    createBtn.addEventListener('click', async () => {
        const title = newBoardInput.value.trim();
        if(!title) return;

        createBtn.disabled = true;
        createBtn.innerText = "...";

        try {
            const res = await fetch(`${config.serverUrl}/api/boards`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-token': config.apiKey 
                },
                // We don't need to send ownerId anymore, server handles it
                body: JSON.stringify({ title: title })
            });

            if(res.ok) {
                const newBoard = await res.json();
                
                // Refresh list and select the new one
                await fetchBoards();
                document.getElementById('boardSelect').value = newBoard.id;
                
                // Reset UI
                newBoardInput.value = '';
                createContainer.classList.add('hidden');
                toggleBtn.innerText = "+ New";
            } else {
                alert("Failed to create board");
            }
        } catch(e) {
            console.error(e);
            alert("Error connecting to server");
        } finally {
            createBtn.disabled = false;
            createBtn.innerText = "Add";
        }
    });

        // 2. Scrape Page (Via Content Script)
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if(!tab) return;
        
        pageData.url = tab.url;
        pageData.title = tab.title;
        document.getElementById('pinTitle').value = tab.title;

        // Send message to content script
        try {
            const response = await sendMessageToTab(tab.id, { action: "SCRAPE_IMAGES" });
            
            if (response && response.images) {
                renderImages(response.images);
                isDataLoaded = true;
            } else {
                throw new Error("No images returned.");
            }
        } catch (e) {
            console.error(e);
            document.getElementById('loading').innerText = "Refresh the page and try again.";
        }
    }

    function sendMessageToTab(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }

    async function fetchBoards() {
        const select = document.getElementById('boardSelect');
        try {
            const res = await fetch(`${config.serverUrl}/api/boards`, {
                headers: { 'x-api-token': config.apiKey }
            });
            
            if(res.status === 401) throw new Error("Auth Error");
            
            const boards = await res.json();
            select.innerHTML = '';
            
            const defaultOpt = document.createElement('option');
            defaultOpt.value = ""; 
            defaultOpt.innerText = "New Stems (Default)";
            select.appendChild(defaultOpt);

            boards.forEach(b => {
                if(b.title !== 'New Stems') {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.innerText = b.title;
                    select.appendChild(opt);
                }
            });
        } catch (e) {
            select.innerHTML = '<option value="">Default (Boards failed)</option>';
        }
    }

    function renderImages(images) {
        const grid = document.getElementById('grid');
        const filterCheckbox = document.getElementById('filterSmall');
        const minSize = 150; 
        
        document.getElementById('loading').style.display = 'none';
        
        if (!images || images.length === 0) {
            grid.innerHTML = '<p class="status">No images found on this page.</p>';
            return;
        }

        document.getElementById('controls').classList.remove('hidden');
        grid.innerHTML = ''; 

        images.forEach(imgUrl => {
            const div = document.createElement('div');
            div.className = 'img-card';
            div.style.display = 'none'; 
            
            div.innerHTML = `
                <div class="check-badge"></div>
                <div class="img-loader"></div>
                <img src="${imgUrl}" />
            `;
            
            const img = div.querySelector('img');
            
            img.onload = () => {
                const isSmall = img.naturalWidth < minSize || img.naturalHeight < minSize;
                const filterOn = filterCheckbox.checked;

                div.querySelector('.img-loader').style.display = 'none';
                img.classList.add('loaded');

                div.dataset.small = isSmall ? "true" : "false";

                if (isSmall && filterOn) {
                    div.style.display = 'none';
                } else {
                    div.style.display = 'block';
                }
                
                updateCount();
            };
            
            img.onerror = () => {
                div.remove(); 
            };

            div.addEventListener('click', () => {
                if(selectedImages.has(imgUrl)) {
                    selectedImages.delete(imgUrl);
                    div.classList.remove('selected');
                } else {
                    selectedImages.add(imgUrl);
                    div.classList.add('selected');
                }
                updateCount();
            });
            
            grid.appendChild(div);
        });

        // Auto-select logic for single result
        // Note: With async loading, strict auto-select is tricky, 
        // but default user behavior handles this naturally.

        filterCheckbox.addEventListener('change', () => {
            const cards = document.querySelectorAll('.img-card');
            cards.forEach(card => {
                if (card.dataset.small === "true") {
                    card.style.display = filterCheckbox.checked ? 'none' : 'block';
                    if(filterCheckbox.checked && card.classList.contains('selected')) {
                        card.classList.remove('selected');
                        const url = card.querySelector('img').src;
                        selectedImages.delete(url);
                    }
                }
            });
            updateCount();
        });
        
        updateCount();
    }

    // --- SELECTION TOOLS ---

    document.getElementById('selectAll').addEventListener('click', () => {
        const cards = Array.from(document.querySelectorAll('.img-card')).filter(c => c.style.display !== 'none');
        const total = cards.length;
        const selectedCount = cards.filter(c => c.classList.contains('selected')).length;
        const shouldSelectAll = selectedCount < total; 
        
        cards.forEach(card => {
            const img = card.querySelector('img').src;
            if(shouldSelectAll) {
                card.classList.add('selected');
                selectedImages.add(img);
            } else {
                card.classList.remove('selected');
                selectedImages.delete(img);
            }
        });
        
        updateCount();
    });

    function updateCount() {
        const count = selectedImages.size;
        const selectBtn = document.getElementById('selectAll');
        const visibleCards = Array.from(document.querySelectorAll('.img-card')).filter(c => c.style.display !== 'none');
        const selectedVisible = visibleCards.filter(c => c.classList.contains('selected')).length;
        
        if (visibleCards.length > 0 && selectedVisible === visibleCards.length) {
            selectBtn.innerText = "Deselect All";
        } else {
            selectBtn.innerText = "Select All";
        }

        document.getElementById('count').innerText = `(${count})`;
        const btn = document.getElementById('savePin');
        btn.innerText = count > 0 ? `Save ${count} Stem${count !== 1 ? 's' : ''}` : 'Save Stems';
        btn.disabled = count === 0;
    }

    // --- SAVE LOGIC ---

    document.getElementById('savePin').addEventListener('click', async () => {
        if(selectedImages.size === 0) return;

        const btn = document.getElementById('savePin');
        const msg = document.getElementById('message');
        const boardId = document.getElementById('boardSelect').value;
        const tags = document.getElementById('pinTags').value.split(',').map(t => t.trim()).filter(Boolean);
        const title = document.getElementById('pinTitle').value;
        const description = document.getElementById('pinDescription').value; // Get user input

        btn.disabled = true;
        btn.innerText = "Saving...";
        
        let saved = 0;
        let errors = 0;

        for (const imageUrl of selectedImages) {
            try {
                const payload = {
                    title: title || "Web Clip",
                    description: description, // Send input directly (blank if empty)
                    imageUrl: imageUrl,
                    link: pageData.url, // Source URL is still saved here as metadata
                    boardIds: boardId ? [boardId] : [],
                    ownerId: config.username,
                    tags: tags
                };

                const res = await fetch(`${config.serverUrl}/api/pins`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-api-token': config.apiKey 
                    },
                    body: JSON.stringify(payload)
                });

                if(res.ok) saved++;
                else errors++;
            } catch (e) {
                errors++;
            }
        }

        if(errors === 0) {
            msg.innerText = "All saved successfully!";
            msg.style.color = "#2dd4bf"; 
            setTimeout(() => window.close(), 1200);
        } else {
            msg.innerText = `Saved ${saved}, Failed ${errors}.`;
            msg.style.color = "#f87171"; 
            btn.disabled = false;
            btn.innerText = "Retry Failed";
        }
    });

    // --- HELPERS ---

    function switchView(viewName) {
        Object.values(views).forEach(el => el.classList.add('hidden'));
        views[viewName].classList.remove('hidden');
        
        if(viewName === 'settings') {
            document.getElementById('serverUrl').value = config.serverUrl || '';
            document.getElementById('username').value = config.username || '';
            document.getElementById('apiKey').value = config.apiKey || '';
        }
    }
});