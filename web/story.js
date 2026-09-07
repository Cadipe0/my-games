/* ============================================================
   텍스트 게임 — 스토리 데이터 (웹판 정본)
   ad_game.py 를 뼈대로 삼아 밤의 숲(2막)을 추가한 확장판.
   앞으로는 이 파일을 직접 편집하세요. 파이썬 원본과 별개로 관리됩니다.
   ============================================================ */

const MAX_HP = 100;

const ITEMS = {
  "약초": {
    "icon": "🌿",
    "desc": "체력을 30 회복한다.",
    "use": "heal",
    "amount": 30,
    "consumable": true
  },
  "말린 고기": {
    "icon": "🥓",
    "desc": "체력을 20 회복한다.",
    "use": "heal",
    "amount": 20,
    "consumable": true
  },
  "횃불": {
    "icon": "🔥",
    "desc": "짐승을 위협한다. 전투에서 쓰면 적이 한 턴 물러선다.",
    "use": "scare",
    "consumable": false
  },
  "나뭇가지 지팡이": {
    "icon": "🦯",
    "desc": "몸을 지탱하고 짐승을 밀어낼 수 있다. 지니고 있으면 공격력이 2 오른다.",
    "passive": {
      "attack": 2
    }
  },
  "젖은 횃불": {
    "icon": "💧",
    "desc": "흙탕물에 젖어 불이 붙지 않는다. 마를 때까지는 쓸 수 없다."
  },
  "사냥칼": {
    "icon": "🔪",
    "desc": "잘 벼려진 칼. 지니고 있으면 공격력이 4 오른다.",
    "passive": {
      "attack": 4
    }
  },
  "낡은 지도": {
    "icon": "🗺️",
    "desc": "사냥꾼이 손으로 그린 지도. 샛길이 표시되어 있다."
  },
  "밧줄": {
    "icon": "🪢",
    "desc": "몸을 확보하는 데 쓸 수 있다."
  },
  "덩굴": {
    "icon": "🌿",
    "desc": "튼튼하게 엮인 덩굴. 매달릴 수 있다."
  },
  "꿀단지": {
    "icon": "🍯",
    "desc": "달콤한 냄새가 난다. 짐승의 주의를 끈다."
  }
};

const STORY = {
  "start": {
    "text": "당신은 오래된 지도를 따라 숲으로 들어왔지만, 어느새 길을 완전히 잃어버렸습니다.\n해는 나무 사이로 뉘엿뉘엿 저물고 있고, 사방에서 부스럭거리는 소리가 들립니다.",
    "choices": [
      {
        "label": "침착하게 심호흡을 하고 주변 지형부터 살핀다.",
        "next": "forest_entry",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "일단 무작정 걸음을 옮겨 벗어나 보려 한다.",
        "next": "forest_entry",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "제자리에 서서 있는 힘껏 도움을 요청하며 소리친다.",
        "next": "bandit_encounter",
        "stat_gain": {
          "용기": 1
        }
      }
    ],
    "time": "dusk"
  },
  "bandit_encounter": {
    "text": "다급한 마음에 목이 터져라 소리쳤습니다. 하지만 대답 대신 수풀 사이에서 부스럭거리는\n인기척이 느껴지더니, 낯선 남자가 날카로운 눈빛으로 당신의 짐을 노리며 다가왔습니다!",
    "combat": {
      "enemy": "약탈자",
      "enemy_hp": 72,
      "enemy_attack": [
        13,
        24
      ],
      "player_attack": [
        15,
        25
      ],
      "flee_cost": 12,
      "win_next": "forest_entry",
      "flee_next": "forest_entry",
      "lose_next": "bandit_game_over",
      "first_strike": true
    }
  },
  "bandit_game_over": {
    "text": "약탈자의 거친 손아귀를 끝내 뿌리치지 못했습니다. 몇 차례 얻어맞은 끝에\n당신은 그 자리에서 정신을 잃고 쓰러졌습니다.",
    "ending": true,
    "good": false,
    "gameover": true,
    "title": "약탈자에게"
  },
  "choose_path": {
    "text": "정신을 차리고 보니, 저 멀리 어렴풋이 강물 소리가 들리고\n반대편에서는 희미한 불빛이 깜빡입니다.",
    "choices": [
      {
        "label": "강물 소리가 들리는 쪽으로 간다.",
        "next": "river_fog"
      },
      {
        "label": "희미한 불빛을 따라간다.",
        "next": "light_path"
      },
      {
        "label": "가장 큰 나무 위로 올라가 주변을 살핀다.",
        "next": "climb_base"
      },
      {
        "label": "잠시 걸음을 멈추고 주변을 더 살펴본다.",
        "next": "search_crossroad",
        "hide_if_flag": "살핌_갈림길"
      }
    ]
  },
  "river": {
    "text": "물소리를 따라가니 넓은 강이 나타났습니다. 강 위에는 낡아 보이는 나무다리가 걸쳐 있고,\n상류 쪽으로는 물살이 얕아 보이는 바위 지대가 보입니다.",
    "choices": [
      {
        "label": "낡은 다리를 건넌다.",
        "next": "bridge_approach"
      },
      {
        "label": "상류의 얕은 곳을 찾아간다.",
        "next": "upstream"
      },
      {
        "label": "강가에 떨어진 밧줄을 향해 조심스럽게 다가간다.",
        "next": "crocodile_encounter",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "강가를 따라 조금 더 걸어본다.",
        "next": "search_river",
        "hide_if_flag": "살핌_강가"
      }
    ]
  },
  "crocodile_encounter": {
    "text": "밧줄을 집으려는 순간, 물속에 숨어있던 커다란 악어가 첨벙 소리를 내며 튀어올랐습니다!",
    "combat": {
      "enemy": "악어",
      "enemy_hp": 85,
      "enemy_attack": [
        16,
        26
      ],
      "player_attack": [
        15,
        25
      ],
      "flee_cost": 10,
      "win_next": "river_scouted",
      "win_grants": "밧줄",
      "flee_next": "river_after_crocodile",
      "lose_next": "crocodile_game_over"
    }
  },
  "river_after_crocodile": {
    "text": "악어를 피해 황급히 물러섰습니다. 다행히 크게 다치지는 않았습니다.",
    "choices": [
      {
        "label": "낡은 다리를 건넌다.",
        "next": "bridge_approach"
      },
      {
        "label": "상류의 얕은 곳을 찾아간다.",
        "next": "upstream"
      }
    ]
  },
  "crocodile_game_over": {
    "text": "악어의 억센 턱을 끝내 피하지 못했습니다. 강물 속으로 끌려들어가며\n당신의 의식은 그대로 흐려졌습니다.",
    "ending": true,
    "good": false,
    "gameover": true,
    "title": "악어에게"
  },
  "river_scouted": {
    "text": "밧줄을 단단히 허리에 감아 챙겼습니다. 이제 강을 건널 준비가 조금 더 되었습니다.",
    "choices": [
      {
        "label": "낡은 다리를 건넌다.",
        "next": "bridge_approach"
      },
      {
        "label": "상류의 얕은 곳을 찾아간다.",
        "next": "upstream"
      }
    ]
  },
  "bridge": {
    "text": "다리는 밟을 때마다 삐걱거리며 흔들립니다.",
    "choices": [
      {
        "label": "숨을 고르고 천천히, 조심스럽게 건넌다.",
        "next": "bridge_good",
        "stat_gain": {
          "신중함": 1
        },
        "outcomes": [
          {
            "weight": 9,
            "next": "bridge_good"
          },
          {
            "weight": 1,
            "next": "bridge_good",
            "hp_range": [
              -20,
              -10
            ]
          }
        ]
      },
      {
        "label": "어두워지기 전에 서둘러 뛰어서 건넌다.",
        "next": "bridge_bad",
        "hp": -100,
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "밧줄을 다리 난간에 걸어 몸을 확보하며 건넌다.",
        "next": "bridge_rope_good",
        "requires": "밧줄",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "널빤지를 하나하나 두드려 성한 것만 골라 밟는다.",
        "next": "bridge_good",
        "requires_stat": {
          "stat": "신중함",
          "min": 3
        },
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "bridge_good": {
    "text": "한 걸음씩 신중하게 내딛은 끝에 무사히 강을 건넜습니다. 반대편 오솔길을 따라가자\n저녁 짓는 연기가 피어오르는 마을 어귀가 눈에 들어옵니다.",
    "auto_next": "night_fall"
  },
  "bridge_bad": {
    "text": "다급한 마음에 뛰어가던 순간, 낡은 널빤지가 '우지끈' 소리와 함께 부러졌습니다.\n당신은 차가운 강물에 빠졌고, 세찬 물살에 휩쓸려 정신을 잃고 말았습니다.",
    "ending": true,
    "good": false,
    "title": "급류"
  },
  "bridge_rope_good": {
    "text": "미리 챙겨둔 밧줄을 난간에 단단히 걸고 몸을 확보한 채 건넜습니다. 다리가 흔들려도\n전혀 두렵지 않았습니다. 반대편에 안전하게 도착한 당신은 여유롭게 마을 쪽으로 걸음을 옮겼습니다.",
    "auto_next": "night_fall"
  },
  "upstream": {
    "text": "상류로 걸어가자 물살이 얕아지는 바위 지대가 나타났습니다.\n하지만 이끼 낀 돌들이 미끄러워 보입니다.",
    "choices": [
      {
        "label": "돌 하나하나를 확인하며 조심스럽게 건넌다.",
        "next": "upstream_good",
        "stat_gain": {
          "신중함": 1
        },
        "outcomes": [
          {
            "weight": 9,
            "next": "upstream_good"
          },
          {
            "weight": 1,
            "next": "upstream_good",
            "hp_range": [
              -16,
              -8
            ]
          }
        ]
      },
      {
        "label": "힘으로 밀어붙여 빠르게 물살을 헤치고 건넌다.",
        "next": "upstream_bad",
        "hp": -100,
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "바위틈에 자란 약초를 발견하고 챙긴다.",
        "next": "upstream_scouted",
        "grants": "약초",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "upstream_scouted": {
    "text": "약초를 조심스럽게 뜯어 챙겼습니다. 상처를 입었을 때 도움이 될 것 같습니다.",
    "choices": [
      {
        "label": "돌 하나하나를 확인하며 조심스럽게 건넌다.",
        "next": "upstream_good",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "힘으로 밀어붙여 빠르게 물살을 헤치고 건넌다.",
        "next": "upstream_bad",
        "hp": -100,
        "stat_gain": {
          "용기": 1
        }
      }
    ]
  },
  "upstream_good": {
    "text": "미끄러운 돌들을 하나하나 짚어가며 조심스럽게 강을 건넜습니다.\n반대편에는 사냥꾼들이 다니는 오솔길이 있었고, 그 길을 따라가자 마을의 불빛이 보이기 시작했습니다.",
    "auto_next": "night_fall"
  },
  "upstream_bad": {
    "text": "성급하게 물살로 뛰어들었지만 발이 미끄러졌습니다. 거센 물살이 당신을 하류로 멀리\n떠내려 보냈고, 온몸이 흠뻑 젖은 채 방향을 완전히 잃어버렸습니다.",
    "ending": true,
    "good": false,
    "title": "휩쓸림"
  },
  "light": {
    "text": "불빛을 따라가자 낡은 오두막 한 채가 나타났습니다. 창문 틈으로 따뜻한 빛이 새어 나오고,\n안에서 낮은 목소리가 들리는 것 같습니다.",
    "choices": [
      {
        "label": "용기를 내어 문을 두드린다.",
        "next": "cabin_yard"
      },
      {
        "label": "먼저 창문으로 안을 몰래 들여다본다.",
        "next": "window"
      },
      {
        "label": "마당에 놓인 꿀단지를 향해 조심스럽게 다가간다.",
        "next": "dog_encounter",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "오두막 주위를 한 바퀴 돌아본다.",
        "next": "search_light",
        "hide_if_flag": "살핌_오두막"
      }
    ]
  },
  "dog_encounter": {
    "text": "꿀단지를 집으려는 순간, 마당 구석 개집에서 사나운 개 한 마리가 이빨을 드러내며 달려들었습니다!",
    "combat": {
      "enemy": "사나운 개",
      "enemy_hp": 55,
      "enemy_attack": [
        10,
        19
      ],
      "player_attack": [
        15,
        25
      ],
      "flee_cost": 8,
      "win_next": "light_scouted",
      "win_grants": "꿀단지",
      "flee_next": "light_after_dog",
      "lose_next": "dog_game_over",
      "first_strike": true
    }
  },
  "light_after_dog": {
    "text": "개를 피해 서둘러 물러섰습니다. 짖는 소리가 잦아들 때까지 숨죽이며 기다렸습니다.",
    "choices": [
      {
        "label": "용기를 내어 문을 두드린다.",
        "next": "cabin_yard"
      },
      {
        "label": "먼저 창문으로 안을 몰래 들여다본다.",
        "next": "window"
      }
    ]
  },
  "dog_game_over": {
    "text": "사나운 개의 이빨을 끝내 피하지 못했습니다. 계속되는 공격에 당신은\n결국 그 자리에서 정신을 잃고 쓰러졌습니다.",
    "ending": true,
    "good": false,
    "gameover": true,
    "title": "사나운 개에게"
  },
  "light_scouted": {
    "text": "꿀단지를 조심스럽게 품에 넣었습니다. 혹시 쓸모가 있을지도 모릅니다.",
    "choices": [
      {
        "label": "용기를 내어 문을 두드린다.",
        "next": "cabin_yard"
      },
      {
        "label": "먼저 창문으로 안을 몰래 들여다본다.",
        "next": "window"
      }
    ]
  },
  "door": {
    "text": "문 앞에 서니 심장이 두근거립니다.",
    "choices": [
      {
        "label": "정중하게 인사하며 도움을 청한다.",
        "next": "door_good",
        "stat_gain": {
          "신중함": 1
        },
        "outcomes": [
          {
            "weight": 8,
            "next": "door_good"
          },
          {
            "weight": 2,
            "next": "door_empty"
          }
        ]
      },
      {
        "label": "대답을 기다리지 않고 문을 벌컥 연다.",
        "next": "door_bad",
        "stat_gain": {
          "용기": 1
        },
        "hp_range": [
          -40,
          -20
        ]
      },
      {
        "label": "품에 있던 꿀단지를 마당 쪽으로 미리 던져둔다.",
        "next": "door_honey_good",
        "requires": "꿀단지",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "door_good": {
    "text": "문을 연 것은 인자한 노인이었습니다. 노인은 당신에게 따뜻한 차를 건네주고,\n숲을 빠져나가는 지름길을 자세히 알려주었습니다. 당신은 감사 인사를 전하고 마을로 향했습니다.",
    "auto_next": "night_fall"
  },
  "door_bad": {
    "text": "허락 없이 문을 열자 안에 있던 커다란 사냥개가 사납게 짖으며 뛰쳐나왔습니다.\n당신은 정신없이 도망쳤고, 어디로 왔는지도 모른 채 숲 깊은 곳에 홀로 남겨졌습니다.",
    "ending": true,
    "good": false,
    "title": "침입자"
  },
  "door_honey_good": {
    "text": "문을 열기 전, 챙겨온 꿀단지를 마당 쪽으로 슬쩍 던져두었습니다. 우렁차게 짖던 개는\n이내 꿀단지에 정신이 팔려 꼬리를 흔들었습니다. 소란에 나온 주인은 웃으며 당신을 집 안으로 들였고, 다음날 마을까지 데려다주었습니다.",
    "auto_next": "night_fall"
  },
  "window": {
    "text": "창문 틈으로 조심스럽게 안을 들여다봅니다.",
    "choices": [
      {
        "label": "안이 평온해 보여 조용히 문을 열고 들어간다.",
        "next": "window_good",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "그림자가 어른거리는 것을 보고 놀라 도망친다.",
        "next": "window_bad",
        "hp_range": [
          -27,
          -13
        ]
      }
    ]
  },
  "window_good": {
    "text": "안에는 온화한 노부부가 살고 있었습니다. 그들은 놀란 당신을 반갑게 맞아주며\n손수 그린 숲 지도를 선물해주었습니다. 지도 덕분에 당신은 어렵지 않게 마을 어귀에 다다랐습니다.",
    "auto_next": "night_fall"
  },
  "window_bad": {
    "text": "그림자의 정체를 확인하지도 못한 채 정신없이 달아났습니다. 얼마나 뛰었는지도 모른 채\n정신을 차려보니, 당신은 오두막의 불빛도 보이지 않는 더 깊은 숲 속에 서 있었습니다.",
    "ending": true,
    "good": false,
    "title": "미아"
  },
  "climb": {
    "text": "가장 큰 나무 위로 올라가자 숲 전체가 한눈에 들어옵니다. 한쪽에는 강물이 반짝이고,\n반대쪽에는 오두막에서 나오는 연기가 피어오릅니다. 하지만 해는 빠르게 저물고 있습니다.",
    "choices": [
      {
        "label": "서둘러 강 쪽으로 내려간다.",
        "next": "descent"
      },
      {
        "label": "오두막의 연기 쪽으로 내려간다.",
        "next": "climb_light"
      },
      {
        "label": "나뭇가지 사이에 엉켜있는 튼튼한 덩굴을 향해 다가간다.",
        "next": "wolf_encounter",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "나무 위에서 잠시 쉬며 체력을 회복한다.",
        "next": "climb_scouted",
        "stat_gain": {
          "신중함": 1
        },
        "hp_range": [
          10,
          20
        ]
      },
      {
        "label": "더 높은 가지까지 올라가 멀리 내다본다.",
        "next": "search_climb",
        "hide_if_flag": "살핌_나무"
      }
    ]
  },
  "climb_scouted": {
    "text": "튼튼한 덩굴을 둘둘 말아 어깨에 걸쳤습니다.",
    "choices": [
      {
        "label": "서둘러 강 쪽으로 내려간다.",
        "next": "descent"
      },
      {
        "label": "오두막의 연기 쪽으로 내려간다.",
        "next": "climb_light"
      }
    ]
  },
  "wolf_encounter": {
    "text": "덩굴을 잡으려는 순간, 수풀 사이에서 굶주린 늑대 한 마리가 이빨을 드러내며 튀어나왔습니다!",
    "combat": {
      "enemy": "늑대",
      "enemy_hp": 82,
      "enemy_attack": [
        12,
        22
      ],
      "player_attack": [
        15,
        25
      ],
      "flee_cost": 10,
      "win_next": "climb_scouted",
      "win_grants": "덩굴",
      "flee_next": "climb_after_wolf",
      "lose_next": "wolf_game_over"
    }
  },
  "climb_after_wolf": {
    "text": "늑대를 피해 서둘러 나무에서 내려왔습니다. 다행히 큰 부상은 없었습니다.",
    "choices": [
      {
        "label": "서둘러 강 쪽으로 내려간다.",
        "next": "descent"
      },
      {
        "label": "오두막의 연기 쪽으로 내려간다.",
        "next": "climb_light"
      }
    ]
  },
  "wolf_game_over": {
    "text": "늑대의 날카로운 이빨을 끝내 피하지 못했습니다. 온몸에 힘이 빠지며\n당신은 그 자리에서 정신을 잃고 쓰러졌습니다.",
    "ending": true,
    "good": false,
    "gameover": true,
    "title": "늑대에게"
  },
  "climb_river": {
    "text": "나무에서 내려와 강 쪽으로 발걸음을 재촉합니다. 하지만 이미 숲은 어두워지기 시작했습니다.",
    "choices": [
      {
        "label": "어둠 속에서도 침착하게 나무 사이 표식을 살피며 이동한다.",
        "next": "climb_river_good",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "무작정 빠르게 강 쪽으로 달려간다.",
        "next": "climb_river_bad",
        "stat_gain": {
          "용기": 1
        },
        "hp_range": [
          -54,
          -26
        ]
      },
      {
        "label": "덩굴을 나뭇가지에 걸어 그네처럼 안전하게 이동한다.",
        "next": "climb_river_vine_good",
        "requires": "덩굴",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "climb_river_good": {
    "text": "나무 껍질에 남은 표식들을 침착하게 따라간 끝에 강가에 도착했습니다.\n마침 근처를 지나던 나무꾼을 만나 마을로 향하는 길을 함께 걷게 되었습니다.",
    "auto_next": "night_fall"
  },
  "climb_river_bad": {
    "text": "어둠 속에서 무작정 달리다 나무뿌리에 걸려 크게 넘어지고 말았습니다.\n발목을 다친 채 움직일 수 없게 된 당신은 차가운 밤공기 속에서 홀로 아침을 기다려야 했습니다.",
    "ending": true,
    "good": false,
    "title": "어둠 속에서"
  },
  "climb_river_vine_good": {
    "text": "챙겨온 덩굴을 굵은 나뭇가지에 걸고, 그네를 타듯 어둠 속 위험한 구간을 단숨에 건넜습니다.\n발을 헛디딜 걱정 없이 강가에 사뿐히 내려선 당신은 여유롭게 마을로 걸음을 옮겼습니다.",
    "auto_next": "night_fall"
  },
  "climb_light": {
    "text": "연기가 피어오르는 방향으로 서둘러 내려갑니다. 어둠이 짙어지며 길이 잘 보이지 않습니다.",
    "choices": [
      {
        "label": "나뭇가지로 지팡이를 만들어 바닥을 짚으며 신중히 걷는다.",
        "next": "climb_light_good",
        "stat_gain": {
          "신중함": 1
        },
        "grants": "나뭇가지 지팡이"
      },
      {
        "label": "넘어질 걱정 없이 그냥 감으로 빠르게 걷는다.",
        "next": "climb_light_bad",
        "stat_gain": {
          "용기": 1
        },
        "hp_range": [
          -20,
          -10
        ]
      }
    ]
  },
  "climb_light_good": {
    "text": "지팡이로 땅을 짚으며 조심스럽게 걸은 덕분에 안전하게 오두막에 도착했습니다.\n오두막의 주인은 늦은 시간 홀로 찾아온 당신을 재워주었고, 다음날 아침 마을까지 데려다주었습니다.",
    "auto_next": "night_fall"
  },
  "climb_light_bad": {
    "text": "서두르다 방향을 완전히 잘못 잡았습니다. 연기는 더 이상 보이지 않고,\n당신은 몇 시간째 같은 자리를 맴도는 듯한 기분에 사로잡힌 채 밤을 지새우게 되었습니다.",
    "ending": true,
    "good": false,
    "title": "끝없는 숲"
  },
  "game_over_hp": {
    "text": "온몸에서 힘이 빠져나가며 눈앞이 점점 흐려집니다. 더 이상은 버틸 수가 없습니다.\n당신은 그 자리에서 정신을 잃고 쓰러졌습니다.",
    "ending": true,
    "good": false,
    "gameover": true,
    "title": "체력 소진"
  },
  "village": {
    "text": "마을 어귀에 들어서자, 순찰을 돌던 마을 사람들이 지친 당신을 발견하고 놀란 얼굴로\n다가옵니다. 무슨 일이 있었냐고 묻는 사람들 앞에서, 당신은 잠시 생각합니다.",
    "choices": [
      {
        "label": "그동안 있었던 일을 침착하게 차근차근 설명한다.",
        "next": "__final__",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "숲에서 겪은 일을 무용담처럼 신나게 떠벌린다.",
        "next": "__final__",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "그저 조용히 웃으며 별다른 말을 하지 않는다.",
        "next": "__final__"
      }
    ],
    "time": "dawn"
  },
  "ending_brave": {
    "text": "당신은 숲에서 있었던 일들을 거침없이 들려주었습니다. 두려움 앞에서도 물러서지 않은\n당신의 이야기에 사람들은 감탄했고, 그날 이후 당신은 '숲을 뚫고 나온 용기 있는 자'로\n마을에 오래도록 회자되었습니다.",
    "ending": true,
    "good": true,
    "title": "용기의 전설"
  },
  "ending_wise": {
    "text": "당신은 겪었던 일을 차분하고 조리 있게 설명했습니다. 위기 속에서도 침착함을 잃지 않은\n당신을 사람들은 신뢰하게 되었고, 이후 숲에서 길을 잃는 여행자들은 종종 당신을 찾아와\n조언을 구하게 되었습니다.",
    "ending": true,
    "good": true,
    "title": "지혜로운 안내자"
  },
  "ending_balanced": {
    "text": "특별히 내세울 것 없이, 당신은 그저 무사히 돌아왔다는 사실에 안도했습니다. 화려한 이야기도\n특별한 명성도 남기지 않았지만, 그날 이후 당신은 그 어떤 하루보다 평범한 일상을\n소중히 여기게 되었습니다.",
    "ending": true,
    "good": true,
    "title": "평범한 귀환"
  },
  "night_fall": {
    "time": "night",
    "text": "한숨 돌리고 고개를 들자, 어느새 숲은 완전히 어둠에 잠겨 있었습니다.\n마을은 아직 멀었고, 나뭇가지 사이로 차가운 바람이 불어옵니다.",
    "auto_next": "night_forest"
  },
  "night_forest": {
    "text": "밤의 숲은 낮과는 전혀 다른 얼굴을 하고 있습니다.\n왼쪽으로는 안개가 낮게 깔린 늪지대가, 오른쪽으로는 무너진 돌담이 이어집니다.\n그리고 조금 떨어진 곳에 불 꺼진 사냥꾼의 오두막이 서 있습니다.",
    "choices": [
      {
        "label": "사냥꾼의 오두막에 들러 쓸 만한 것을 찾는다.",
        "next": "hunter_hut",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "지름길인 안개 늪을 가로지른다.",
        "next": "marsh",
        "stat_gain": {
          "용기": 1
        },
        "outcomes": [
          {
            "weight": 8,
            "next": "marsh"
          },
          {
            "weight": 2,
            "next": "marsh_slip",
            "hp_range": [
              -12,
              -5
            ]
          }
        ]
      },
      {
        "label": "멀지만 단단한 돌담 길을 따라간다.",
        "next": "stone_wall",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "달빛 아래에서 잠시 숨을 고른다.",
        "next": "search_night",
        "hide_if_flag": "살핌_밤"
      }
    ]
  },
  "hunter_hut": {
    "text": "문이 반쯤 떨어져 나간 오두막 안은 오래 비어 있던 냄새가 납니다.\n벽에는 기름을 먹인 횃불이 걸려 있고, 선반에는 말린 고기가 남아 있습니다.\n안쪽 방에서는 무언가 부스럭거리는 소리가 들립니다.",
    "choices": [
      {
        "label": "벽에 걸린 횃불을 챙긴다.",
        "next": "hut_after",
        "grants": "횃불",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "선반의 말린 고기를 챙긴다.",
        "next": "hut_after",
        "grants": "말린 고기",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "벽에 박힌 낡은 지도를 떼어낸다.",
        "next": "hut_map",
        "grants": "낡은 지도",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "부스럭거리는 안쪽 방을 확인한다.",
        "next": "boar_encounter",
        "stat_gain": {
          "용기": 1
        },
        "outcomes": [
          {
            "weight": 7,
            "next": "boar_encounter"
          },
          {
            "weight": 3,
            "next": "hut_squirrel"
          }
        ]
      },
      {
        "label": "괜한 위험은 피하고 그냥 나선다.",
        "next": "night_paths"
      }
    ]
  },
  "hut_after": {
    "text": "챙긴 것을 단단히 여미고 다시 문 앞에 섰습니다.\n안쪽 방에서는 여전히 부스럭거리는 소리가 들립니다.",
    "choices": [
      {
        "label": "부스럭거리는 안쪽 방을 확인한다.",
        "next": "boar_encounter",
        "stat_gain": {
          "용기": 1
        },
        "outcomes": [
          {
            "weight": 7,
            "next": "boar_encounter"
          },
          {
            "weight": 3,
            "next": "hut_squirrel"
          }
        ]
      },
      {
        "label": "더 지체하지 않고 오두막을 나선다.",
        "next": "night_paths"
      }
    ]
  },
  "boar_encounter": {
    "text": "문을 밀자 어둠 속에서 붉은 눈이 번뜩였습니다.\n먹이를 찾아 들어온 멧돼지가 콧김을 뿜으며 몸을 낮춥니다!",
    "combat": {
      "enemy": "멧돼지",
      "enemy_hp": 96,
      "enemy_attack": [
        14,
        25
      ],
      "player_attack": [
        15,
        25
      ],
      "flee_cost": 14,
      "win_grants": "사냥칼",
      "win_next": "boar_win",
      "flee_next": "night_paths",
      "lose_next": "boar_game_over"
    }
  },
  "boar_win": {
    "text": "멧돼지가 육중한 몸을 뒤틀며 어둠 속으로 달아났습니다.\n숨을 고르며 방 안을 둘러보니, 사냥꾼이 두고 간 잘 벼려진 사냥칼이 눈에 들어옵니다.",
    "auto_next": "night_paths"
  },
  "boar_game_over": {
    "text": "좁은 방 안에는 피할 곳이 없었습니다.\n육중한 몸이 당신을 덮치는 순간, 눈앞이 하얗게 번졌습니다.",
    "ending": true,
    "good": false,
    "gameover": true,
    "title": "오두막의 어둠 속에서"
  },
  "night_paths": {
    "text": "오두막을 나서자 다시 두 갈래 길입니다.\n안개가 깔린 늪은 가깝지만 발밑이 보이지 않고,\n돌담 길은 멀지만 땅이 단단합니다.",
    "choices": [
      {
        "label": "지름길인 안개 늪을 가로지른다.",
        "next": "marsh",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "멀지만 단단한 돌담 길을 따라간다.",
        "next": "stone_wall",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "marsh": {
    "text": "안개가 무릎까지 차오른 늪지대입니다. 한 걸음 내디딜 때마다 발이 푹푹 빠집니다.\n저 멀리 파르스름한 불빛이 둥실 떠다니며 당신을 부르는 것 같습니다.",
    "choices": [
      {
        "label": "횃불로 발밑을 비추며 단단한 곳만 골라 딛는다.",
        "next": "marsh_cross",
        "requires": "횃불",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "나뭇가지로 바닥을 짚어 깊이를 재며 건넌다.",
        "next": "marsh_cross",
        "requires_stat": {
          "stat": "신중함",
          "min": 4
        },
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "파르스름한 불빛을 향해 곧장 나아간다.",
        "next": "marsh_bad",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "아무래도 위험하다. 돌담 길로 돌아 나간다.",
        "next": "stone_wall",
        "stat_gain": {
          "신중함": 1
        },
        "hp_range": [
          -14,
          -6
        ]
      }
    ]
  },
  "marsh_cross": {
    "text": "발밑을 하나하나 확인하며, 단단한 땅만 골라 늪을 건넜습니다.\n진창을 벗어나자 저 아래 마을의 불빛이 어렴풋이 보이기 시작합니다.",
    "auto_next": "dawn_road"
  },
  "marsh_bad": {
    "text": "불빛은 다가갈수록 멀어졌습니다. 그것이 도깨비불이라는 걸 깨달았을 때는\n이미 허리까지 진창에 잠긴 뒤였습니다. 발버둥 칠수록 몸은 더 깊이 가라앉았습니다.",
    "ending": true,
    "good": false,
    "title": "안개 늪의 불빛"
  },
  "stone_wall": {
    "text": "무너진 돌담을 따라 걷자 발밑이 한결 단단합니다.\n그때, 담장 너머 어둠 속에서 사람의 비명 같은 소리가 짧게 터져 나왔습니다.",
    "choices": [
      {
        "label": "망설이지 않고 소리가 난 쪽으로 달려간다.",
        "next": "rescue",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "위험한 일에 끼어들지 않고 마을로 계속 간다.",
        "next": "dawn_road",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "rescue": {
    "text": "돌담 뒤에는 다리를 다친 젊은 여행자가 주저앉아 있었습니다.\n그리고 그 주위를 들개 무리가 낮게 으르렁대며 천천히 좁혀 오고 있습니다.",
    "choices": [
      {
        "label": "횃불을 크게 휘둘러 들개들을 쫓아낸다.",
        "next": "rescue_torch",
        "requires": "횃불",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "말린 고기를 멀리 던져 주의를 돌린다.",
        "next": "rescue_meat",
        "requires": "말린 고기",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "맨몸으로 들개 무리 앞을 가로막는다.",
        "next": "wilddog_encounter",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "도저히 감당할 수 없다. 조용히 물러선다.",
        "next": "dawn_road"
      }
    ]
  },
  "rescue_torch": {
    "sets_flag": "구조",
    "text": "횃불을 머리 위로 크게 휘두르자 불티가 어둠을 갈랐습니다.\n불을 두려워한 들개들이 꼬리를 말고 물러섭니다. 당신은 여행자를 부축해 일으켰습니다.",
    "auto_next": "dawn_road"
  },
  "rescue_meat": {
    "sets_flag": "구조",
    "text": "품에서 말린 고기를 꺼내 어둠 저편으로 힘껏 던졌습니다.\n들개들이 냄새를 쫓아 몰려간 사이, 당신은 여행자를 부축해 그 자리를 벗어났습니다.",
    "auto_next": "dawn_road"
  },
  "wilddog_encounter": {
    "text": "당신은 여행자 앞을 가로막고 두 팔을 벌렸습니다.\n우두머리로 보이는 커다란 들개가 이빨을 드러내며 달려듭니다!",
    "combat": {
      "enemy": "들개 무리",
      "enemy_hp": 104,
      "enemy_attack": [
        15,
        26
      ],
      "player_attack": [
        16,
        26
      ],
      "flee_cost": 18,
      "win_next": "rescue_fight_win",
      "flee_next": "dawn_road",
      "lose_next": "wilddog_game_over"
    }
  },
  "rescue_fight_win": {
    "sets_flag": "구조",
    "text": "우두머리가 깨갱거리며 물러서자 나머지 들개들도 흩어졌습니다.\n숨을 몰아쉬며 돌아보니, 여행자가 눈물이 그렁한 눈으로 당신을 올려다보고 있었습니다.",
    "auto_next": "dawn_road"
  },
  "wilddog_game_over": {
    "text": "사방에서 달려드는 이빨을 끝내 막아내지 못했습니다.\n여행자의 비명이 멀어지고, 당신의 의식도 함께 어둠 속으로 가라앉았습니다.",
    "ending": true,
    "good": false,
    "gameover": true,
    "title": "돌담 너머에서"
  },
  "ending_hero": {
    "text": "당신 곁에는 당신이 구해낸 여행자가 나란히 서 있었습니다.\n그가 마을 사람들에게 그날 밤 있었던 일을 전하자, 사람들은 놀란 얼굴로 당신을 바라보았습니다.\n이후로도 그 숲의 밤 이야기가 나올 때마다, 사람들은 누군가를 위해 어둠 속으로 뛰어든\n한 사람의 이름을 함께 이야기하곤 했습니다.",
    "ending": true,
    "good": true,
    "title": "어둠 속으로 뛰어든 사람"
  },
  "search_crossroad": {
    "sets_flag": "살핌_갈림길",
    "text": "발밑을 뒤덮은 낙엽을 헤치자 오래전 누군가 두고 간 낡은 배낭이 나왔습니다.\n안에는 말라붙은 약초 한 줌이 그대로 남아 있었습니다.",
    "choices": [
      {
        "label": "약초를 챙기고 다시 갈림길로 돌아온다.",
        "next": "choose_path",
        "grants": "약초",
        "stat_gain": {
          "신중함": 1
        },
        "outcomes": [
          {
            "weight": 6,
            "next": "choose_path",
            "grants": "약초"
          },
          {
            "weight": 2,
            "next": "choose_path",
            "grants": "약초",
            "hp_range": [
              5,
              12
            ]
          },
          {
            "weight": 2,
            "next": "snake_bite",
            "hp_range": [
              -18,
              -8
            ]
          }
        ]
      },
      {
        "label": "남의 물건에 손대지 않고 그대로 둔다.",
        "next": "choose_path",
        "stat_gain": {
          "용기": 1
        }
      }
    ]
  },
  "search_river": {
    "sets_flag": "살핌_강가",
    "text": "강가를 따라 조금 더 걷자 물살이 잔잔한 웅덩이가 나타났습니다.\n맑은 물에 얼굴을 담그니 지친 몸에 조금 기운이 돕니다.",
    "choices": [
      {
        "label": "물을 마시고 잠시 쉬었다 간다.",
        "next": "river",
        "stat_gain": {
          "신중함": 1
        },
        "outcomes": [
          {
            "weight": 7,
            "hp_range": [
              10,
              18
            ]
          },
          {
            "weight": 3,
            "hp_range": [
              -8,
              -2
            ]
          }
        ],
        "hp_range": [
          8,
          16
        ]
      },
      {
        "label": "시간이 아깝다. 곧장 돌아간다.",
        "next": "river",
        "stat_gain": {
          "용기": 1
        }
      }
    ]
  },
  "search_light": {
    "sets_flag": "살핌_오두막",
    "text": "오두막 뒤편으로 돌아가자 장작더미와 빨랫줄이 보입니다.\n사람이 살고 있는 것은 분명해 보이지만, 개집도 함께 눈에 들어옵니다.",
    "choices": [
      {
        "label": "인기척을 살피며 조심스럽게 돌아 나온다.",
        "next": "light",
        "stat_gain": {
          "신중함": 2
        }
      },
      {
        "label": "장작더미를 뒤져 쓸 만한 것을 찾는다.",
        "next": "light",
        "stat_gain": {
          "용기": 1
        },
        "outcomes": [
          {
            "weight": 5,
            "grants": "약초",
            "stat_gain": {
              "신중함": 1
            }
          },
          {
            "weight": 5,
            "next": "woodpile_dog"
          }
        ]
      }
    ]
  },
  "search_climb": {
    "sets_flag": "살핌_나무",
    "text": "가느다란 가지를 밟고 조금 더 높이 올라섰습니다.\n멀리 마을의 불빛이 어느 방향에 있는지, 숲의 지형이 한눈에 들어옵니다.",
    "choices": [
      {
        "label": "지형을 머릿속에 새기고 내려온다.",
        "next": "climb",
        "stat_gain": {
          "신중함": 2
        }
      },
      {
        "label": "가지가 위태롭다. 서둘러 내려온다.",
        "next": "climb",
        "stat_gain": {
          "용기": 1
        },
        "hp_range": [
          -8,
          -4
        ]
      }
    ]
  },
  "search_night": {
    "sets_flag": "살핌_밤",
    "text": "나무 등걸에 등을 기대고 잠시 눈을 감았습니다.\n차가운 밤공기가 달아오른 몸을 식혀 줍니다. 멀리서 부엉이 우는 소리가 들립니다.",
    "choices": [
      {
        "label": "충분히 쉬고 일어선다.",
        "next": "night_forest",
        "stat_gain": {
          "신중함": 1
        },
        "hp_range": [
          10,
          20
        ]
      },
      {
        "label": "오래 머무를 수 없다. 곧 일어선다.",
        "next": "night_forest",
        "stat_gain": {
          "용기": 1
        },
        "hp_range": [
          3,
          7
        ]
      }
    ]
  },
  "hut_map": {
    "text": "벽에 압정으로 박혀 있던 낡은 지도를 떼어냈습니다.\n사냥꾼이 손으로 그려 넣은 샛길들이 빼곡합니다. 마을로 가는 길도 표시되어 있습니다.",
    "auto_next": "hut_after"
  },
  "dawn_road": {
    "time": "dawn",
    "text": "숲을 빠져나오자 하늘 끝이 희붐하게 밝아 오고 있었습니다.\n발밑으로 작은 개울이 흐르고, 그 너머로 마을로 이어지는 큰길이 보입니다.\n아직 마을까지는 한참을 더 걸어야 합니다.",
    "choices": [
      {
        "label": "개울을 따라 내려간다.",
        "next": "creek",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "낡은 지도를 펼쳐 표시된 샛길로 간다.",
        "next": "map_shortcut",
        "requires": "낡은 지도",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "큰길을 따라 곧장 걷는다.",
        "next": "main_road",
        "stat_gain": {
          "용기": 1
        }
      }
    ]
  },
  "creek": {
    "text": "개울물은 얼음처럼 차가웠습니다. 손을 담가 얼굴을 씻자 정신이 번쩍 듭니다.\n물가 진흙에는 사람의 발자국이 어지럽게 찍혀 있습니다. 아주 오래된 것은 아닙니다.",
    "choices": [
      {
        "label": "발자국을 따라가 본다.",
        "next": "traveler_meet",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "물만 마시고 큰길로 올라선다.",
        "next": "main_road",
        "stat_gain": {
          "신중함": 1
        },
        "outcomes": [
          {
            "weight": 7,
            "hp_range": [
              8,
              16
            ]
          },
          {
            "weight": 3,
            "hp_range": [
              -10,
              -4
            ]
          }
        ],
        "hp_range": [
          6,
          14
        ]
      }
    ]
  },
  "map_shortcut": {
    "text": "지도에 그려진 샛길은 관목 사이로 희미하게 이어져 있었습니다.\n사냥꾼이 오래 다닌 길인 듯 발밑이 단단해, 생각보다 훨씬 수월하게 걸을 수 있었습니다.",
    "choices": [
      {
        "label": "샛길을 따라 곧장 마을로 향한다.",
        "next": "village_gate",
        "stat_gain": {
          "신중함": 1
        },
        "hp_range": [
          6,
          14
        ]
      }
    ]
  },
  "main_road": {
    "text": "수레바퀴 자국이 깊게 팬 큰길로 올라섰습니다.\n한참을 걷자 저 앞에서 등불을 든 사람의 그림자가 이쪽으로 다가오고 있습니다.",
    "choices": [
      {
        "label": "손을 흔들어 인기척을 알린다.",
        "next": "traveler_meet",
        "stat_gain": {
          "용기": 1
        },
        "outcomes": [
          {
            "weight": 7,
            "next": "traveler_kind"
          },
          {
            "weight": 3,
            "next": "roadside_bandit"
          }
        ]
      },
      {
        "label": "길가 수풀에 몸을 숨기고 먼저 살핀다.",
        "next": "traveler_meet",
        "stat_gain": {
          "신중함": 1
        },
        "outcomes": [
          {
            "weight": 9,
            "next": "traveler_kind"
          },
          {
            "weight": 1,
            "next": "roadside_bandit"
          }
        ]
      }
    ]
  },
  "traveler_meet": {
    "text": "등불을 든 사람은 마을에서 나온 나무꾼이었습니다.\n밤새 돌아오지 않은 사람이 있다는 이야기를 듣고 길을 나섰다고 합니다.\n그는 당신의 몰골을 보고는 말없이 물통을 건넸습니다.",
    "choices": [
      {
        "label": "물을 받아 마시고, 숲에서 있었던 일을 짧게 전한다.",
        "next": "village_gate",
        "stat_gain": {
          "신중함": 1
        },
        "hp_range": [
          10,
          20
        ]
      },
      {
        "label": "괜찮다고 사양하고 서둘러 길을 재촉한다.",
        "next": "village_gate",
        "stat_gain": {
          "용기": 1
        }
      }
    ]
  },
  "village_gate": {
    "text": "길이 완만해지고, 나무 울타리와 밭이 하나둘 나타나기 시작합니다.\n닭 우는 소리가 들립니다. 마을이 코앞입니다.",
    "auto_next": "village"
  },
  "forest_entry": {
    "text": "걸음을 옮기기 전에 우선 자신의 상태부터 살폈습니다.\n외투는 나뭇가지에 긁혀 여기저기 해졌고, 물통은 이미 비어 있습니다.\n해는 빠르게 기울고, 기온도 조금씩 떨어지고 있습니다.",
    "choices": [
      {
        "label": "외투를 여미고 나뭇가지를 하나 주워 지팡이로 삼는다.",
        "next": "choose_path",
        "stat_gain": {
          "신중함": 1
        },
        "grants": "나뭇가지 지팡이"
      },
      {
        "label": "짐이 될 것은 버리고 몸을 가볍게 한다.",
        "next": "choose_path",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "나무껍질에 표식을 새겨 지나온 길을 기록한다.",
        "next": "choose_path",
        "stat_gain": {
          "신중함": 2
        },
        "hp_range": [
          -7,
          -3
        ]
      }
    ]
  },
  "river_fog": {
    "text": "물소리를 따라 내려가자 발밑이 축축해지고 안개가 짙어집니다.\n안개 속에서 무언가 떠내려가는 소리가 규칙적으로 들려옵니다.",
    "choices": [
      {
        "label": "소리의 정체를 확인하고 나서 움직인다.",
        "next": "river",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "신경 쓰지 않고 물가로 곧장 향한다.",
        "next": "river",
        "stat_gain": {
          "용기": 1
        }
      }
    ]
  },
  "light_path": {
    "text": "불빛을 향해 걷는 길은 가시덤불로 뒤덮여 있었습니다.\n곧장 뚫고 가면 빠르지만 옷과 살갗이 성하지 못할 것 같습니다.",
    "choices": [
      {
        "label": "덤불을 헤치고 곧장 나아간다.",
        "next": "light",
        "stat_gain": {
          "용기": 1
        },
        "hp_range": [
          -14,
          -6
        ]
      },
      {
        "label": "돌아가더라도 트인 길을 찾는다.",
        "next": "light",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "climb_base": {
    "text": "가장 큰 나무 밑동에 다다랐습니다. 첫 가지까지의 높이가 만만치 않습니다.\n젖은 이끼가 껍질을 덮고 있어 손이 자꾸 미끄러집니다.",
    "choices": [
      {
        "label": "손바닥에 흙을 묻혀 미끄럼을 줄이고 오른다.",
        "next": "climb",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "단숨에 도약해 첫 가지를 붙잡는다.",
        "next": "climb",
        "stat_gain": {
          "용기": 1
        },
        "hp_range": [
          -8,
          -4
        ]
      }
    ]
  },
  "bridge_approach": {
    "text": "다리 앞에 섰습니다. 가까이서 보니 밧줄 난간은 삭았고,\n널빤지 몇 장은 아예 빠져 강물이 그대로 내려다보입니다.",
    "choices": [
      {
        "label": "빠진 널빤지의 위치를 하나하나 눈에 담아둔다.",
        "next": "bridge",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "오래 보고 있어 봐야 겁만 난다. 곧장 발을 올린다.",
        "next": "bridge",
        "stat_gain": {
          "용기": 1
        }
      }
    ]
  },
  "cabin_yard": {
    "text": "오두막 마당으로 들어섰습니다. 빨랫줄에는 아직 마르지 않은 옷이 걸려 있고,\n문틈으로 사람 그림자가 움직이는 것이 얼핏 보입니다.",
    "choices": [
      {
        "label": "옷매무새를 다듬고 예의를 갖춰 다가간다.",
        "next": "door",
        "stat_gain": {
          "신중함": 1
        }
      },
      {
        "label": "지친 몸을 이끌고 곧장 문 앞으로 간다.",
        "next": "door",
        "stat_gain": {
          "용기": 1
        }
      }
    ]
  },
  "descent": {
    "text": "나무에서 내려오는 길, 발밑의 흙이 무너져 미끄러졌습니다.\n간신히 가지를 붙잡고 매달렸지만 손바닥이 쓰라립니다.",
    "choices": [
      {
        "label": "숨을 고르고 천천히 내려선다.",
        "next": "climb_river",
        "stat_gain": {
          "신중함": 1
        },
        "hp_range": [
          -7,
          -3
        ]
      },
      {
        "label": "그대로 뛰어내린다.",
        "next": "climb_river",
        "stat_gain": {
          "용기": 1
        },
        "hp_range": [
          -16,
          -8
        ]
      }
    ]
  },
  "traveler_kind": {
    "text": "등불을 든 사람은 마을에서 나온 나무꾼이었습니다.\n그는 당신의 몰골을 보고는 말없이 물통을 건네고, 마른 빵 한 조각까지 쥐여 주었습니다.",
    "choices": [
      {
        "label": "고맙게 받아 마시고 함께 마을로 향한다.",
        "next": "village_gate",
        "hp_range": [
          12,
          22
        ],
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "roadside_bandit": {
    "text": "등불이 가까워지자, 그 뒤로 두 사람의 그림자가 더 있는 것이 보였습니다.\n등불을 든 사내가 히죽 웃으며 몽둥이를 들어 올립니다. 마을 사람이 아니었습니다!",
    "combat": {
      "enemy": "노상강도",
      "enemy_hp": 78,
      "enemy_attack": [
        13,
        23
      ],
      "player_attack": [
        15,
        25
      ],
      "flee_cost": 16,
      "first_strike": true,
      "win_next": "robber_win",
      "flee_next": "village_gate",
      "lose_next": "bandit_game_over"
    }
  },
  "robber_win": {
    "text": "몽둥이를 놓친 사내가 욕설을 뱉으며 어둠 속으로 달아났습니다.\n그가 떨어뜨린 자루 안에는 누군가에게서 빼앗은 듯한 마른 음식이 들어 있었습니다.",
    "choices": [
      {
        "label": "음식을 챙기고 서둘러 마을로 향한다.",
        "next": "village_gate",
        "grants": "말린 고기",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "훔친 물건에는 손대지 않고 지나친다.",
        "next": "village_gate",
        "stat_gain": {
          "신중함": 2
        }
      }
    ]
  },
  "hut_squirrel": {
    "text": "잔뜩 긴장한 채 문을 밀었지만, 부스럭거림의 정체는 다람쥐 한 마리였습니다.\n다람쥐가 달아난 자리에는 도토리와 함께 사냥꾼이 숨겨둔 비상식량이 남아 있었습니다.",
    "choices": [
      {
        "label": "허탈하게 웃으며 식량을 챙긴다.",
        "next": "hut_after",
        "grants": "말린 고기",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "door_empty": {
    "text": "몇 번을 두드려도 안에서는 아무 대답이 없습니다.\n불빛은 켜져 있지만 인기척은 느껴지지 않습니다. 창문 쪽이 눈에 들어옵니다.",
    "choices": [
      {
        "label": "창문으로 안을 들여다본다.",
        "next": "window",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "snake_bite": {
    "text": "배낭에 손을 넣는 순간 무언가 손등을 세게 스쳤습니다.\n낙엽 사이로 뱀 한 마리가 스르르 빠져나갑니다. 손등이 화끈거리며 부어오릅니다.",
    "choices": [
      {
        "label": "상처를 묶고 약초만 챙겨 일어선다.",
        "next": "choose_path",
        "grants": "약초",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "woodpile_dog": {
    "text": "장작 사이로 손을 뻗는 순간, 개집 쪽에서 사슬이 끌리는 소리가 났습니다.\n돌아볼 틈도 없이 사나운 개가 이빨을 드러내며 달려듭니다!",
    "combat": {
      "enemy": "사나운 개",
      "enemy_hp": 55,
      "enemy_attack": [
        10,
        19
      ],
      "player_attack": [
        15,
        25
      ],
      "flee_cost": 8,
      "first_strike": true,
      "win_next": "woodpile_win",
      "flee_next": "light",
      "lose_next": "dog_game_over"
    }
  },
  "woodpile_win": {
    "text": "개가 깨갱거리며 개집 안으로 물러섰습니다.\n숨을 고르고 장작더미를 마저 헤치자, 안쪽에 밀어 넣어 둔 꿀단지가 굴러 나왔습니다.",
    "choices": [
      {
        "label": "꿀단지를 챙기고 앞마당으로 돌아간다.",
        "next": "light",
        "grants": "꿀단지",
        "stat_gain": {
          "용기": 1
        }
      },
      {
        "label": "소란을 더 키우기 전에 조용히 물러난다.",
        "next": "light",
        "stat_gain": {
          "신중함": 1
        }
      }
    ]
  },
  "marsh_slip": {
    "text": "안개 때문에 발밑이 보이지 않았습니다. 단단해 보이던 이끼를 밟는 순간\n땅이 푹 꺼지며 허벅지까지 진창에 빠졌습니다.\n간신히 몸을 빼냈지만, 온몸이 차가운 흙탕물에 젖었습니다.",
    "choices": [
      {
        "label": "젖어버린 횃불을 살펴본다.",
        "next": "marsh",
        "requires": "횃불",
        "consumes": "횃불",
        "grants": "젖은 횃불",
        "stat_gain": {
          "신중함": 1
        },
        "hide_when_locked": true
      },
      {
        "label": "몸을 추스르고 다시 늪으로 들어선다.",
        "next": "marsh",
        "hide_if_item": "횃불",
        "stat_gain": {
          "용기": 1
        }
      }
    ]
  }
};
