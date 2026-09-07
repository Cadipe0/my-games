# 점수 서버

게임 기록을 브라우저(localStorage) 대신 여기에 쌓는다.
FastAPI + SQLite. DB 는 이 폴더의 `scores.db` 파일 하나다.

## 처음 한 번만

```powershell
cd C:\Users\jaeoo\Desktop\my-project\server
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 실행

```powershell
cd C:\Users\jaeoo\Desktop\my-project\server
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

브라우저에서 <http://127.0.0.1:8000> 을 연다. 게임 화면(web/)도 이 서버가
같이 내보내므로 정적 서버를 따로 띄울 필요가 없다.

- `--reload` 는 코드를 고치면 알아서 다시 뜨게 한다. 개발할 때만 쓴다.
- 같은 집 안의 다른 기기에서도 놀려면 `--host 0.0.0.0` 을 붙이고
  `http://<이 PC 의 IP>:8000` 으로 접속한다.
- API 문서는 <http://127.0.0.1:8000/docs> 에서 눌러 볼 수 있다.

## 클라우드에 올리기 (Render · Railway)

먼저 프로젝트를 통째로 GitHub 저장소에 올린다. Render 와 Railway 모두
GitHub 저장소를 보고 배포한다.

```powershell
cd C:\Users\jaeoo\Desktop\my-project
git init
git add .
git commit -m "게임 모음"
# GitHub 에서 빈 저장소를 만든 뒤
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

### 반드시 알아 둘 것 — 기록은 "지워지지 않는 디스크" 가 있어야 남는다

클라우드의 기본 파일 시스템은 임시 저장소다. 배포하거나 서버가 재시작될
때마다 초기화되므로, 그냥 올리면 `scores.db` 가 통째로 사라진다. 그래서
디스크를 따로 붙이고 `DATA_DIR` 로 그 경로를 알려 줘야 한다.

디스크는 대개 유료 플랜에서만 붙는다. 무료로 올려 시험해 볼 수는 있지만,
그때 쌓인 기록은 언제든 사라진다고 보면 된다.

### Render

`render.yaml` 이 저장소에 들어 있다. 대시보드에서 **New > Blueprint** 로 이
저장소를 고르면 그대로 만들어진다.

지금 설정은 **무료 플랜**이다. 동작을 보기에는 충분하지만 기록이 남지 않는다.

| 항목 | 값 |
|---|---|
| Root Directory | `server` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Plan | `free` |

무료 플랜에서 겪게 되는 것:

- **배포하거나 서버가 재시작되면 기록이 전부 사라진다.** 파일 시스템이
  임시 저장소라서다.
- 15 분쯤 아무도 안 들어오면 서버가 잠든다. 그다음 첫 접속이 수십 초 걸린다
  (그동안 화면이 안 뜬다). 두 번째부터는 평소 속도다.

### 기록을 남기려면 (유료로 올릴 때)

디스크는 유료 플랜에만 붙는다. Render 대시보드에서 플랜을 올린 뒤,
`render.yaml` 아래쪽 주석에 적어 둔 세 덩이를 되살리고 다시 푸시한다.

```yaml
plan: starter

disks:
  - name: data
    mountPath: /var/data
    sizeGB: 1

envVars:
  - key: DATA_DIR
    value: /var/data
```

`DATA_DIR` 이 붙는 순간부터 `scores.db` 가 그 디스크에 만들어지고, 다시
배포해도 남는다. 그 전에 쌓인 기록은 옮겨지지 않는다.

### 파이썬 버전

일부러 고정하지 않았다. 정확한 패치 버전(`3.13.15` 처럼)을 박아 두면 Render 가
그 버전을 갖고 있지 않을 때 빌드가 그 자리에서 실패한다. 이 서버는 3.10
이상이면 돌아가므로 기본값에 맡긴다. 꼭 고정해야 하면 `server/.python-version`
에 적는다.

### Railway

`railway.json` 과 `Procfile` 이 들어 있다. 저장소를 연결하면 알아서 읽는다.
그다음 **Volume 을 하나 붙이고** 그 마운트 경로를 환경변수 `DATA_DIR` 에
같은 값으로 넣어 준다 (예: `/data`).

### 환경변수

| 이름 | 기본값 | 하는 일 |
|---|---|---|
| `DATA_DIR` | 이 폴더 | `scores.db` 를 둘 곳. **클라우드에서는 반드시 디스크 경로로** |
| `PORT` | — | 클라우드가 정해 준다. 시작 명령에서 `$PORT` 로 받는다 |
| `ENABLE_DOCS` | 꺼짐 | `1` 로 주면 `/docs` 가 열린다 |
| `RATE_LIMIT` | 240 | 한 사람이 `RATE_WINDOW` 초 동안 보낼 수 있는 요청 수 |
| `RATE_WINDOW` | 60 | 위 창의 길이(초) |
| `MAX_BODY_BYTES` | 131072 | 이보다 큰 요청 본문은 읽기 전에 거절한다 |

### 퍼즐을 고쳤다면

퍼즐은 따로 빌드되는 앱이고 배포 서버에는 Node 가 없다. 소스를 고쳤으면
직접 빌드해서 결과물까지 커밋해야 한다.

```powershell
cd web\puzzle
npm run build          # dist/index.html 이 다시 만들어진다
cd ..\..
git add web/puzzle/dist/index.html
git commit -m "퍼즐 다시 빌드"
```

### 올린 뒤 확인할 것

- 주소를 열어 게임이 뜨는지
- 한 판 끝내고 **다시 배포한 뒤에도** 기록이 남아 있는지 (디스크 설정 확인)
- `https://` 로 붙는지 (X-Player-Id 가 평문으로 흐르지 않게)

### 남아 있는 한계

`X-Player-Id` 는 브라우저가 보내는 값이고 서버는 검증하지 않는다. 남의 값을
알아내면 그 사람 기록을 읽거나 지울 수 있다. 응답 어디에도 이 값을 내보내지
않아 알아내기는 어렵지만, 제대로 막으려면 로그인이 필요하다. 가족·지인끼리
쓰는 정도면 충분하고, 불특정 다수에게 열 거라면 로그인을 붙이는 게 맞다.

## API

기록의 주인은 `X-Player-Id` 헤더로 가른다. 브라우저가 랜덤으로 만들어
`gm:player:v1` 키에 보관하는 값이고, web/scores.js 가 알아서 붙인다.

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| `POST` | `/api/scores` | 기록 저장. 같은 `id` 면 덮어쓴다 |
| `GET` | `/api/scores?game=&mode=&outcome=&limit=` | **내** 기록, 최신순 |
| `DELETE` | `/api/scores?game=` | 내 기록 삭제 |
| `GET` | `/api/ranking?game=&mode=&outcome=&order=&limit=&per_player=` | **전체** 랭킹, 좋은 점수부터 (기본 10위까지) |
| `GET` `PUT` `DELETE` | `/api/blobs/{key}` | 도감·퍼즐 통계 (통짜 JSON) |

랭킹은 기록 하나가 한 줄이라 같은 사람이 여러 번 올라올 수 있다.
`per_player=true` 를 주면 사람마다 한 줄만 올린다 — 어드벤처처럼 "지금까지
발견한 엔딩 수" 를 볼 때마다 새 기록으로 남기는 게임에 쓴다.

기록이 100 개를 넘으면 오래된 것부터 지우되, `(mode, outcome)` 조합별 상위
10 개는 나이와 상관없이 남긴다. 랭킹이 10 위까지 보여주기 때문이다.

## 랭킹 화면

- 각 게임 화면 — 기록 줄 아래에 그 게임(그 난이도)의 랭킹
- 허브의 "🏆 랭킹" 버튼 → `ranking.html` 에 전체 게임 랭킹

석판 부수기(퍼즐)는 랭킹이 없다. 판마다 점수를 남기지 않고 통계만 통째로
쌓는 게임이라 줄 세울 대표 수치가 아직 없다.

## 저장 위치를 되돌리려면

`web/scores.js` 아래쪽 한 줄만 바꾸면 예전처럼 브라우저에만 쌓인다.

```js
let backend = LocalBackend;
```

`file://` 로 HTML 을 직접 열 때는 fetch 가 막히므로 코드를 안 고쳐도
자동으로 브라우저 저장소를 쓴다. 서버가 떠 있지 않을 때도 마찬가지로
브라우저 저장소로 넘어가고, 게임은 멈추지 않는다.

## 백업 · 초기화

- 백업: `scores.db` 파일 하나만 복사하면 된다.
- 전체 초기화: 서버를 끄고 `scores.db` 를 지운다. 다음 실행 때 새로 만든다.
