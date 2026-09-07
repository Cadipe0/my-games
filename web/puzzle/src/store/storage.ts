/* 기록을 어디에 둘지 정하는 한 곳.

   기록은 서버(server/ 의 FastAPI + SQLite)에 쌓는다. stats.ts 와 화면
   코드는 손대지 않았다 — 처음부터 전부 Promise 를 돌려주도록 해 둔 덕이다.

   퍼즐은 따로 번들되는 앱이라 web/scores.js 를 그대로 가져다 쓸 수 없다.
   그래서 같은 모양(loadBlob / saveBlob / removeBlob)과 같은 규칙을 여기에
   한 벌 더 둔다. 특히 사람을 가르는 키(gm:player:v1)를 저기와 똑같이
   읽는 게 중요하다 — 그래야 허브가 읽는 퍼즐 통계와 퍼즐이 쓰는 통계가
   같은 사람 것으로 묶인다.

   LocalBackend 는 지우지 않고 남겨 두었다. file:// 로 직접 열 때(= fetch 가
   막힐 때)와 서버에 닿지 못할 때 대신 쓰인다. */

export interface StorageBackend {
  loadBlob<T>(key: string, fallback: T): Promise<T>;
  saveBlob(key: string, value: unknown): Promise<void>;
  removeBlob(key: string): Promise<void>;
}

export const LocalBackend: StorageBackend = {
  loadBlob<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return Promise.resolve(fallback);
      return Promise.resolve(JSON.parse(raw) as T);
    } catch {
      // 저장소가 막혀 있거나 내용이 깨졌으면 기록 없이 진행한다
      return Promise.resolve(fallback);
    }
  },

  saveBlob(key: string, value: unknown): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장이 막혀도 게임은 계속돼야 한다 */
    }
    return Promise.resolve();
  },

  removeBlob(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      /* 무시 */
    }
    return Promise.resolve();
  },
};


/* ---------- 서버 백엔드 ---------- */

const API = '/api';
const PLAYER_KEY = 'gm:player:v1'; // web/scores.js 와 같은 키를 봐야 같은 사람이 된다

let cachedPid: string | null = null;

/** 이 브라우저가 누구인지. 판 기록(scores.ts)도 같은 값을 써야 한 사람으로 묶인다. */
export function playerId(): string {
  if (cachedPid) return cachedPid;
  let id = '';
  try {
    id = localStorage.getItem(PLAYER_KEY) || '';
  } catch {
    /* 저장소가 막혀 있으면 이번 방문만 쓰는 임시 id 로 간다 */
  }
  if (!id) {
    id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    try {
      localStorage.setItem(PLAYER_KEY, id);
    } catch {
      /* 못 남겨도 이번 방문 동안은 cachedPid 로 일관된다 */
    }
  }
  cachedPid = id;
  return id;
}

async function req(method: string, key: string, body?: unknown): Promise<unknown> {
  const init: RequestInit = { method, headers: { 'X-Player-Id': playerId() } };
  if (body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(API + '/blobs/' + encodeURIComponent(key), init);
  // 아직 저장된 게 없다는 뜻. 부른 쪽이 기본값을 쓴다.
  // 204 가 지금 서버의 답이고, 404 는 예전 서버에 붙을 때를 위해 남겨 둔다.
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) throw new Error('서버 ' + res.status);
  return res.json();
}

/* 서버가 안 떠 있어도 퍼즐은 계속돼야 한다. 요청이 실패하면 브라우저
   저장소로 대신 처리하고, 서버가 돌아오면 다음 요청부터 다시 서버를 쓴다. */
let warned = false;

function warnOnce(err: unknown): void {
  if (warned) return;
  warned = true;
  console.warn('[puzzle] 서버에 닿지 못해 브라우저 저장소를 씁니다.', err);
}

export const ServerBackend: StorageBackend = {
  async loadBlob<T>(key: string, fallback: T): Promise<T> {
    try {
      const r = (await req('GET', key)) as { value: T } | null;
      return r ? r.value : fallback;
    } catch (e) {
      warnOnce(e);
      return LocalBackend.loadBlob(key, fallback);
    }
  },

  async saveBlob(key: string, value: unknown): Promise<void> {
    try {
      await req('PUT', key, value);
    } catch (e) {
      warnOnce(e);
      await LocalBackend.saveBlob(key, value);
    }
  },

  async removeBlob(key: string): Promise<void> {
    try {
      await req('DELETE', key);
    } catch (e) {
      warnOnce(e);
      await LocalBackend.removeBlob(key);
    }
  },
};

/* 기본은 서버다. 다만 file:// 로 직접 열면 fetch 가 막히므로 그때는
   예전처럼 브라우저 저장소를 쓴다 — 서버 없이도 퍼즐은 열린다.

   location 이 있는지부터 보는 건 브라우저 밖(테스트·도구)에서 이 파일을
   불러올 때를 위해서다. 모듈을 읽는 순간 터지면 이 파일을 거쳐 가는
   모듈까지 전부 못 쓰게 된다. */
const overHttp =
  typeof location !== 'undefined' &&
  (location.protocol === 'http:' || location.protocol === 'https:');

let backend: StorageBackend = overHttp ? ServerBackend : LocalBackend;

/** 저장 위치를 바꾸는 지점. 테스트나 특별한 사정이 있을 때 쓴다. */
export function useBackend(next: StorageBackend): void {
  backend = next;
}

export function loadBlob<T>(key: string, fallback: T): Promise<T> {
  return backend.loadBlob(key, fallback);
}

export function saveBlob(key: string, value: unknown): Promise<void> {
  return backend.saveBlob(key, value);
}

export function removeBlob(key: string): Promise<void> {
  return backend.removeBlob(key);
}
