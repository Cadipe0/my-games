"""콘솔에서 즐기는 1인용 블랙잭. 플레이어 vs 딜러."""

import random

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
BUST_LIMIT = 30
DEFAULT_BET = 10
FIRST_BET_LIMIT_RATIO = 0.5   # 첫 판에 딜러가 선베팅할 때의 베팅 상한 비율

DIFFICULTIES = {
    "1": ("쉬움", 100),
    "2": ("보통", 200),
    "3": ("어려움", 1000),
}


def new_deck():
    deck = RANKS * 4
    random.shuffle(deck)
    return deck


def draw(deck):
    if not deck:
        deck.extend(new_deck())
    return deck.pop()


def ask(prompt):
    """입력을 받되, Ctrl+C나 입력 종료(EOF)는 조용히 종료 신호로 바꾼다."""
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return None


def ask_ace_value():
    while True:
        raw = ask("  방금 뽑은 A를 1로 쓰시겠습니까, 11로 쓰시겠습니까? (1 또는 11) > ")
        if raw is None:
            return None
        if raw in ("1", "11"):
            return int(raw)
        note("1 또는 11을 입력해주세요.")


def deal_card(deck, hand, ace_values=None):
    """카드를 한 장 뽑아 hand에 추가한다.
    ace_values가 주어지면(플레이어 손패) A를 뽑을 때마다 값을 직접 물어본다.
    입력이 중단되면 False를 반환한다."""
    card = draw(deck)
    hand.append(card)
    if ace_values is not None and card == "A":
        value = ask_ace_value()
        if value is None:
            return False
        ace_values.append(value)
    return True


def hand_value(hand):
    """딜러 손패용: 에이스를 자동으로(버스트 안 하는 쪽으로) 계산한다."""
    total = 0
    aces = 0
    for card in hand:
        if card == "A":
            total += 11
            aces += 1
        elif card in ("J", "Q", "K"):
            total += 10
        else:
            total += int(card)
    while total > BUST_LIMIT and aces > 0:
        total -= 10
        aces -= 1
    return total


def player_hand_total(hand, ace_values):
    """플레이어 손패용: 에이스는 본인이 고른 값(1 또는 11)을 그대로 사용한다."""
    total = 0
    ace_index = 0
    for card in hand:
        if card == "A":
            total += ace_values[ace_index]
            ace_index += 1
        elif card in ("J", "Q", "K"):
            total += 10
        else:
            total += int(card)
    return total


def is_blackjack(hand):
    return len(hand) == 2 and hand_value(hand) == 21


def is_player_blackjack(player, ace_values):
    return len(player) == 2 and player_hand_total(player, ace_values) == 21


def format_hand(hand, hide_last=False):
    shown = hand[:-1] + ["*"] if hide_last and len(hand) > 1 else hand
    return "  ".join(shown)


def step(number, title):
    print(f"\n[{number}] {title}")


def note(message):
    print(f"  ! {message}")


def hand_line(label, cards, total=None, extra=""):
    """'딜러'(2글자)와 '플레이어'(4글자)의 표시 폭을 맞춰 세로로 정렬한다."""
    pad = "      " if label == "딜러" else "  "
    line = f"{pad}{label} | {cards:<20}"
    if total is not None:
        line += f"합계 {total:>2}"
    if extra:
        line += f"   {extra}"
    return line.rstrip()


def show_hands(player, player_ace_values, dealer, hide_dealer, show_distance=False):
    player_total = player_hand_total(player, player_ace_values)
    dealer_total = None if hide_dealer else hand_value(dealer)

    dealer_extra = player_extra = ""
    if show_distance and dealer_total is not None:
        dealer_extra = f"(21과 차이 {abs(21 - dealer_total)})"
        player_extra = f"(21과 차이 {abs(21 - player_total)})"

    print(hand_line("딜러", format_hand(dealer, hide_last=hide_dealer), dealer_total, dealer_extra))
    print(hand_line("플레이어", format_hand(player), player_total, player_extra))


def show_chips(chips, dealer_chips):
    print(f"  플레이어 {chips}칩   vs   딜러 {dealer_chips}칩")


# --- 동전 던지기: 선베팅 순서 결정 ---

def coin_toss():
    """딜러가 동전을 던지고 플레이어가 앞/뒤를 부른다.
    맞추면 플레이어가 선베팅(True), 틀리면 딜러가 선베팅(False)."""
    print("\n🪙 딜러가 동전을 던집니다. 앞/뒤를 맞추면 선베팅권을 가집니다.")
    while True:
        raw = ask("앞면(1) / 뒷면(2) 중에서 고르세요 > ")
        if raw is None:
            return None
        if raw in ("1", "2"):
            break
        print("1 또는 2를 입력해주세요.")

    call = "앞면" if raw == "1" else "뒷면"
    result = random.choice(["앞면", "뒷면"])
    print(f"동전 결과: {result}  (플레이어 선택: {call})")

    if call == result:
        print("적중! 플레이어가 선베팅합니다.")
        return True
    print("빗나갔습니다. 딜러가 선베팅합니다.")
    return False


# --- 베팅 ---

def ask_player_bet(chips, minimum=1):
    """1차·2차 베팅 공통. y를 누르면 기본 배팅, 숫자를 입력하면 그 금액만큼 베팅한다.
    minimum은 이번 베팅에서 내려갈 수 없는 하한선
    (선베팅한 딜러의 베팅액, 또는 2차라면 1차에 이미 건 금액)."""
    if minimum > chips:
        note(f"최소 베팅액 {minimum}칩을 낼 칩이 부족해 보유 칩 전부({chips}칩)를 베팅합니다.")
        return chips

    # 기본 배팅이 최소 베팅액에 못 미치면 최소액에 맞춰 올린다.
    default_bet = max(DEFAULT_BET, minimum)
    if default_bet > chips:
        default_bet = chips
        note(f"보유 칩이 부족해 기본 배팅을 {default_bet}칩으로 맞춥니다.")
    elif default_bet != DEFAULT_BET:
        note(f"최소 베팅액 {minimum}칩에 맞춰 기본 배팅을 {default_bet}칩으로 올립니다.")

    while True:
        raw = ask(f"  보유 칩 {chips} · 기본 배팅 {default_bet}칩은 y, 금액을 직접 입력해도 됩니다 > ")
        if raw is None:
            return None
        if raw.lower() in ("y", "yes"):
            return default_bet
        if not (raw.isdigit() and int(raw) > 0):
            note("y 또는 1 이상의 숫자를 입력해주세요.")
            continue
        bet = int(raw)
        if bet < minimum:
            note(f"최소 {minimum}칩 이상 걸어야 합니다.")
            continue
        if bet > chips:
            note(f"보유 칩({chips})보다 많이 베팅할 수 없습니다.")
            continue
        return bet


def dealer_choose_bet(dealer_chips, player_chips, minimum=1, limit_ratio=None):
    """딜러 베팅: 보유 칩 범위 내 랜덤, 단 플레이어 보유 칩을 넘지 않는다.
    limit_ratio가 주어지면 그 비율까지만 건다(첫 판 선베팅 제한용)."""
    cap = min(dealer_chips, player_chips)
    if limit_ratio is not None:
        cap = max(1, int(cap * limit_ratio))
    low = max(1, minimum)
    if low >= cap:
        return min(low, dealer_chips)
    return random.randint(low, cap)


def dealer_raise(current, dealer_chips, player_chips, minimum):
    """딜러의 2차 베팅. minimum이 current보다 크면 반드시 따라간다."""
    if minimum > current:
        return dealer_choose_bet(dealer_chips, player_chips, minimum)
    if random.random() < 0.5:
        return current
    return dealer_choose_bet(dealer_chips, player_chips, current)


# --- 한 판 진행 ---

def choose_difficulty():
    """난이도를 고른다. 게임을 끝내거나 입력이 중단되면 None을 반환한다."""
    print("\n난이도를 선택하세요. (딜러의 시작 칩이 달라집니다)")
    for key, (name, amount) in DIFFICULTIES.items():
        print(f"  {key}. {name} (딜러 칩 {amount}개)")
    print("  0. 게임 종료")

    while True:
        raw = ask("번호 입력 > ")
        if raw is None:
            return None
        if raw == "0":
            return None
        if raw in DIFFICULTIES:
            return DIFFICULTIES[raw]
        print("0, 1, 2, 3 중에서 선택해주세요.")


def ask_double_down(chips, bet):
    """더블다운 또는 스탠드. 칩이 부족하면 더블다운은 제공하지 않는다."""
    if chips < bet * 2:
        note(f"{bet * 2}칩이 필요해 선택할 수 없습니다 -> 스탠드")
        return "s"

    while True:
        raw = ask(f"  더블다운(d, 베팅 {bet * 2}칩으로 2배 + 카드 1장) 또는 스탠드(s)? > ")
        if raw is None:
            return None
        raw = raw.lower()
        if raw in ("d", "s"):
            return raw
        note("d(더블다운) 또는 s(스탠드)를 입력해주세요.")


def settle(result, chips, dealer_chips, player_bet, dealer_bet, doubled=False):
    """이기면 딜러가 건 만큼 가져온다.
    단 더블다운으로 이겼다면 딜러 베팅액과 무관하게 (더블다운 금액, 딜러 베팅액) 중 큰 쪽을 가져오고,
    딜러 칩이 모자라면 남은 칩 전부만 가져온다."""
    before_chips, before_dealer = chips, dealer_chips

    if result == "win":
        gain = max(player_bet, dealer_bet) if doubled else dealer_bet
        gain = min(gain, dealer_chips)
        chips += gain
        dealer_chips -= gain
        delta = f"(+{gain})"
        if doubled and gain > dealer_bet:
            print(f"      더블다운 승리! 딜러 베팅액과 무관하게 {gain}칩을 가져옵니다.")
    elif result == "lose":
        chips -= player_bet
        dealer_chips += player_bet
        delta = f"(-{player_bet})"
    else:
        delta = "(변동 없음)"

    print(f"      플레이어  {before_chips} -> {chips}  {delta}")
    print(f"      딜러      {before_dealer} -> {dealer_chips}")
    return chips, dealer_chips


def play_round(stats, chips, dealer_chips, player_first, round_no=1):
    deck = new_deck()
    player = []
    player_ace_values = []
    dealer = []

    aborted = (False, chips, dealer_chips, None)

    print("\n" + "=" * 40)
    print(f"  {round_no}판  |  선베팅: {'플레이어' if player_first else '딜러'}")
    show_chips(chips, dealer_chips)
    print("=" * 40)

    # --- 첫 번째 카드 ---
    step(1, "첫 번째 카드")
    if not deal_card(deck, player, player_ace_values):
        return aborted
    deal_card(deck, dealer)
    show_hands(player, player_ace_values, dealer, hide_dealer=False)

    # --- 1차 베팅 ---
    step(2, "1차 베팅")
    if player_first:
        player_bet = ask_player_bet(chips, 1)
        if player_bet is None:
            return aborted
        dealer_bet = dealer_choose_bet(dealer_chips, chips, player_bet)
    else:
        # 첫 판에 딜러가 선베팅하면 판돈이 한 번에 커지지 않도록 상한의 절반까지만 건다.
        limit = FIRST_BET_LIMIT_RATIO if round_no == 1 else None
        dealer_bet = dealer_choose_bet(dealer_chips, chips, 1, limit)
        print(f"  딜러가 {dealer_bet}칩을 걸었습니다.")
        player_bet = ask_player_bet(chips, dealer_bet)
        if player_bet is None:
            return aborted
    print(f"  플레이어 {player_bet}칩   vs   딜러 {dealer_bet}칩")

    # --- 두 번째 카드 ---
    step(3, "두 번째 카드")
    if not deal_card(deck, player, player_ace_values):
        return aborted
    deal_card(deck, dealer)
    show_hands(player, player_ace_values, dealer, hide_dealer=True)

    # --- 2차 베팅 ---
    step(4, "2차 베팅")
    if player_bet >= chips or dealer_bet >= dealer_chips:
        note("한쪽이 올인이라 건너뜁니다")
    else:
        if player_first:
            # 1차에 이미 건 금액보다 낮출 수는 없다.
            player_bet = ask_player_bet(chips, player_bet)
            if player_bet is None:
                return aborted
            dealer_bet = dealer_raise(dealer_bet, dealer_chips, chips, player_bet)
        else:
            dealer_bet = dealer_raise(dealer_bet, dealer_chips, chips, dealer_bet)
            print(f"  딜러가 {dealer_bet}칩까지 걸었습니다.")
            player_bet = ask_player_bet(chips, max(player_bet, dealer_bet))
            if player_bet is None:
                return aborted
        print(f"  플레이어 {player_bet}칩   vs   딜러 {dealer_bet}칩")

    player_bj = is_player_blackjack(player, player_ace_values)
    dealer_bj = is_blackjack(dealer)
    doubled = False

    # --- 더블다운 / 스탠드 ---
    step(5, "더블다운")
    if player_bj or dealer_bj:
        note("블랙잭이 나와 바로 오픈합니다")
    else:
        choice = ask_double_down(chips, player_bet)
        if choice is None:
            return aborted
        if choice == "d":
            player_bet *= 2
            doubled = True
            print(f"  더블다운! 베팅 {player_bet}칩 — 이기면 딜러 베팅액과 무관하게 최대 {player_bet}칩을 가져옵니다.")
            if not deal_card(deck, player, player_ace_values):
                return aborted

    # --- 오픈 ---
    step(6, "오픈")
    show_hands(player, player_ace_values, dealer, hide_dealer=False, show_distance=True)

    player_total = player_hand_total(player, player_ace_values)
    dealer_total = hand_value(dealer)

    if player_bj or dealer_bj:
        if player_bj and dealer_bj:
            outcome = "둘 다 블랙잭! 무승부."
            result = "push"
        elif player_bj:
            outcome = "🃏 블랙잭! 플레이어 승리!"
            result = "win"
        else:
            outcome = "딜러 블랙잭. 플레이어 패배."
            result = "lose"
    elif player_total > BUST_LIMIT:
        outcome = f"플레이어 버스트! ({player_total} > {BUST_LIMIT}) 패배."
        result = "lose"
    elif dealer_total > BUST_LIMIT:
        outcome = f"딜러 버스트! ({dealer_total} > {BUST_LIMIT}) 플레이어 승리!"
        result = "win"
    else:
        player_dist = abs(21 - player_total)
        dealer_dist = abs(21 - dealer_total)
        if dealer_dist < player_dist:
            outcome = "딜러가 21에 더 가깝습니다. 플레이어 패배."
            result = "lose"
        elif dealer_dist > player_dist:
            outcome = "플레이어가 21에 더 가깝습니다. 플레이어 승리!"
            result = "win"
        else:
            outcome = "21과의 차이가 같습니다. 무승부."
            result = "push"

    print(f"\n  >>> {outcome}")
    stats[result] += 1
    chips, dealer_chips = settle(result, chips, dealer_chips, player_bet, dealer_bet, doubled)
    return True, chips, dealer_chips, result


def show_summary(stats, title):
    print(f"\n=== {title} ===\n승: {stats['win']}  패: {stats['lose']}  무승부: {stats['push']}")

    total_rounds = stats["win"] + stats["lose"] + stats["push"]
    if total_rounds > 0:
        win_rate = stats["win"] / total_rounds * 100
        print(f"승률: {win_rate:.1f}% ({stats['win']}/{total_rounds}판)")


def play_session(stats, dealer_chips):
    """한 난이도를 끝까지 플레이한다. 입력이 중단되면 False를 반환한다."""
    chips = 100
    round_no = 1

    print("\n첫 판의 선베팅 순서를 동전 던지기로 정합니다.")
    player_first = coin_toss()
    if player_first is None:
        return False

    while True:
        completed, chips, dealer_chips, result = play_round(
            stats, chips, dealer_chips, player_first, round_no)
        if not completed:
            return False
        round_no += 1

        if dealer_chips <= 0:
            print("\n🎉 딜러가 칩을 모두 잃었습니다! 최종 승리는 플레이어입니다!")
            show_summary(stats, "누적 전적")
            return True
        if chips <= 0:
            print("\n보유 칩이 모두 소진되었습니다.")
            show_summary(stats, "누적 전적")
            return True

        if result == "win":
            print("\n직전 판 승자인 플레이어가 선베팅합니다.")
            player_first = True
        elif result == "lose":
            print("\n직전 판 승자인 딜러가 선베팅합니다.")
            player_first = False
        else:
            print("\n무승부였으므로 선베팅 순서를 동전 던지기로 다시 정합니다.")
            player_first = coin_toss()
            if player_first is None:
                return False


def main():
    print("=== 블랙잭 ===")
    stats = {"win": 0, "lose": 0, "push": 0}

    while True:
        difficulty = choose_difficulty()
        if difficulty is None:
            break

        diff_name, dealer_chips = difficulty
        print(f"[{diff_name} 난이도] 딜러 시작 칩: {dealer_chips}  (플레이어 시작 칩: 100)")

        if not play_session(stats, dealer_chips):
            print("\n게임을 중단합니다.")
            break

        print("\n난이도 선택으로 돌아갑니다.")

    show_summary(stats, "최종 전적")


if __name__ == "__main__":
    main()
