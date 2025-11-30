import fetch from 'node-fetch';

const GAS_URL = "https://script.google.com/macros/s/AKfycbwDsmJEmfVwHGwNWSGEzOB-CMC2Bv1tCXntSJEhe8m1wyFWM7j5IhpwUfksKst0_6Vftw/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    try {
      const url = GAS_URL + "?" + new URLSearchParams(req.query).toString();
      const response = await fetch(url);
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Proxy GET failed" });
    }
  } else if (req.method === "POST") {
    try {
      const response = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Proxy POST failed" });
    }
  } else {
    res.status(405).end();
  }
}