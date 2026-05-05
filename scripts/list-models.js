const https = require('https');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("No API key");
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.models) {
        console.log("Available models:");
        parsed.models.forEach(m => {
          if (m.supportedGenerationMethods.includes('generateContent')) {
             console.log(m.name);
          }
        });
      } else {
        console.log("Response:", data);
      }
    } catch (e) {
      console.log("Error parsing response:", data);
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
