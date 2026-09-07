import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 기존 게임 모음 사이트는 서버 없이 file:// 로 열린다.
  // 그런데 <script type="module"> 은 file:// 에서 CORS 로 차단돼 아무것도 뜨지 않는다.
  // 그래서 모듈이 아닌 iife 한 덩어리로 뽑고, 빌드 뒤 scripts/inline.mjs 가
  // JS 와 CSS 를 index.html 안에 밀어 넣어 파일 하나로 만든다.
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
  test: {
    // 코어 로직은 DOM 이 필요 없다. UI 테스트가 생기면 그때 환경을 나눈다.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
