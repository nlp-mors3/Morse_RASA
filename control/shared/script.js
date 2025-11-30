fetch("../../pages/shared/navbar.html")
    .then(res => res.text())
    .then(html => { document.getElementById("navbar").innerHTML = html })

document.addEventListener("DOMContentLoaded", () => {
    const para = document.getElementById("about-paragraph");
    const btn = document.getElementById("seeMoreBtn");

    btn.addEventListener("click", () => {
        para.classList.toggle("expanded");

        if (para.classList.contains("expanded")) {
            btn.textContent = "See less";
        } else {
            btn.textContent = "See more";
        }
    });
});
