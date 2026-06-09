const fs = require('fs');

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf-8');

    // 1. Batches POST with response variable instead of res
    content = content.replace(
        /const response = await fetch\(`\$\{BACKEND_URL\}\/api\/batches`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)\s*\}\);\s*const result = await response\.json\(\);/g,
        "const result = await window.apiCall('/api/batches', 'POST', {$1});"
    );

    // 2. Agent message with response variable instead of res
    content = content.replace(
        /const response = await fetch\(`\$\{BACKEND_URL\}\/api\/agent\/message`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)\s*\}\);\s*const data = await response\.json\(\);/g,
        "const data = await window.apiCall('/api/agent/message', 'POST', {$1});"
    );

    // 3. Deliveries with missing res.json() in previous regex
    content = content.replace(
        /const res = await fetch\(`\$\{BACKEND_URL\}\/api\/deliveries`,\s*\{\s*headers:\s*\{\s*"Authorization":\s*`Bearer \$\{token\}`\s*\}\s*\}\);\s*(?:if\s*\(!res\.ok\)[\s\S]*?)?const json = await res\.json\(\);/g,
        "const json = await window.apiCall('/api/deliveries');"
    );

    content = content.replace(
        /const res = await fetch\(`\$\{BACKEND_URL\}\/api\/deliveries`,\s*\{\s*headers:\s*\{\s*"Authorization":\s*`Bearer \$\{token\}`\s*\}\s*\}\);\s*if \(json/g,
        "const json = await window.apiCall('/api/deliveries');\n          if (json"
    );

    fs.writeFileSync(filepath, content, 'utf-8');
}

processFile('d:/user_jabu/hackathon-ev/Frontend and UI/climalogix_dashboard.jsx');
processFile('d:/user_jabu/hackathon-ev/Frontend and UI/index.html');
console.log('Done 2!');
