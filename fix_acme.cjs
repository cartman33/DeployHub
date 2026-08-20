const fs = require('fs');
let c = fs.readFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', 'utf8');
c = c.replace(/tag: \`acme\/\$\{code\.toLowerCase\(\)\}:v\`/g, 'tag: ""');
fs.writeFileSync('src/features/developer/DeveloperVersionRegistrationSection.jsx', c, 'utf8');
