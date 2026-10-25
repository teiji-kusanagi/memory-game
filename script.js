// 使う絵柄（8種類 × 2枚 = 16枚）
const symbols = ["🍎", "🍌", "🍇", "🍓", "🍒", "🍑", "🍍", "🥝"];

// 画面の部品を取得
const board = document.getElementById("board");
const movesText = document.getElementById("moves");
const message = document.getElementById("message");
const resetButton = document.getElementById("reset");
const bestText = document.getElementById("best");
const BEST_KEY = "memoryGameBest";   // メモ帳に書くときの名前

// ゲームの状態を覚えておく変数
let firstCard = null;   // 1枚目にめくったカード
let secondCard = null;  // 2枚目にめくったカード
let lock = false;       // 2枚を見比べている間はクリックを止める
let moves = 0;          // 手数
let matchedPairs = 0;   // そろったペアの数
let combo = 0;          // 連続でそろえた回数

// 配列をシャッフルする（フィッシャー–イェーツ法）
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ゲームを最初から始める
function startGame() {
  board.innerHTML = "";
  message.textContent = "";
  message.classList.remove("too-many");
  firstCard = null;
  secondCard = null;
  lock = false;
  moves = 0;
  matchedPairs = 0;
  combo = 0;
  movesText.textContent = moves;
  showBest();

  // 絵柄を2枚ずつ用意して混ぜる
  const deck = shuffle([...symbols, ...symbols]);

  // カードを1枚ずつ作って盤面に置く
  deck.forEach(function (symbol) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.symbol = symbol;   // 絵柄をカードに覚えさせる
    card.addEventListener("click", flipCard);
    board.appendChild(card);
  });
}

// カードがクリックされたときの処理
function flipCard() {
  // 見比べ中・すでに開いている・そろっているカードは無視
  if (lock) return;
  if (this.classList.contains("open")) return;

  this.classList.add("open");
  this.textContent = this.dataset.symbol;

  if (firstCard === null) {
    firstCard = this;   // 1枚目
    return;
  }

  secondCard = this;    // 2枚目
  moves++;
  movesText.textContent = moves;
  checkMatch();
}

// 2枚がそろっているか調べる
function checkMatch() {
  if (firstCard.dataset.symbol === secondCard.dataset.symbol) {
    // そろった！
    firstCard.classList.add("matched");
    secondCard.classList.add("matched");
    matchedPairs++;
    combo++;
    if (combo >= 2) {
      showCombo(combo);
    }
    firstCard = null;
    secondCard = null;

    if (matchedPairs === symbols.length) {
      const best = getBest();
      if (best === null || moves < best) {
        saveBest(moves);
        showBest();
        message.textContent = "新記録！ " + moves + "手でクリア！";
      } else {
        message.textContent = "クリア！ " + moves + "手でした";
      }
      if (moves > 20) {
        message.classList.add("too-many");
      }
    }
  } else {
    // ハズレ：少し見せてから裏返す
    combo = 0;
    lock = true;
    setTimeout(function () {
      firstCard.classList.remove("open");
      secondCard.classList.remove("open");
      firstCard.textContent = "";
      secondCard.textContent = "";
      firstCard = null;
      secondCard = null;
      lock = false;
    }, 800);
  }
}

// メモ帳から最少手数を読む（なければ null）
function getBest() {
  try {
    const value = localStorage.getItem(BEST_KEY);
    return value === null ? null : Number(value);
  } catch (e) {
    return null;
  }
}

// メモ帳に最少手数を書く
function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, value);
  } catch (e) {
    // 保存できない環境でも、ゲームは止めない
  }
}

// 画面の「最少」欄を更新する
function showBest() {
  const best = getBest();
  bestText.textContent = best === null ? "-" : best;
}

// コンボ演出を表示する
function showCombo(count) {
  const effect = document.createElement("div");
  effect.className = "combo-effect";
  effect.textContent = count + " 連続!";
  document.body.appendChild(effect);

  // アニメーションが終わる頃に消す
  setTimeout(function () {
    effect.remove();
  }, 1000);
}

resetButton.addEventListener("click", startGame);

// ページを開いたらゲーム開始
startGame();
