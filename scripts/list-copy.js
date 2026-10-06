// Lists user-facing sentences in the source so the copy can be reviewed for grammar.
const fs = require('fs');
const path = require('path');

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (/\.tsx?$/.test(p)) {
      files.push(p);
    }
  }
})(path.join(__dirname, '..', 'src'));

const SKIP = /prompt\.ts|fastPath|spoken|ground|alertTimes|audioUtils|parseOutput|dateParse|schema|sensitive|micOptions|modelManifest/;

for (const f of files) {
  if (SKIP.test(f)) {
    continue;
  }
  const src = fs.readFileSync(f, 'utf8');
  const re = /(['"`])((?:(?!\1)[^\\\n])*?)\1|>([^<>{}\n]{12,})</g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const s = (m[2] || m[3] || '').trim();
    const looksLikeCopy =
      s.length >= 18 &&
      / /.test(s) &&
      /[A-Za-z]{3}/.test(s) &&
      !/^(https?|import|\.|\/)/.test(s) &&
      !/rgba|=>/.test(s) &&
      !/^[a-z]+(\.[a-z]+)+/.test(s);
    if (looksLikeCopy) {
      out.push(s);
    }
  }
  if (out.length) {
    console.log('## ' + path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/'));
    for (const s of out) {
      console.log('  - ' + s.slice(0, 200));
    }
  }
}
