/* 빌드 뒤 처리 — JS 와 CSS 를 index.html 안으로 밀어 넣어 파일 하나로 만든다.

   이 사이트는 서버 없이 file:// 로 열린다. 여기서 두 가지가 걸린다.
   1) 외부 <script type="module"> 은 file:// 에서 CORS 로 막혀 아예 실행되지 않는다.
      → 모듈이 아닌 iife 로 뽑아 인라인한다.
   2) 인라인 일반 스크립트를 <head> 에 두면 즉시 실행돼서, <body> 의 #root 가
      아직 없는 상태로 돌아 아무것도 그리지 못한다.
      → head 의 태그는 지우고 </body> 앞으로 옮긴다. */

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const htmlPath = join(dist, 'index.html');
const jsPath = join(dist, 'app.js');
const cssPath = join(dist, 'app.css');

const CSS_TAG = /<link[^>]+href="[^"]*app\.css"[^>]*>/;
const JS_TAG = /<script[^>]+src="[^"]*app\.js"[^>]*><\/script>/;

/** 스크립트 문자열 안의 </script> 가 태그를 일찍 닫는 걸 막는다 */
const guard = (code) => code.replace(/<\/script/gi, '<\/script');

function die(msg) {
  console.error('inline: ' + msg);
  process.exit(1);
}

let html = readFileSync(htmlPath, 'utf8');

if (existsSync(cssPath)) {
  if (!CSS_TAG.test(html)) die('index.html 에서 app.css 링크를 찾지 못했습니다');
  html = html.replace(CSS_TAG, '<style>\n' + readFileSync(cssPath, 'utf8') + '\n</style>');
  rmSync(cssPath);
}

if (!existsSync(jsPath)) die('dist/app.js 를 찾지 못했습니다');
if (!JS_TAG.test(html)) die('index.html 에서 app.js 스크립트 태그를 찾지 못했습니다');
if (!html.includes('</body>')) die('index.html 에 </body> 가 없습니다');

const js = guard(readFileSync(jsPath, 'utf8'));
html = html.replace(JS_TAG, '');
html = html.replace('</body>', '  <script>\n' + js + '\n</script>\n  </body>');
rmSync(jsPath);

/* 남은 참조 검사는 <body> 앞에서만 한다.
   번들 코드 안에도 src="./app.js" 같은 문자열이 있어 문서 전체를 훑으면 오탐이 난다. */
const head = html.slice(0, html.indexOf('<body'));
if (/(?:src|href)="[^"]*app\.(?:js|css)"/.test(head)) die('아직 바깥 파일을 참조하고 있습니다');
if (html.indexOf('<script>') < html.indexOf('<div id="root"')) {
  die('스크립트가 아직 #root 보다 앞에 있습니다');
}

writeFileSync(htmlPath, html);
console.log(
  'inline: dist/index.html 한 파일로 합쳤습니다 (' +
    (Buffer.byteLength(html) / 1024).toFixed(1) +
    ' kB)',
);
