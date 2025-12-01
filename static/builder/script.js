const API_URL = "/api/proxy"; let words = [];
let selectedWord = null;

async function fetchWords() {
  try {
    renderWordSkeletons();

    let res = await fetch(API_URL + "?count=5");
    let data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      words = data;
      renderWords();
      resetSentences();
    } else {
      document.getElementById("word-list").innerHTML =
        "<p>🎉 No more words left!</p>";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("status").textContent = "Error fetching words.";
  }
}

function renderWordSkeletons(count = 5) {
  const container = document.getElementById("word-list");
  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "word-card w-[30%] bg-gray-200 p-4 rounded-xl animate-pulse";

    card.innerHTML = `
        <div class="h-5 w-3/4 rounded-md skeleton-block mb-2"></div>
        <div class="h-4 w-1/2 rounded-md skeleton-block"></div>
    `;

    container.appendChild(card);
  }
}

function renderWords() {
  const container = document.getElementById("word-list");
  container.innerHTML = "";
  words.forEach((w, i) => {
    const card = document.createElement("div");
    card.className = "word-card flex-1 basis-[30%] bg-indigo-50 p-4 rounded-xl text-center cursor-pointer transition hover:bg-indigo-100";

    card.innerHTML = `
      <div class="word">${w.word}</div>
      <div class="meta">${w.pos || "-"} | English: ${w.translation || "-"}</div>
    `;
    card.onclick = () => selectWord(i);
    container.appendChild(card);
  });
}


function selectWord(index) {
  selectedWord = words[index];
  document.querySelectorAll(".word-card").forEach((el, i) => {
    if (i === index) {
      el.classList.add("bg-blue-700", "text-white");
      el.classList.remove("bg-indigo-50");
    } else {
      el.classList.remove("bg-blue-700", "text-white");
      el.classList.add("bg-indigo-50");
    }
  });
}

function resetSentences() {
  document.getElementById("sentences").innerHTML = "";
  addSentencePair();
  document.getElementById("status").textContent = "";
}

function addSentencePair() {
  const container = document.getElementById("sentences");
  const div = document.createElement("div");
  div.className = "sentence-pair flex flex-col bg-gray-50 p-4 rounded-lg shadow-sm";
  div.innerHTML = `
      <input type="text"
          placeholder="Ibaloi sentence (must use main word)"
          class="ibaloi border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500">
      <input type="text"
          placeholder="English translation"
          class="english border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 mt-2">
    `;
  container.appendChild(div);
}

async function submitSentences() {
  if (!selectedWord) {
    document.getElementById("status").textContent = "Please select a main word first.";
    return;
  }

  const ibaloiInputs = document.querySelectorAll(".ibaloi");
  const englishInputs = document.querySelectorAll(".english");

  let entries = [];
  let allWordsUsed = new Set(); // collect words across all sentences

  for (let i = 0; i < ibaloiInputs.length; i++) {
    let ib = ibaloiInputs[i].value.trim();
    let en = englishInputs[i].value.trim();
    if (ib && en) {
      entries.push({ ibaloi: ib, english: en });

      // break ibaloi sentence into words and add to set
      ib.split(/\s+/).forEach(w => {
        if (w) allWordsUsed.add(w.toLowerCase());
      });
    }
  }

  if (entries.length === 0) {
    document.getElementById("status").textContent = "Please enter at least one sentence.";
    return;
  }

  // Always include the selected word
  allWordsUsed.add(selectedWord.word.toLowerCase());
  document.getElementById("status").textContent = "Submitting...";

  for (let entry of entries) {
    const payload = {
      ibaloiTranslation: entry.ibaloi,
      words: Array.from(allWordsUsed), // now full list
      englishSentence: entry.english,
      user: "web-user"
    };
    console.log("Submitting:", payload);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error(err);
      document.getElementById("status").textContent = "Error saving sentences.";
      return;
    }
  }

  document.getElementById("status").textContent = "Sentences saved!";
  fetchWords();
}


// Start
fetchWords();