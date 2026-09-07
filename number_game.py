"""숫자 맞추기 게임: 난이도에 맞는 범위의 랜덤 숫자를 맞춰보세요."""

import random

DIFFICULTIES = {
    "1": ("쉬움", 1, 50),
    "2": ("보통", 1, 100),
    "3": ("어려움", 1, 200),
}


def ask(prompt):
    """입력을 받되, Ctrl+C나 입력 종료(EOF)는 조용히 종료 신호로 바꾼다."""
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return None


def choose_difficulty():
    print("난이도를 선택하세요.")
    for key, (name, low, high) in DIFFICULTIES.items():
        print(f"  {key}. {name} ({low}~{high})")

    while True:
        raw = ask("번호 입력 > ")
        if raw is None:
            return None
        if raw in DIFFICULTIES:
            return DIFFICULTIES[raw]
        print("1, 2, 3 중에서 선택해주세요.")


def play(low, high):
    answer = random.randint(low, high)
    tries = 0

    print(f"{low}부터 {high} 사이의 숫자를 맞춰보세요! (종료: q)")

    while True:
        raw = ask("숫자 입력 > ")

        if raw is None or raw.lower() in ("q", "quit", "exit"):
            print(f"게임을 종료합니다. 정답은 {answer}였어요.")
            return

        if not raw.lstrip("-").isdigit():
            print("숫자만 입력해주세요.")
            continue

        guess = int(raw)
        if not low <= guess <= high:
            print(f"{low}~{high} 사이의 숫자를 입력해주세요.")
            continue

        tries += 1

        if guess < answer:
            print("더 큰 수!")
        elif guess > answer:
            print("더 작은 수!")
        else:
            print(f"정답입니다! {tries}번 만에 맞추셨어요. 🎉")
            return


def main():
    while True:
        difficulty = choose_difficulty()
        if difficulty is None:
            print("안녕히 가세요!")
            break

        name, low, high = difficulty
        print(f"[{name} 난이도] 게임을 시작합니다.")
        play(low, high)

        again = ask("한 판 더 하시겠어요? (y/n) > ")
        if again is None or again.lower() not in ("y", "yes"):
            print("안녕히 가세요!")
            break


if __name__ == "__main__":
    main()
