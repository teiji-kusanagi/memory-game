// 使う絵柄（8種類 × 2枚 = 16枚）
const symbols = ["🍎", "🍌", "🍇", "🍓", "🍒", "🍑", "🍍", "🥝"];

// 画面の部品を取得
const board = document.getElementById("board");
const movesText = document.getElementById("moves");
const message = document.getElementById("message");
const resetButton = document.getElementById("reset");
const bestText = document.getElementById("best");
const timeText = document.getElementById("time");
const soundButton = document.getElementById("sound");
const BEST_KEY = "memoryGameBest";   // メモ帳に書くときの名前
const SOUND_KEY = "memoryGameSound"; // 音のオン・オフをメモ帳に書くときの名前

// ゲームの状態を覚えておく変数
let firstCard = null;   // 1枚目にめくったカード
let secondCard = null;  // 2枚目にめくったカード
let lock = false;       // 2枚を見比べている間はクリックを止める
let moves = 0;          // 手数
let matchedPairs = 0;   // そろったペアの数
let combo = 0;          // 連続でそろえた回数
let seconds = 0;        // 経過秒数
let timerId = null;     // 動いているタイマーの番号（止まっているときは null）
let flipBackId = null;  // 「裏返す」予約の番号（予約がないときは null）
let introTimerIds = []; // 登場演出の予約の番号をためておく
let mixSound = null;    // 鳴っている混ぜる音（鳴っていないときは null）

// 音を作るための作業台（最初にクリックしたときに作る。ゲームの状態ではないのでリセットしない）
let audioContext = null;
// 音を鳴らすかどうか（設定なのでリセットしない。メモ帳に "off" とあればオフで始める）
let soundOn = loadSoundSetting();

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
  // 裏返す予約が残っていたら取り消す
  clearTimeout(flipBackId);
  flipBackId = null;
  // 登場演出の予約や音が残っていたら片付ける
  clearIntro();
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
  stopTimer();
  seconds = 0;
  timeText.textContent = seconds;
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

  // カードを混ぜて並べる演出
  playIntro();
}

// 登場演出：中央に集まって混ざる（0.6秒）→ 左上から順に並ぶ（0.05秒おき）
function playIntro() {
  lock = true;   // 演出中はクリックさせない
  const cards = board.querySelectorAll(".card");

  // 盤面の真ん中の位置を測る
  const boardRect = board.getBoundingClientRect();
  const centerX = boardRect.left + boardRect.width / 2;
  const centerY = boardRect.top + boardRect.height / 2;

  // 1枚ずつ「真ん中までの距離」と「揺れ方」を覚えさせて、混ぜる動きを始める
  cards.forEach(function (card) {
    const rect = card.getBoundingClientRect();
    const dx = centerX - (rect.left + rect.width / 2);
    const dy = centerY - (rect.top + rect.height / 2);
    card.style.setProperty("--dx", dx + "px");
    card.style.setProperty("--dy", dy + "px");
    card.style.setProperty("--rot", (Math.random() * 40 - 20) + "deg");
    card.style.setProperty("--jx", (Math.random() * 30 - 15) + "px");
    card.style.setProperty("--jy", (Math.random() * 30 - 15) + "px");
    card.classList.add("mixing");
  });
  playMixSound();

  // 0.6秒後から、左上のカードから順に元の場所へ飛ばす
  cards.forEach(function (card, index) {
    const id = setTimeout(function () {
      card.classList.remove("mixing");
      card.classList.add("dealing");
      playDealSound();
    }, 600 + index * 50);
    introTimerIds.push(id);
  });

  // 最後のカードが着地したら（飛ぶのに0.1秒）、クリックできるようにする
  const endId = setTimeout(function () {
    lock = false;
    introTimerIds = [];
  }, 600 + (cards.length - 1) * 50 + 100);
  introTimerIds.push(endId);
}

// 登場演出の予約を全部取り消し、混ぜる音を止める
function clearIntro() {
  introTimerIds.forEach(function (id) {
    clearTimeout(id);
  });
  introTimerIds = [];
  if (mixSound !== null) {
    try {
      mixSound.stop();
    } catch (e) {
      // すでに止まっていても気にしない
    }
    mixSound = null;
  }
}

// カードがクリックされたときの処理
function flipCard() {
  // 見比べ中・すでに開いている・そろっているカードは無視
  if (lock) return;
  if (this.classList.contains("open")) return;

  // 最初の1枚でタイマーをスタート
  if (timerId === null) {
    startTimer();
  }

  this.classList.add("open");
  this.textContent = this.dataset.symbol;
  playFlipSound();

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
    playMatchSound();
    matchedPairs++;
    combo++;
    if (combo >= 2) {
      showCombo(combo);
    }
    firstCard = null;
    secondCard = null;

    if (matchedPairs === symbols.length) {
      stopTimer();
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
    flipBackId = setTimeout(function () {
      firstCard.classList.remove("open");
      secondCard.classList.remove("open");
      firstCard.textContent = "";
      secondCard.textContent = "";
      firstCard = null;
      secondCard = null;
      lock = false;
      flipBackId = null;
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

// タイマーを動かす（1秒ごとに数字を1増やす）
function startTimer() {
  timerId = setInterval(function () {
    seconds++;
    timeText.textContent = seconds;
  }, 1000);
}

// タイマーを止める
function stopTimer() {
  clearInterval(timerId);
  timerId = null;
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

// 音の作業台を用意して返す（音を鳴らせないときは null）
function getAudioContext() {
  // 音がオフなら鳴らさない
  if (!soundOn) return null;
  // ページを開いてからまだ一度も操作していないときは鳴らさない
  // （ブラウザの決まりで、操作の前は音を出せないため）
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  // 作業台がまだなければ作る
  if (audioContext === null) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// 音を1つ鳴らす
// frequency：音の高さ（大きいほど高い）、delay：鳴り始めるまでの秒数、duration：鳴らす長さ（秒）
function playTone(frequency, delay, duration) {
  try {
    // 音を鳴らせないときは何もしない
    if (getAudioContext() === null) return;
    const startTime = audioContext.currentTime + delay;

    const oscillator = audioContext.createOscillator();  // 発音器
    const gain = audioContext.createGain();              // 音量のつまみ
    oscillator.type = "sine";                            // やわらかい音
    oscillator.frequency.value = frequency;

    // 鳴り始めは少し大きく、そこからすっと小さくする
    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    // 発音器 → 音量のつまみ → スピーカー の順につなぐ
    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  } catch (e) {
    // 音が出せない環境でも、ゲームは止めない
  }
}

// カードをめくったときの「ピッ」
function playFlipSound() {
  playTone(880, 0, 0.1);
}

// ペアがそろったときの「ピロン♪」（低い音 → 高い音）
function playMatchSound() {
  playTone(660, 0.1, 0.15);
  playTone(990, 0.25, 0.25);
}

// カードを並べるときの1枚ごとの「トッ」
function playDealSound() {
  playTone(440, 0, 0.03);
}

// カードを混ぜるときの「シャカシャカ」（約0.5秒）
function playMixSound() {
  try {
    // 音を鳴らせないときは何もしない
    if (getAudioContext() === null) return;
    const duration = 0.5;

    // でたらめな数を並べて、ザーッという雑音を作る
    const length = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    // 高い音だけを通して、紙がこすれるような音にする
    const filter = audioContext.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2000;

    // 音量を0.1秒ごとに上げ下げして「シャカシャカ」にする
    const gain = audioContext.createGain();
    const startTime = audioContext.currentTime;
    gain.gain.setValueAtTime(0, startTime);
    for (let t = 0; t < duration; t += 0.1) {
      gain.gain.linearRampToValueAtTime(0.15, startTime + t + 0.03);
      gain.gain.linearRampToValueAtTime(0.02, startTime + t + 0.1);
    }
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    // 雑音 → 高い音だけ通す → 音量のつまみ → スピーカー の順につなぐ
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    source.start(startTime);
    source.stop(startTime + duration);

    // 「最初から」で止められるように覚えておく（鳴り終わったら忘れる）
    mixSound = source;
    source.onended = function () {
      if (mixSound === source) {
        mixSound = null;
      }
    };
  } catch (e) {
    // 音が出せない環境でも、ゲームは止めない
  }
}

// メモ帳から音の設定を読む（読めないときはオン）
function loadSoundSetting() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch (e) {
    return true;
  }
}

// 音のオン・オフを切り替えて、メモ帳に書く
function toggleSound() {
  soundOn = !soundOn;
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  } catch (e) {
    // 保存できない環境でも、切り替えはできる
  }
  showSoundButton();
}

// ボタンの文字を今の設定に合わせる
function showSoundButton() {
  soundButton.textContent = soundOn ? "音：オン" : "音：オフ";
}

resetButton.addEventListener("click", startGame);
soundButton.addEventListener("click", toggleSound);
showSoundButton();

// ページを開いたらゲーム開始
startGame();
