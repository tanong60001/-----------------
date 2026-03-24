const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\savag\\OneDrive\\Desktop\\สร้างระบบหน้าร้าน';

function replaceInDir(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && file !== '.git' && file !== 'node_modules') {
      replaceInDir(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('ติดหนี้')) {
        content = content.replace(/ติดหนี้/g, 'ค้างชำระ');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Replaced in ${file}`);
      }
    }
  }
}

replaceInDir(dir);
console.log('Done replacement');
