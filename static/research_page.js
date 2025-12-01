document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('document-content');
    const tocNav = document.getElementById('toc-nav');
    const collapseToggle = document.getElementById('collapse-toggle');
    const collapseIcon = document.getElementById('collapse-icon');
    const sidebar = document.getElementById('toc-sidebar');
    const contentWrapper = document.getElementById('content-wrapper');
    const outlineTitle = document.getElementById('outline-title');
    const doc_file = 'assets/NLP_IbaloiLanguage.docx';

    // --- 1. Dynamic TOC Generation ---
    async function generateTOC() {
        const doc_contents = await fetch_contents(doc_file);
        let tocHtml = '';

        // Ensure initial max-height is set correctly before rendering content
        // Note: The custom CSS ensures the sidebar container fits below the navbar.
        tocNav.style.maxHeight = '100vh'; 

        doc_contents.forEach((content, index) => {         
            const paddingClass = content['header_level'] === 1 ? 'pl-2' : (content['header_level'] === 3 ? 'pl-8' : 'pl-6');
            const sizeClass = content['header_level'] === 1 ? 'text-sm font-bold' : (content['header_level'] === 3 ? 'text-sm' : 'text-sm font-semibold');


            tocHtml += `
                <a href="#${content['header_text']}" data-id="${index+1}" class="toc-link ${sizeClass} ${paddingClass} block py-2 pr-3 rounded-r-lg text-gray-600 hover:text-blue-700 hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap overflow-hidden hidden-on-collapse">
                    ${content['header_text']}
                </a>
            `;
        });

        tocNav.innerHTML = tocHtml;
                
        // Set the initial calculated max-height after links are generated
        tocNav.style.maxHeight = `${tocNav.scrollHeight}px`;


        // Smoothly scroll when a link is clicked
        tocNav.querySelectorAll('.toc-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = e.currentTarget.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);

                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // --- 2. Full Sidebar Collapse Logic (Updated) ---
    collapseToggle.addEventListener('click', () => {
        const isExpanded = !sidebar.classList.contains('collapsed');

        // Toggle main sidebar width
        sidebar.classList.toggle('collapsed');
        // Toggle main content margin
        contentWrapper.classList.toggle('content-shifted');

        // Toggle icon rotation (Left Arrow -> Down Arrow)
        collapseIcon.classList.toggle('rotated', isExpanded); // Rotated when collapsing

        // Toggle TOC link visibility (always hidden when sidebar is fully collapsed)
        if (isExpanded) {
            // Start full collapse:
            // 1. Hide the contents instantly for the smooth width transition
            tocNav.classList.add('hidden-content');
            tocNav.style.maxHeight = '0';
            collapseToggle.setAttribute('aria-expanded', 'false');
        } else {
            // Start full expansion:
            // 1. Restore content visibility and max-height for animation
            // Use a slight delay to allow the width transition to start first
            setTimeout(() => {
                tocNav.classList.remove('hidden-content');
                tocNav.style.maxHeight = `${tocNav.scrollHeight}px`;
            }, 100); 
            collapseToggle.setAttribute('aria-expanded', 'true');
        }
    });

    // --- 3. Active Section Highlighting (Intersection Observer) (unchanged) ---
    const observerOptions = {
        root: null, 
        rootMargin: '0px 0px -75% 0px', 
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const id = entry.target.id;
            const link = document.querySelector(`.toc-link[data-id="${id}"]`);

            if (link) {
                if (entry.isIntersecting) {
                    document.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            }
        });
    }, observerOptions);

    function observeHeaders() {
        document.querySelectorAll('#document-content h2, #document-content h3').forEach(header => {
            observer.observe(header);
        });
    }

    async function fetch_contents(filepath) {
        try {
            const response = await fetch('/read-doc-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 'filepath': filepath }) 
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // This is the data array of sections that is returned
            return response.json(); 

        } catch (error) {
            console.error('Fetch error:', error);
            // Throwing the error here will propagate it up to the caller (populateDocument)
            throw error; 
        }
    }

    async function populateDocument() {
        const SCROLL_OFFSET_CLASS = 'scroll-mt-20';

        try {
            // Await blocks execution until the data is successfully fetched and parsed
            const contents = await fetch_contents(doc_file);

            // 1. Map the 'contents' array to an array of HTML strings
            const sectionsHTML = contents.map(content => {
                let tag, id, tagClass;
                id = content['header_text'];

                if (content['header_level'] === 1) {
                    tag = 'h2';
                    tagClass = `${SCROLL_OFFSET_CLASS} text-3xl font-semibold pt-8 pb-2 border-b text-gray-800`;
                } else if (content['header_level'] === 2) {
                    tag = 'h3';
                    tagClass = `${SCROLL_OFFSET_CLASS} text-xl font-medium pt-4 text-gray-700`;
                } else {
                    tag = 'h4';
                    tagClass = `${SCROLL_OFFSET_CLASS} text-l font-small pt-2 text-gray-600`;
                }
                
                // Return the full HTML string for the section
                return `
                    <${tag} id="${id}" class="${tagClass}">
                        ${content.header_text}
                    </${tag}>
                    <p class="text-justify" style="hyphens: auto; -webkit-hyphens: auto;">${content.content}</p>
                `;
            }).join('');

            contentArea.innerHTML = `
                <header class="mb-10 pb-4 border-b border-gray-200">
                    <h1 class="text-4xl font-extrabold text-gray-900 mb-2">Constructing a Structured Ibaloi Lexicon through Digital Resource Collection</h1>
                </header>
                <section class="space-y-6">
                    ${sectionsHTML}
                </section>
            `;

        } catch (error) {
            // Handle any errors from fetch_contents (e.g., network failure, bad response)
            contentArea.innerHTML = `<p class="text-red-600">Failed to load document contents.</p>`;
            console.error("Error in populateDocument:", error);
        }
    }

    // --- Initialization ---
    populateDocument();
    generateTOC();
    observeHeaders();

    // Set the initial active link for the first section
    const firstLink = document.querySelector('.toc-link');
    if (firstLink) {
        firstLink.classList.add('active');
    }
});