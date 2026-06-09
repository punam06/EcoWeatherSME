const fs = require('fs');

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf-8');

    // Simple string replacements for the specific fetch calls we know exist
    // 1. Dashboard
    content = content.replace(
        /const res = await fetch\(`\$\{BACKEND_URL\}\/api\/dashboard`\);\s*const json = await res\.json\(\);/g,
        "const json = await window.apiCall('/api/dashboard');"
    );

    // 2. Batches DELETE
    content = content.replace(
        /const res = await fetch\(`\$\{BACKEND_URL\}\/api\/batches\/\$\{selectedBatch\.id \|\| selectedBatch\.batch_number\}`,\s*\{\s*method:\s*"DELETE"\s*\}\);\s*const result = await res\.json\(\);/g,
        "const result = await window.apiCall(`/api/batches/${selectedBatch.id || selectedBatch.batch_number}`, 'DELETE');"
    );

    // 3. Batches POST
    content = content.replace(
        /const response = await fetch\(`\$\{BACKEND_URL\}\/api\/batches`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([^}]+)\}\)\s*\}\);\s*const result = await response\.json\(\);/g,
        "const result = await window.apiCall('/api/batches', 'POST', {$1});"
    );

    // 4. AI Chat start
    content = content.replace(
        /const res = await fetch\(`\$\{BACKEND_URL\}\/api\/ai\/chat\/start`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([^}]+)\}\)\s*\}\);\s*const data = await res\.json\(\);/g,
        "const data = await window.apiCall('/api/ai/chat/start', 'POST', {$1});"
    );
    // 4b. AI Chat start (response)
    content = content.replace(
        /const response = await fetch\(`\$\{BACKEND_URL\}\/api\/ai\/chat\/start`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([^}]+)\}\)\s*\}\);\s*const resData = await response\.json\(\);/g,
        "const resData = await window.apiCall('/api/ai/chat/start', 'POST', {$1});"
    );

    // 5. Checkout voice
    content = content.replace(
        /const voiceRes = await fetch\(`\$\{BACKEND_URL\}\/api\/checkout\/voice`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([^}]+)\}\)\s*\}\);\s*const voiceData = await voiceRes\.json\(\);/g,
        "const voiceData = await window.apiCall('/api/checkout/voice', 'POST', {$1});"
    );

    // 6. Agent message (res)
    content = content.replace(
        /const res = await fetch\(`\$\{BACKEND_URL\}\/api\/agent\/message`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)\s*\}\);\s*const data = await res\.json\(\);/g,
        "const data = await window.apiCall('/api/agent/message', 'POST', {$1});"
    );
    // 6b. Agent message (response)
    content = content.replace(
        /const response = await fetch\(`\$\{BACKEND_URL\}\/api\/agent\/message`,\s*\{\s*method:\s*"POST",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)\s*\}\);\s*const data = await response\.json\(\);/g,
        "const data = await window.apiCall('/api/agent/message', 'POST', {$1});"
    );

    // 7. AI Chat end
    content = content.replace(
        /await fetch\(`\$\{BACKEND_URL\}\/api\/ai\/chat\/end`,\s*\{\s*method:\s*"DELETE",\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\},\s*body:\s*JSON\.stringify\(\{([^}]+)\}\)\s*\}\);/g,
        "await window.apiCall('/api/ai/chat/end', 'DELETE', {$1});"
    );

    // 8. Orders endpoint
    content = content.replace(
        /const res = await fetch\(`\$\{BACKEND_URL\}\/api\/orders\/\$\{orderId\}\/\$\{endpoint\}`,\s*\{\s*method:\s*'POST',\s*headers:\s*\{\s*'Content-Type':\s*'application\/json'\s*\},\s*body:\s*JSON\.stringify\(payload\),\s*\}\);\s*const data = await res\.json\(\);/g,
        "const data = await window.apiCall(`/api/orders/${orderId}/${endpoint}`, 'POST', payload);"
    );

    // 9. Deliveries
    content = content.replace(
        /const res = await fetch\(`\$\{BACKEND_URL\}\/api\/deliveries`,\s*\{\s*headers:\s*\{\s*"Authorization":\s*`Bearer \$\{token\}`\s*\}\s*\}\);\s*if\s*\(!res\.ok\)[\s\S]*?const json = await res\.json\(\);/g,
        "const json = await window.apiCall('/api/deliveries');"
    );
    // Alternative deliveries block if !res.ok is not there:
    content = content.replace(
        /const res = await fetch\(`\$\{BACKEND_URL\}\/api\/deliveries`,\s*\{\s*headers:\s*\{\s*"Authorization":\s*`Bearer \$\{token\}`\s*\}\s*\}\);\s*const json = await res\.json\(\);/g,
        "const json = await window.apiCall('/api/deliveries');"
    );

    // 10. Config
    content = content.replace(
        /const configRes = await fetch\(`\$\{API_BASE\}\/api\/config`\)\.then\(r => r\.json\(\)\);/g,
        "const configRes = await window.apiCall('/api/config');"
    );

    fs.writeFileSync(filepath, content, 'utf-8');
}

processFile('d:/user_jabu/hackathon-ev/Frontend and UI/climalogix_dashboard.jsx');
processFile('d:/user_jabu/hackathon-ev/Frontend and UI/index.html');
console.log('Done!');
