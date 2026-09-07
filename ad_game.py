"""짧은 텍스트 어드벤처: 숲 속에서 길을 잃은 당신의 선택, 소지품, 체력이 결말을 바꿉니다."""

import random

MAX_HP = 100

STORY = {
    "start": {
        "text": (
            "당신은 오래된 지도를 따라 숲으로 들어왔지만, 어느새 길을 완전히 잃어버렸습니다.\n"
            "해는 나무 사이로 뉘엿뉘엿 저물고 있고, 사방에서 부스럭거리는 소리가 들립니다."
        ),
        "choices": [
            {"label": "침착하게 심호흡을 하고 주변 지형부터 살핀다.", "next": "choose_path", "stat_gain": {"신중함": 1}},
            {"label": "일단 무작정 걸음을 옮겨 벗어나 보려 한다.", "next": "choose_path", "stat_gain": {"용기": 1}},
            {"label": "제자리에 서서 있는 힘껏 도움을 요청하며 소리친다.", "next": "bandit_encounter", "stat_gain": {"용기": 1}},
        ],
    },
    "bandit_encounter": {
        "text": (
            "다급한 마음에 목이 터져라 소리쳤습니다. 하지만 대답 대신 수풀 사이에서 부스럭거리는\n"
            "인기척이 느껴지더니, 낯선 남자가 날카로운 눈빛으로 당신의 짐을 노리며 다가왔습니다!"
        ),
        "combat": {
            "enemy": "약탈자",
            "enemy_hp": 35,
            "enemy_attack": (12, 22),
            "player_attack": (15, 25),
            "flee_cost": 12,
            "win_next": "choose_path",
            "flee_next": "choose_path",
            "lose_next": "bandit_game_over",
        },
    },
    "bandit_game_over": {
        "text": (
            "약탈자의 거친 손아귀를 끝내 뿌리치지 못했습니다. 몇 차례 얻어맞은 끝에\n"
            "당신은 그 자리에서 정신을 잃고 쓰러졌습니다."
        ),
        "ending": True, "good": False, "gameover": True, "title": "약탈자에게",
    },
    "choose_path": {
        "text": (
            "정신을 차리고 보니, 저 멀리 어렴풋이 강물 소리가 들리고\n"
            "반대편에서는 희미한 불빛이 깜빡입니다."
        ),
        "choices": [
            {"label": "강물 소리가 들리는 쪽으로 간다.", "next": "river"},
            {"label": "희미한 불빛을 따라간다.", "next": "light"},
            {"label": "가장 큰 나무 위로 올라가 주변을 살핀다.", "next": "climb"},
        ],
    },

    # --- 강 경로 ---
    "river": {
        "text": (
            "물소리를 따라가니 넓은 강이 나타났습니다. 강 위에는 낡아 보이는 나무다리가 걸쳐 있고,\n"
            "상류 쪽으로는 물살이 얕아 보이는 바위 지대가 보입니다."
        ),
        "choices": [
            {"label": "낡은 다리를 건넌다.", "next": "bridge"},
            {"label": "상류의 얕은 곳을 찾아간다.", "next": "upstream"},
            {"label": "강가에 떨어진 밧줄을 향해 조심스럽게 다가간다.", "next": "crocodile_encounter", "stat_gain": {"용기": 1}},
        ],
    },
    "crocodile_encounter": {
        "text": "밧줄을 집으려는 순간, 물속에 숨어있던 커다란 악어가 첨벙 소리를 내며 튀어올랐습니다!",
        "combat": {
            "enemy": "악어",
            "enemy_hp": 45,
            "enemy_attack": (15, 25),
            "player_attack": (15, 25),
            "flee_cost": 10,
            "win_next": "river_scouted",
            "win_grants": "밧줄",
            "flee_next": "river_after_crocodile",
            "lose_next": "crocodile_game_over",
        },
    },
    "river_after_crocodile": {
        "text": "악어를 피해 황급히 물러섰습니다. 다행히 크게 다치지는 않았습니다.",
        "choices": [
            {"label": "낡은 다리를 건넌다.", "next": "bridge"},
            {"label": "상류의 얕은 곳을 찾아간다.", "next": "upstream"},
        ],
    },
    "crocodile_game_over": {
        "text": (
            "악어의 억센 턱을 끝내 피하지 못했습니다. 강물 속으로 끌려들어가며\n"
            "당신의 의식은 그대로 흐려졌습니다."
        ),
        "ending": True, "good": False, "gameover": True, "title": "악어에게",
    },
    "river_scouted": {
        "text": "밧줄을 단단히 허리에 감아 챙겼습니다. 이제 강을 건널 준비가 조금 더 되었습니다.",
        "choices": [
            {"label": "낡은 다리를 건넌다.", "next": "bridge"},
            {"label": "상류의 얕은 곳을 찾아간다.", "next": "upstream"},
        ],
    },
    "bridge": {
        "text": "다리는 밟을 때마다 삐걱거리며 흔들립니다.",
        "choices": [
            {"label": "숨을 고르고 천천히, 조심스럽게 건넌다.", "next": "bridge_good", "stat_gain": {"신중함": 1}},
            {"label": "어두워지기 전에 서둘러 뛰어서 건넌다.", "next": "bridge_bad", "hp": -100, "stat_gain": {"용기": 1}},
            {"label": "밧줄을 다리 난간에 걸어 몸을 확보하며 건넌다.", "next": "bridge_rope_good", "requires": "밧줄", "stat_gain": {"신중함": 1}},
        ],
    },
    "bridge_good": {
        "text": (
            "한 걸음씩 신중하게 내딛은 끝에 무사히 강을 건넜습니다. 반대편 오솔길을 따라가자\n"
            "저녁 짓는 연기가 피어오르는 마을 어귀가 눈에 들어옵니다."
        ),
        "auto_next": "village",
    },
    "bridge_bad": {
        "text": (
            "다급한 마음에 뛰어가던 순간, 낡은 널빤지가 '우지끈' 소리와 함께 부러졌습니다.\n"
            "당신은 차가운 강물에 빠졌고, 세찬 물살에 휩쓸려 정신을 잃고 말았습니다."
        ),
        "ending": True, "good": False, "title": "급류",
    },
    "bridge_rope_good": {
        "text": (
            "미리 챙겨둔 밧줄을 난간에 단단히 걸고 몸을 확보한 채 건넜습니다. 다리가 흔들려도\n"
            "전혀 두렵지 않았습니다. 반대편에 안전하게 도착한 당신은 여유롭게 마을 쪽으로 걸음을 옮겼습니다."
        ),
        "auto_next": "village",
    },
    "upstream": {
        "text": (
            "상류로 걸어가자 물살이 얕아지는 바위 지대가 나타났습니다.\n"
            "하지만 이끼 낀 돌들이 미끄러워 보입니다."
        ),
        "choices": [
            {"label": "돌 하나하나를 확인하며 조심스럽게 건넌다.", "next": "upstream_good", "stat_gain": {"신중함": 1}},
            {"label": "힘으로 밀어붙여 빠르게 물살을 헤치고 건넌다.", "next": "upstream_bad", "hp": -100, "stat_gain": {"용기": 1}},
            {"label": "바위틈에 자란 약초를 발견하고 챙긴다.", "next": "upstream_scouted", "grants": "약초", "stat_gain": {"신중함": 1}},
        ],
    },
    "upstream_scouted": {
        "text": "약초를 조심스럽게 뜯어 챙겼습니다. 상처를 입었을 때 도움이 될 것 같습니다.",
        "choices": [
            {"label": "돌 하나하나를 확인하며 조심스럽게 건넌다.", "next": "upstream_good", "stat_gain": {"신중함": 1}},
            {"label": "힘으로 밀어붙여 빠르게 물살을 헤치고 건넌다.", "next": "upstream_bad", "hp": -100, "stat_gain": {"용기": 1}},
        ],
    },
    "upstream_good": {
        "text": (
            "미끄러운 돌들을 하나하나 짚어가며 조심스럽게 강을 건넜습니다.\n"
            "반대편에는 사냥꾼들이 다니는 오솔길이 있었고, 그 길을 따라가자 마을의 불빛이 보이기 시작했습니다."
        ),
        "auto_next": "village",
    },
    "upstream_bad": {
        "text": (
            "성급하게 물살로 뛰어들었지만 발이 미끄러졌습니다. 거센 물살이 당신을 하류로 멀리\n"
            "떠내려 보냈고, 온몸이 흠뻑 젖은 채 방향을 완전히 잃어버렸습니다."
        ),
        "ending": True, "good": False, "title": "휩쓸림",
    },

    # --- 불빛 경로 ---
    "light": {
        "text": (
            "불빛을 따라가자 낡은 오두막 한 채가 나타났습니다. 창문 틈으로 따뜻한 빛이 새어 나오고,\n"
            "안에서 낮은 목소리가 들리는 것 같습니다."
        ),
        "choices": [
            {"label": "용기를 내어 문을 두드린다.", "next": "door"},
            {"label": "먼저 창문으로 안을 몰래 들여다본다.", "next": "window"},
            {"label": "마당에 놓인 꿀단지를 향해 조심스럽게 다가간다.", "next": "dog_encounter", "stat_gain": {"용기": 1}},
        ],
    },
    "dog_encounter": {
        "text": "꿀단지를 집으려는 순간, 마당 구석 개집에서 사나운 개 한 마리가 이빨을 드러내며 달려들었습니다!",
        "combat": {
            "enemy": "사나운 개",
            "enemy_hp": 30,
            "enemy_attack": (8, 15),
            "player_attack": (15, 25),
            "flee_cost": 8,
            "win_next": "light_scouted",
            "win_grants": "꿀단지",
            "flee_next": "light_after_dog",
            "lose_next": "dog_game_over",
        },
    },
    "light_after_dog": {
        "text": "개를 피해 서둘러 물러섰습니다. 짖는 소리가 잦아들 때까지 숨죽이며 기다렸습니다.",
        "choices": [
            {"label": "용기를 내어 문을 두드린다.", "next": "door"},
            {"label": "먼저 창문으로 안을 몰래 들여다본다.", "next": "window"},
        ],
    },
    "dog_game_over": {
        "text": (
            "사나운 개의 이빨을 끝내 피하지 못했습니다. 계속되는 공격에 당신은\n"
            "결국 그 자리에서 정신을 잃고 쓰러졌습니다."
        ),
        "ending": True, "good": False, "gameover": True, "title": "사나운 개에게",
    },
    "light_scouted": {
        "text": "꿀단지를 조심스럽게 품에 넣었습니다. 혹시 쓸모가 있을지도 모릅니다.",
        "choices": [
            {"label": "용기를 내어 문을 두드린다.", "next": "door"},
            {"label": "먼저 창문으로 안을 몰래 들여다본다.", "next": "window"},
        ],
    },
    "door": {
        "text": "문 앞에 서니 심장이 두근거립니다.",
        "choices": [
            {"label": "정중하게 인사하며 도움을 청한다.", "next": "door_good", "stat_gain": {"신중함": 1}},
            {"label": "대답을 기다리지 않고 문을 벌컥 연다.", "next": "door_bad", "hp": -30, "stat_gain": {"용기": 1}},
            {"label": "품에 있던 꿀단지를 마당 쪽으로 미리 던져둔다.", "next": "door_honey_good", "requires": "꿀단지", "stat_gain": {"신중함": 1}},
        ],
    },
    "door_good": {
        "text": (
            "문을 연 것은 인자한 노인이었습니다. 노인은 당신에게 따뜻한 차를 건네주고,\n"
            "숲을 빠져나가는 지름길을 자세히 알려주었습니다. 당신은 감사 인사를 전하고 마을로 향했습니다."
        ),
        "auto_next": "village",
    },
    "door_bad": {
        "text": (
            "허락 없이 문을 열자 안에 있던 커다란 사냥개가 사납게 짖으며 뛰쳐나왔습니다.\n"
            "당신은 정신없이 도망쳤고, 어디로 왔는지도 모른 채 숲 깊은 곳에 홀로 남겨졌습니다."
        ),
        "ending": True, "good": False, "title": "침입자",
    },
    "door_honey_good": {
        "text": (
            "문을 열기 전, 챙겨온 꿀단지를 마당 쪽으로 슬쩍 던져두었습니다. 우렁차게 짖던 개는\n"
            "이내 꿀단지에 정신이 팔려 꼬리를 흔들었습니다. 소란에 나온 주인은 웃으며 당신을 집 안으로 들였고, 다음날 마을까지 데려다주었습니다."
        ),
        "auto_next": "village",
    },
    "window": {
        "text": "창문 틈으로 조심스럽게 안을 들여다봅니다.",
        "choices": [
            {"label": "안이 평온해 보여 조용히 문을 열고 들어간다.", "next": "window_good", "stat_gain": {"신중함": 1}},
            {"label": "그림자가 어른거리는 것을 보고 놀라 도망친다.", "next": "window_bad", "hp": -20},
        ],
    },
    "window_good": {
        "text": (
            "안에는 온화한 노부부가 살고 있었습니다. 그들은 놀란 당신을 반갑게 맞아주며\n"
            "손수 그린 숲 지도를 선물해주었습니다. 지도 덕분에 당신은 어렵지 않게 마을 어귀에 다다랐습니다."
        ),
        "auto_next": "village",
    },
    "window_bad": {
        "text": (
            "그림자의 정체를 확인하지도 못한 채 정신없이 달아났습니다. 얼마나 뛰었는지도 모른 채\n"
            "정신을 차려보니, 당신은 오두막의 불빛도 보이지 않는 더 깊은 숲 속에 서 있었습니다."
        ),
        "ending": True, "good": False, "title": "미아",
    },

    # --- 나무 경로 ---
    "climb": {
        "text": (
            "가장 큰 나무 위로 올라가자 숲 전체가 한눈에 들어옵니다. 한쪽에는 강물이 반짝이고,\n"
            "반대쪽에는 오두막에서 나오는 연기가 피어오릅니다. 하지만 해는 빠르게 저물고 있습니다."
        ),
        "choices": [
            {"label": "서둘러 강 쪽으로 내려간다.", "next": "climb_river"},
            {"label": "오두막의 연기 쪽으로 내려간다.", "next": "climb_light"},
            {"label": "나뭇가지 사이에 엉켜있는 튼튼한 덩굴을 향해 다가간다.", "next": "wolf_encounter", "stat_gain": {"용기": 1}},
            {"label": "나무 위에서 잠시 쉬며 체력을 회복한다.", "next": "climb_scouted", "hp": 15, "stat_gain": {"신중함": 1}},
        ],
    },
    "climb_scouted": {
        "text": "튼튼한 덩굴을 둘둘 말아 어깨에 걸쳤습니다.",
        "choices": [
            {"label": "서둘러 강 쪽으로 내려간다.", "next": "climb_river"},
            {"label": "오두막의 연기 쪽으로 내려간다.", "next": "climb_light"},
        ],
    },
    "wolf_encounter": {
        "text": "덩굴을 잡으려는 순간, 수풀 사이에서 굶주린 늑대 한 마리가 이빨을 드러내며 튀어나왔습니다!",
        "combat": {
            "enemy": "늑대",
            "enemy_hp": 40,
            "enemy_attack": (10, 20),
            "player_attack": (15, 25),
            "flee_cost": 10,
            "win_next": "climb_scouted",
            "win_grants": "덩굴",
            "flee_next": "climb_after_wolf",
            "lose_next": "wolf_game_over",
        },
    },
    "climb_after_wolf": {
        "text": "늑대를 피해 서둘러 나무에서 내려왔습니다. 다행히 큰 부상은 없었습니다.",
        "choices": [
            {"label": "서둘러 강 쪽으로 내려간다.", "next": "climb_river"},
            {"label": "오두막의 연기 쪽으로 내려간다.", "next": "climb_light"},
        ],
    },
    "wolf_game_over": {
        "text": (
            "늑대의 날카로운 이빨을 끝내 피하지 못했습니다. 온몸에 힘이 빠지며\n"
            "당신은 그 자리에서 정신을 잃고 쓰러졌습니다."
        ),
        "ending": True, "good": False, "gameover": True, "title": "늑대에게",
    },
    "climb_river": {
        "text": "나무에서 내려와 강 쪽으로 발걸음을 재촉합니다. 하지만 이미 숲은 어두워지기 시작했습니다.",
        "choices": [
            {"label": "어둠 속에서도 침착하게 나무 사이 표식을 살피며 이동한다.", "next": "climb_river_good", "stat_gain": {"신중함": 1}},
            {"label": "무작정 빠르게 강 쪽으로 달려간다.", "next": "climb_river_bad", "hp": -40, "stat_gain": {"용기": 1}},
            {"label": "덩굴을 나뭇가지에 걸어 그네처럼 안전하게 이동한다.", "next": "climb_river_vine_good", "requires": "덩굴", "stat_gain": {"신중함": 1}},
        ],
    },
    "climb_river_good": {
        "text": (
            "나무 껍질에 남은 표식들을 침착하게 따라간 끝에 강가에 도착했습니다.\n"
            "마침 근처를 지나던 나무꾼을 만나 마을로 향하는 길을 함께 걷게 되었습니다."
        ),
        "auto_next": "village",
    },
    "climb_river_bad": {
        "text": (
            "어둠 속에서 무작정 달리다 나무뿌리에 걸려 크게 넘어지고 말았습니다.\n"
            "발목을 다친 채 움직일 수 없게 된 당신은 차가운 밤공기 속에서 홀로 아침을 기다려야 했습니다."
        ),
        "ending": True, "good": False, "title": "어둠 속에서",
    },
    "climb_river_vine_good": {
        "text": (
            "챙겨온 덩굴을 굵은 나뭇가지에 걸고, 그네를 타듯 어둠 속 위험한 구간을 단숨에 건넜습니다.\n"
            "발을 헛디딜 걱정 없이 강가에 사뿐히 내려선 당신은 여유롭게 마을로 걸음을 옮겼습니다."
        ),
        "auto_next": "village",
    },
    "climb_light": {
        "text": "연기가 피어오르는 방향으로 서둘러 내려갑니다. 어둠이 짙어지며 길이 잘 보이지 않습니다.",
        "choices": [
            {"label": "나뭇가지로 지팡이를 만들어 바닥을 짚으며 신중히 걷는다.", "next": "climb_light_good", "stat_gain": {"신중함": 1}},
            {"label": "넘어질 걱정 없이 그냥 감으로 빠르게 걷는다.", "next": "climb_light_bad", "hp": -15, "stat_gain": {"용기": 1}},
        ],
    },
    "climb_light_good": {
        "text": (
            "지팡이로 땅을 짚으며 조심스럽게 걸은 덕분에 안전하게 오두막에 도착했습니다.\n"
            "오두막의 주인은 늦은 시간 홀로 찾아온 당신을 재워주었고, 다음날 아침 마을까지 데려다주었습니다."
        ),
        "auto_next": "village",
    },
    "climb_light_bad": {
        "text": (
            "서두르다 방향을 완전히 잘못 잡았습니다. 연기는 더 이상 보이지 않고,\n"
            "당신은 몇 시간째 같은 자리를 맴도는 듯한 기분에 사로잡힌 채 밤을 지새우게 되었습니다."
        ),
        "ending": True, "good": False, "title": "끝없는 숲",
    },

    # --- 체력 소진 ---
    "game_over_hp": {
        "text": (
            "온몸에서 힘이 빠져나가며 눈앞이 점점 흐려집니다. 더 이상은 버틸 수가 없습니다.\n"
            "당신은 그 자리에서 정신을 잃고 쓰러졌습니다."
        ),
        "ending": True, "good": False, "gameover": True, "title": "체력 소진",
    },

    # --- 마을 에필로그 (성향에 따라 최종 결말이 갈린다) ---
    "village": {
        "text": (
            "마을 어귀에 들어서자, 순찰을 돌던 마을 사람들이 지친 당신을 발견하고 놀란 얼굴로\n"
            "다가옵니다. 무슨 일이 있었냐고 묻는 사람들 앞에서, 당신은 잠시 생각합니다."
        ),
        "choices": [
            {"label": "그동안 있었던 일을 침착하게 차근차근 설명한다.", "next": "__final__", "stat_gain": {"신중함": 1}},
            {"label": "숲에서 겪은 일을 무용담처럼 신나게 떠벌린다.", "next": "__final__", "stat_gain": {"용기": 1}},
            {"label": "그저 조용히 웃으며 별다른 말을 하지 않는다.", "next": "__final__"},
        ],
    },
    "ending_brave": {
        "text": (
            "당신은 숲에서 있었던 일들을 거침없이 들려주었습니다. 두려움 앞에서도 물러서지 않은\n"
            "당신의 이야기에 사람들은 감탄했고, 그날 이후 당신은 '숲을 뚫고 나온 용기 있는 자'로\n"
            "마을에 오래도록 회자되었습니다."
        ),
        "ending": True, "good": True, "title": "용기의 전설",
    },
    "ending_wise": {
        "text": (
            "당신은 겪었던 일을 차분하고 조리 있게 설명했습니다. 위기 속에서도 침착함을 잃지 않은\n"
            "당신을 사람들은 신뢰하게 되었고, 이후 숲에서 길을 잃는 여행자들은 종종 당신을 찾아와\n"
            "조언을 구하게 되었습니다."
        ),
        "ending": True, "good": True, "title": "지혜로운 안내자",
    },
    "ending_balanced": {
        "text": (
            "특별히 내세울 것 없이, 당신은 그저 무사히 돌아왔다는 사실에 안도했습니다. 화려한 이야기도\n"
            "특별한 명성도 남기지 않았지만, 그날 이후 당신은 그 어떤 하루보다 평범한 일상을\n"
            "소중히 여기게 되었습니다."
        ),
        "ending": True, "good": True, "title": "평범한 귀환",
    },
}


def ask(prompt):
    """입력을 받되, Ctrl+C나 입력 종료(EOF)는 조용히 종료 신호로 바꾼다."""
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return None


def show_status(inventory, stats):
    if inventory:
        print(f"[소지품: {', '.join(sorted(inventory))}]")
    else:
        print("[소지품 없음]")
    print(f"[성향: 용기 {stats.get('용기', 0)} / 신중함 {stats.get('신중함', 0)}]")


def pick_final_ending(stats):
    courage = stats.get("용기", 0)
    caution = stats.get("신중함", 0)
    if courage > caution:
        return "ending_brave"
    if caution > courage:
        return "ending_wise"
    return "ending_balanced"


def fight(combat, hp, inventory):
    """턴제 전투를 진행한다. (다음 노드 id, 갱신된 체력, 중단 여부)를 반환한다."""
    enemy_hp = combat["enemy_hp"]
    print(f"\n[전투 시작] {combat['enemy']}(체력 {enemy_hp})과 마주쳤습니다!")

    while True:
        print(f"\n❤ 내 체력: {hp}/{MAX_HP}   👹 {combat['enemy']} 체력: {max(enemy_hp, 0)}")

        options = ["공격한다", "방어한다 (피해 절반)", "도망친다"]
        if "약초" in inventory:
            options.append("약초를 먹는다. (체력 +30)")
        for i, label in enumerate(options, 1):
            print(f"  {i}. {label}")

        raw = ask("행동 선택 > ")
        if raw is None:
            return None, hp, True
        if not (raw.isdigit() and 1 <= int(raw) <= len(options)):
            print(f"1~{len(options)} 중에서 선택해주세요.")
            continue

        action = int(raw)
        defended = False

        if action == 1:
            dmg = random.randint(*combat["player_attack"])
            enemy_hp -= dmg
            print(f"당신의 공격! {combat['enemy']}에게 {dmg}의 피해를 입혔습니다.")
        elif action == 2:
            defended = True
            print("방어 자세를 취합니다.")
        elif action == 3:
            hp = max(0, hp - combat["flee_cost"])
            print(f"등을 돌려 도망칩니다! 발톱에 긁혀 체력이 {combat['flee_cost']} 감소했습니다. (현재 {hp}/{MAX_HP})")
            return combat["flee_next"], hp, False
        else:
            inventory.discard("약초")
            before = hp
            hp = min(MAX_HP, hp + 30)
            print(f"약초를 먹었습니다. 체력이 {hp - before} 회복했습니다. (현재 {hp}/{MAX_HP})")

        if enemy_hp <= 0:
            print(f"\n{combat['enemy']}를 물리쳤습니다!")
            win_item = combat.get("win_grants")
            if win_item:
                inventory.add(win_item)
                print(f"[아이템 획득: {win_item}]")
            return combat["win_next"], hp, False

        raw_dmg = random.randint(*combat["enemy_attack"])
        enemy_dmg = raw_dmg // 2 if defended else raw_dmg
        hp = max(0, hp - enemy_dmg)
        if defended:
            print(f"{combat['enemy']}의 공격을 방어했습니다! 피해가 줄어 {enemy_dmg}의 피해를 입었습니다. (현재 {hp}/{MAX_HP})")
        else:
            print(f"{combat['enemy']}의 반격! {enemy_dmg}의 피해를 입었습니다. (현재 {hp}/{MAX_HP})")

        if hp <= 0:
            return combat.get("lose_next", "game_over_hp"), hp, False


def play():
    node_id = "start"
    inventory = set()
    stats = {"용기": 0, "신중함": 0}
    hp = MAX_HP

    while True:
        if node_id == "__final__":
            node_id = pick_final_ending(stats)

        node = STORY[node_id]
        print("\n" + node["text"])

        if node.get("ending"):
            if node.get("gameover"):
                label = "☠️ GAME OVER"
            elif node["good"]:
                label = "🌟 GOOD ENDING"
            else:
                label = "💀 BAD ENDING"
            print(f"\n[{label}] {node['title']}")
            show_status(inventory, stats)
            return

        if "auto_next" in node:
            raw = ask("\n(계속하려면 Enter) > ")
            if raw is None:
                print("\n게임을 중단합니다.")
                return
            node_id = node["auto_next"]
            continue

        if "combat" in node:
            next_id, hp, aborted = fight(node["combat"], hp, inventory)
            if aborted:
                print("\n게임을 중단합니다.")
                return
            node_id = next_id
            continue

        print(f"\n❤ 체력: {hp}/{MAX_HP}")

        choices = [
            c for c in node["choices"]
            if c.get("requires") is None or c["requires"] in inventory
        ]
        if "약초" in inventory:
            choices = choices + [
                {"label": "가지고 있는 약초를 먹는다. (체력 +30)", "next": node_id, "hp": 30, "consumes": "약초"}
            ]
        for i, choice in enumerate(choices, 1):
            print(f"  {i}. {choice['label']}")

        while True:
            raw = ask("선택 (i: 소지품/성향 확인) > ")
            if raw is None:
                print("\n게임을 중단합니다.")
                return
            if raw.lower() == "i":
                show_status(inventory, stats)
                continue
            if not (raw.isdigit() and 1 <= int(raw) <= len(choices)):
                print(f"1~{len(choices)} 중에서 선택하거나 i를 입력해주세요.")
                continue
            break

        chosen = choices[int(raw) - 1]

        item = chosen.get("grants")
        if item:
            inventory.add(item)
            print(f"[아이템 획득: {item}]")

        used_item = chosen.get("consumes")
        if used_item:
            inventory.discard(used_item)

        for stat_name, amount in chosen.get("stat_gain", {}).items():
            stats[stat_name] = stats.get(stat_name, 0) + amount

        delta = chosen.get("hp", 0)
        if delta:
            old_hp = hp
            hp = max(0, min(MAX_HP, hp + delta))
            applied = hp - old_hp
            if applied != 0:
                verb = "회복" if applied > 0 else "감소"
                print(f"체력이 {abs(applied)} {verb}했습니다. (현재 {hp}/{MAX_HP})")
            elif delta > 0:
                print(f"이미 체력이 가득 차 있습니다. (현재 {hp}/{MAX_HP})")

        node_id = "game_over_hp" if hp <= 0 else chosen["next"]


def main():
    print("=== 길 잃은 숲 ===")
    while True:
        play()
        again = ask("\n다시 도전하시겠어요? (y/n) > ")
        if again is None or again.lower() not in ("y", "yes"):
            print("이야기를 마칩니다.")
            break


if __name__ == "__main__":
    main()
