const fs = require('fs');

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf-8');

    // Agent message with response variable instead of res
    content = content.replace(
        /const response = await fetch\(`\$\{BACKEND_URL\}\/api\/agent\/message`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)\s*\}\);\s*const resData = await response\.json\(\);/g,
        "const resData = await window.apiCall('/api/agent/message', 'POST', {$1});"
    );

    // Batches with response ok check
    content = content.replace(
        /const response = await fetch\(`\$\{BACKEND_URL\}\/api\/batches`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([\s\S]*?)\}\),\s*\}\);\s*if \(response\.ok\) \{\s*const result = await response\.json\(\);/g,
        "const result = await window.apiCall('/api/batches', 'POST', {$1});\n        if (result) {"
    );

    fs.writeFileSync(filepath, content, 'utf-8');
}

processFile('d:/user_jabu/hackathon-ev/Frontend and UI/climalogix_dashboard.jsx');
processFile('d:/user_jabu/hackathon-ev/Frontend and UI/index.html');
console.log('Done 3!');
