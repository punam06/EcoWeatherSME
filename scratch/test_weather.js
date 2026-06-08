const fetch = require('node-fetch');
const apiKey = '44e6296b9612d84c4e890d75ea2748dd';
const url = `https://api.openweathermap.org/data/2.5/weather?lat=23.8103&lon=90.4125&appid=${apiKey}&units=metric`;

fetch(url)
  .then(r => r.json().then(data => {
    console.log("Response Status:", r.status);
    console.log("Response Body:", data);
  }))
  .catch(err => {
    console.error("Error:", err);
  });
