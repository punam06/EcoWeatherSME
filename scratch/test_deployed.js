const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch('https://backsme.onrender.com/api/health').then(r => r.json());
    console.log("Health response from backsme.onrender.com:", res);
  } catch (e) {
    console.error("Health fetch error:", e.message);
  }

  try {
    const res2 = await fetch('https://backsme.onrender.com/').then(r => r.text());
    console.log("Root response from backsme.onrender.com:", res2);
  } catch (e) {
    console.error("Root fetch error:", e.message);
  }
}

test();
