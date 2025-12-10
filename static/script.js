fetch("/navbar")
    .then(res => res.text())
    .then(html => {
        document.getElementById("navbar").innerHTML = html;
        if (window.feather) {
            feather.replace();
        }
        highlightCurrentPage();
    });

fetch("/footer")
    .then(res => res.text())
    .then(html => {
        document.getElementById("footer").innerHTML = html;
        if (window.feather) {
            feather.replace();
        }

        //Different Copyright Content for LLM Translator
        if(window.location.pathname === "/rasa-translator") {
            document.getElementById("copyright").innerHTML = "&copy; 2025 NLP Team Mors3. Powered by Gemini LLM + Lexicon."
        } else {
            document.getElementById("copyright").innerHTML = "&copy; 2025 NLP Team Mors3. All rights reserved."
        }
    });

document.addEventListener("DOMContentLoaded", () => {
    feather.replace();
});

tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'] },
            colors: {
                primary: '#4a3b76',
                secondary: '#6d5b9a',
                accent: '#a991f0',
                dark: '#1a1a2e',
            }
        }
    }
}

function highlightCurrentPage() {
    const path = window.location.pathname;

    const navLinks = {
        "/lexicon-browse": "Lexicon",
        "/research-paper": "Research Paper",
        "/builder": "Sentence Builder",
        "/rasa-translator": "LLM Translator",
        "../#about": "About Us"
    };

    // Identify the active label based on current path
    let activeLabel = navLinks[path] || null;

    // Find all navbar links
    const nav = document.getElementById("navbar");
    if (!nav) return;

    const links = nav.querySelectorAll("nav a, nav span");

    links.forEach(link => {
        const text = link.textContent.trim();

        if (text === activeLabel) {
            // Replace the element with the highlighted pill
            link.outerHTML = `
        <span class="text-primary bg-primary/10 px-3 py-1 rounded-full">${activeLabel}</span>`;
        }
    });
}



document.addEventListener("DOMContentLoaded", () => {
    const para = document.getElementById("about-paragraph");
    const btn = document.getElementById("seeMoreBtn");

    if (btn) {
        btn.addEventListener("click", () => {
            para.classList.toggle("expanded");

            if (para.classList.contains("expanded")) {
                btn.textContent = "See less";
            } else {
                btn.textContent = "See more";
            }
        });
    }
});
