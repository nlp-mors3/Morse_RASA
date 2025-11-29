const bgImages = [
    "/assets/DSC00242.jpg"
];

let bgIndex = 0;
const bg = document.getElementById("bg-slideshow");

function changeBackground() {
    bg.style.opacity = 0;

    setTimeout(() => {
        bg.style.backgroundImage = `url('${bgImages[bgIndex]}')`;
        bg.style.opacity = 1;
        bgIndex = (bgIndex + 1) % bgImages.length;
    }, 1500);
}

changeBackground();
setInterval(changeBackground, 10000);

const modal = document.getElementById("link-modal");
const modalOpen = document.getElementById("modal-open");
const modalCancel = document.getElementById("modal-cancel");

let pendingLink = null;

document.querySelectorAll(".circle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        pendingLink = btn.dataset.link;
        modal.style.display = "flex";
    });
});

modalCancel.onclick = () => modal.style.display = "none";
modalOpen.onclick = () => {
    window.open(pendingLink, "_blank");
    modal.style.display = "none";
};
