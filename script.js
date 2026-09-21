/* パケット便の旅 特別便：Wi-Fi開通ミッション 予行演習
   index.html / style.css / script.js の3ファイルだけで動きます（GitHub Pages対応） */
(() => {
'use strict';

/* =====================================================
   先生が変えてよいところ（練習用のSSID・キーなど）
   ===================================================== */
const CONFIG = {
  groupCount: 8,                 // 班の数
  ssidPrefix: 'PacketBin-',      // 練習用SSIDの頭。班番号が2ケタでつく（PacketBin-03）
  keyWords: ['Tsuru', 'Kame', 'Neko', 'Inu', 'Sakura', 'Momiji', 'Fuji', 'Umi'], // 班ごとのキーの頭
  keyMiddle: 'B0x',              // 0（ゼロ）とO（オー）の見まちがい練習のため、ゼロを入れておく
  keyBase: 7000,                 // キーの数字 = keyBase + 班番号 × keyStep
  keyStep: 111
};

/* =====================================================
   便利関数
   ===================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const pad2 = n => String(n).padStart(2, '0');

const ssidOf = g => CONFIG.ssidPrefix + pad2(g);
const keyOf = g => `${CONFIG.keyWords[(g - 1) % CONFIG.keyWords.length]}-${CONFIG.keyMiddle}-${CONFIG.keyBase + g * CONFIG.keyStep}`;
// 「1文字だけ違うキー」をつくる（0→O、1→l、なければ大文字小文字）
const mistype = k => {
  if (k.includes('0')) return k.replace('0', 'O');
  if (k.includes('1')) return k.replace('1', 'l');
  const c = k[0];
  return (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()) + k.slice(1);
};
const fmtKey = k => Array.from(k).map(c => /[0-9]/.test(c) ? `<span class="dg">${c}</span>` : esc(c)).join('');
const macIsPrivate = mac => '26AE'.includes(String(mac).charAt(1).toUpperCase());
const randMac = priv => {
  const b = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
  b[0] = priv ? ((b[0] & 0xFC) | 0x02) : (b[0] & 0xFC);
  return b.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(':');
};
const announce = t => {
  const l = $('#live');
  if (!l) return;
  l.textContent = '';
  setTimeout(() => { l.textContent = t; }, 30);
};

const LAYER = { phys: '物理', conf: '設定' };
const IDS = ['home', 'connect', 'check', 'trouble', 'note'];

/* =====================================================
   データ：用語・端末・点検・対処・依頼
   ===================================================== */
const TERMS = [
  ['ルーター', '班の配送センター', 'ネットワークの出入り口になる機械。端末からの荷物（データ）をインターネットへ送り出す。班のWi-Fiの電波もここから出る。'],
  ['SSID', '配送センターの看板', 'Wi-Fiの名前。一覧にたくさん出るので、自分の班のものを選ぶ。'],
  ['暗号化キー', '受け取りの合言葉', 'Wi-Fiのパスワード。合っていないと入れない。荷物の中身も暗号にして、のぞかれにくくする。'],
  ['電波', 'センターと端末をつなぐ道', '遠い・壁や机のかげがあると弱くなる。道がでこぼこだと、荷物が遅れたり届かなかったりする。'],
  ['IPアドレス', 'お届け先の住所', 'ネットワークの中で端末を見分ける番号。ルーターが貸してくれるので、場所が変わると変わる。'],
  ['MACアドレス', '端末についた製造番号', '通信部品ごとの識別番号。ふつうは変わらないが、最近の端末は隠す（ランダムにする）機能もある。'],
  ['DHCP', '住所を貸してくれる受付係', 'ルーターの中にいる係。つながった端末に、IPアドレスを自動で割り当てる。']
];

const NOTE_MENU = 'OSのバージョンで名前や場所が少し違います。見つからないときは「Wi-Fi」「ネットワーク」「詳細」「情報」の文字をたどってみよう。それでもだめなら先生か、近くの人に聞こう。';
const DEVICES = {
  iphone: {
    name: 'iPhone / iPad', priv: 'プライベートWi-Fiアドレス',
    rows: [['ssid', 'つないでいるWi-Fi'], ['ip', 'IPアドレス'], ['mask', 'サブネットマスク'], ['gw', 'ルーター'], ['dns', 'DNS'], ['mac', 'Wi-Fiアドレス']],
    steps: ['<b>設定</b>アプリを開いて、<b>Wi-Fi</b>をタップ', 'つながっているネットワーク名の右にある <b>ⓘ</b> をタップ', '<b>IPアドレス</b>・<b>サブネットマスク</b>・<b>ルーター</b>・<b>DNS</b>が並んでいる', '<b>Wi-Fiアドレス</b>がMACアドレス。「プライベートWi-Fiアドレス」がオンだと、このネットワーク専用のランダムな値が出る']
  },
  android: {
    name: 'Android', priv: 'ランダムMACを使う',
    rows: [['ssid', 'つないでいるWi-Fi'], ['ip', 'IPアドレス'], ['mask', 'サブネットマスク'], ['gw', 'ゲートウェイ'], ['dns', 'DNS 1'], ['mac', 'MACアドレス']],
    steps: ['<b>設定</b> →「ネットワークとインターネット」（機種により「接続」）→ <b>Wi-Fi</b>', 'つながっているネットワーク名の横の <b>⚙</b>（または名前）をタップ', '<b>詳細設定</b>を開くと、<b>IPアドレス</b>・<b>ゲートウェイ</b>・<b>DNS</b>などが出る', '<b>MACアドレス</b>は同じ画面か「端末情報」の中。「ランダムMAC」を使っていると、端末本来の値とは別の値が出る']
  },
  windows: {
    name: 'Windows', priv: 'ランダムなハードウェアアドレス',
    rows: [['ssid', 'SSID'], ['ip', 'IPv4 アドレス'], ['dns', 'IPv4 DNS サーバー'], ['mac', '物理アドレス (MAC)']],
    steps: ['<b>設定</b> →「ネットワークとインターネット」→ <b>Wi-Fi</b> → つながっているネットワークの<b>プロパティ</b>', '<b>IPv4 アドレス</b>と<b>物理アドレス (MAC)</b>を見る', 'ルーター（デフォルト ゲートウェイ）も見たいときは、<b>コマンドプロンプト</b>を開いて <b>ipconfig /all</b> と入力', '「ランダムなハードウェアアドレス」がオンだと、MACアドレスが変わることがある']
  },
  mac: {
    name: 'Mac', priv: 'プライベートWi-Fiアドレス',
    rows: [['ssid', 'ネットワーク名'], ['ip', 'IPアドレス'], ['mask', 'サブネットマスク'], ['gw', 'ルーター'], ['mac', 'MACアドレス']],
    steps: ['<b>システム設定</b> → <b>Wi-Fi</b> → つながっているネットワークの<b>詳細…</b>', '<b>TCP/IP</b>で、<b>IPアドレス</b>・<b>サブネットマスク</b>・<b>ルーター</b>を見る', '<b>ハードウェア</b>で<b>MACアドレス</b>を見る。「プライベートWi-Fiアドレス」の設定に注意']
  },
  chromebook: {
    name: 'Chromebook', priv: 'ランダムMAC',
    rows: [['ssid', 'ネットワーク'], ['ip', 'IPアドレス'], ['mask', 'サブネットマスク'], ['gw', 'ゲートウェイ'], ['dns', 'DNS'], ['mac', 'MACアドレス']],
    steps: ['画面右下の<b>時計</b> → <b>Wi-Fi</b>の表示 → つながっているネットワークをクリック', '<b>ネットワーク</b>の欄に、<b>IPアドレス</b>・<b>ゲートウェイ</b>・<b>DNS</b>などが出る', '<b>MACアドレス</b>は「設定」→「ネットワーク」→ Wi-Fiまわりの<b>詳細</b>にあることが多い']
  },
  other: {
    name: 'その他', priv: 'ランダムMAC',
    rows: [['ssid', 'ネットワーク名'], ['ip', 'IPアドレス'], ['mask', 'サブネットマスク'], ['gw', 'ゲートウェイ'], ['dns', 'DNS'], ['mac', 'MACアドレス（物理アドレス）']],
    steps: ['<b>設定</b> → <b>Wi-Fi（ネットワーク）</b> → つながっているネットワークの<b>詳細</b>を開く', '<b>IPアドレス</b>・<b>ゲートウェイ（ルーター）</b>・<b>MACアドレス（物理アドレス）</b>をさがす']
  }
};

const QTEXT = {
  ip: 'この端末がルーターから貸してもらった「お届け先の住所」は、どの行？',
  mac: 'この端末（の通信部品）についている「製造番号」のようなものは、どの行？',
  gw: '町の外へ荷物を出す「配送センターの窓口」（ルーター）の住所は、どの行？'
};
const QEXPL = {
  ip: 'IPアドレスは「お届け先の住所」。ルーターのDHCPが「今日はこの番地を使ってね」と貸してくれた値で、つなぎ先が変わると変わります。',
  mac: 'MACアドレスは端末の通信部品についた「製造番号」のようなもの。ただし最近のスマホは、Wi-Fiごとにランダムな値を使う機能があり、下のスイッチで変わる様子を見られます。',
  gw: 'ルーター（ゲートウェイ）は、町の外へ荷物を出す窓口。自分のIPアドレスと、先頭3組（例：192.168.3）が同じになるのがふつうです。',
  mask: 'サブネットマスクは「どこまでが町名か」を表す数字。255.255.255.0 なら、先頭3組が町名、最後の1組が番地です。',
  dns: 'DNSは「サイト名 → IPアドレス」を引く住所録の窓口。ふつうはルーターが代わりに受け付けます。',
  ssid: 'これは今つながっているSSID。配送センターの看板の名前です。'
};

const CHECKS = [
  { id: 'p1', layer: 'phys', short: 'ランプ', title: 'ルーターのランプと電源', how: 'ルーターの正面のランプ、電源ケーブル、電源スイッチを見る。' },
  { id: 'p2', layer: 'phys', short: 'Wi-Fiスイッチ', title: '端末のWi-Fiスイッチと機内モード', how: '端末の設定やコントロールセンターで、Wi-Fiと機内モードの状態を見る。' },
  { id: 'p3', layer: 'phys', short: '電波', title: 'Wi-Fi一覧と電波の強さ', how: 'Wi-Fi一覧に自分の班のSSIDが出ているか、電波が何本かを見る。' },
  { id: 'c1', layer: 'conf', short: 'SSID', title: 'つなごうとしているSSID', how: '選んだSSIDが、自分の班のシールのSSIDと同じかを見る。' },
  { id: 'c2', layer: 'conf', short: 'キー', title: '暗号化キー', how: '入力したキーを、シールのキーと1文字ずつ見比べる。' },
  { id: 'c3', layer: 'conf', short: 'IP設定', title: 'IPアドレスの設定', how: 'IPの取得方法（自動／手動）と、IPアドレスがルーターと同じ町かを見る。' }
];
const ST = { ok: '異常なし', ng: '異常あり', na: '確認できない' };

const ACTIONS = [
  { id: 'power', layer: 'phys', label: 'ルーターの電源ケーブルとスイッチを確認して、電源を入れる' },
  { id: 'airplane', layer: 'phys', label: '端末の機内モードをオフにして、Wi-Fiをオンにする' },
  { id: 'closer', layer: 'phys', label: 'ルーターに近づく・間の障害物をどける' },
  { id: 'ssid', layer: 'conf', label: '自分の班のSSIDを選び直す' },
  { id: 'key', layer: 'conf', label: '暗号化キーをシールと1文字ずつ見比べて、入れ直す' },
  { id: 'dhcp', layer: 'conf', label: 'IPアドレスの設定を「自動（DHCP）」に戻す' },
  { id: 'reboot', layer: 'none', label: 'とりあえず端末を再起動する' },
  { id: 'newkey', layer: 'none', label: 'ルーターの暗号化キーを別のものに変える' }
];

const SCENARIOS = [
  {
    id: 'power', title: 'SSIDが出てこない', label: 'ルーターの電源が切れていた', layer: 'phys', root: 'p1', fix: 'power',
    symptom: 'Wi-Fiの画面を開いても、班のSSIDがどこにも出てこない。',
    screen: { mark: '？', head: 'Wi-Fi', body: '班のネットワークを探しています…' },
    why: '電波を出しているのはルーター。電源が入っていなければ、SSIDそのものが空気中に存在しません。設定をいじる前に、まず「ルーターが生きているか」を見るのが物理の点検です。',
    induce: '班のルーターの電源ケーブルを抜く（または電源スイッチをOFFにする）。'
  },
  {
    id: 'airplane', title: 'ネットワークが1つもない', label: '端末が機内モードだった', layer: 'phys', root: 'p2', fix: 'airplane',
    symptom: 'Wi-Fiの一覧を開いても、ネットワークが1つも出てこない。',
    screen: { mark: '？', head: 'Wi-Fi', body: 'ネットワークが見つかりません' },
    why: 'ルーターが元気でも、受け取る側の端末が電波を止めていたら届きません。「端末側の物理スイッチ」も、物理の点検に入ります。',
    induce: '端末の機内モードをオンにする（Wi-Fiも一緒にオフになる）。'
  },
  {
    id: 'weak', title: 'つながったり切れたり', label: '電波が弱かった', layer: 'phys', root: 'p3', fix: 'closer',
    symptom: '班のSSIDは見えるのに、つながったり切れたりして、ページがなかなか開かない。',
    screen: { mark: '!', head: 'Wi-Fi', body: '接続が不安定です。ページを読み込み中…' },
    why: '電波は距離や壁、机のかげで弱くなります。道がでこぼこだと荷物が遅れたり、途中で落ちたりするのと同じ。近づく・遮るものをどけるのが直し方です。',
    induce: '端末をルーターから離れた場所へ持っていく（またはカバンの中に入れる）。'
  },
  {
    id: 'wrongkey', title: 'パスワードが違う①', label: '暗号化キーが1文字違っていた', layer: 'conf', root: 'c2', fix: 'key',
    symptom: '班のSSIDを選んでキーを入れたのに、「パスワードが正しくありません」と出る。',
    screen: { mark: '!', head: 'Wi-Fi', body: 'パスワードが正しくありません' },
    why: '暗号化キーは1文字でも違うと入れません。0（ゼロ）とO（オー）、1（いち）とl（エル）、大文字と小文字が定番のまちがいです。「表示」で入力を見て、シールと1文字ずつ見比べましょう。',
    induce: 'キーを1文字だけわざと間違えて入力する。'
  },
  {
    id: 'wrongssid', title: 'パスワードが違う②', label: '他の班のSSIDを選んでいた', layer: 'conf', root: 'c1', fix: 'ssid',
    symptom: 'シールのキーをそのまま入れているのに、「パスワードが正しくありません」と出続ける。何度やっても同じ。',
    screen: { mark: '!', head: 'Wi-Fi', body: 'パスワードが正しくありません' },
    why: 'SSIDは配送センターの名前。よく似た名前の他の班のSSIDに、自分の班のキーを入れても開きません。キーを疑う前に、「選んだSSIDは自分の班か」を見ます。',
    induce: '他の班のSSIDを選んで、自分の班のキーを入力する。'
  },
  {
    id: 'staticip', title: '接続済みなのに開かない', label: 'IPアドレスが手動で、別の町の住所だった', layer: 'conf', root: 'c3', fix: 'dhcp',
    symptom: 'Wi-Fiには「接続済み」と出ているのに、ブラウザでページが開かない。',
    screen: { mark: '!', head: 'Wi-Fi', body: '接続済み。インターネットに接続されていません' },
    why: 'IPアドレスは、ふつうDHCPが自動で貸してくれます。手動で別の町の住所を入れると、Wi-Fiにはつながっても荷物が届きません。「自動（DHCP）」に戻します。',
    induce: '端末のIP設定を「手動」にして、別のIPアドレス（例：10.0.0.25）を入力する。'
  }
];

const LISTS = [
  { title: '1 接続', items: [['c_wifi', 'Wi-Fiをオンにした'], ['c_ssid', '自分の班のSSIDを選んだ（他の班・鍵マークなしのWi-Fiではない）'], ['c_key', 'シールを見ながら、暗号化キーを1文字ずつ入れた'], ['c_join', '「接続済み」になった']] },
  { title: '2 確認', items: [['k_ip', 'IPアドレスを見つけて、書いた'], ['k_gw', 'ルーター（ゲートウェイ）のアドレスを書いた'], ['k_mac', 'MACアドレスを見つけて、書いた'], ['k_cmp', '班の仲間と比べた（町は同じ、番地とMACはちがう）']] },
  {
    title: '3 トラブルのとき', order: true,
    items: [['t1', '① ルーターのランプ・電源'], ['t2', '② 端末のWi-Fiスイッチ・機内モード'], ['t3', '③ 電波の強さ'], ['t4', '④ SSIDは自分の班？'], ['t5', '⑤ 暗号化キーは1文字ずつ合っている？'], ['t6', '⑥ IPは「自動（DHCP）」で、ルーターと同じ町？']]
  }
];

/* =====================================================
   状態（この端末のブラウザにだけ保存）
   ===================================================== */
const STORE_KEY = 'packet-wifi-practice-v1';
const blankRows = () => Array.from({ length: 5 }, () => ({ ip: '', mac: '' }));
function freshState() {
  return {
    group: 1, device: 'iphone',
    seed: { host: 20 + Math.floor(Math.random() * 180), macReal: randMac(false), macPriv: randMac(true) },
    progress: { connect: false, check: false, missions: {} },
    list: {},
    board: { gw: '', rows: blankRows() }
  };
}
function merge(base, extra) {
  for (const k in extra) {
    if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object') merge(base[k], extra[k]);
    else base[k] = extra[k];
  }
  return base;
}
let S = (() => {
  const s = freshState();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) merge(s, JSON.parse(raw));
  } catch (e) { /* 保存できない環境でも動く */ }
  s.group = Math.min(Math.max(parseInt(s.group, 10) || 1, 1), CONFIG.groupCount);
  if (!DEVICES[s.device]) s.device = 'iphone';
  if (!Array.isArray(s.board.rows)) s.board.rows = blankRows();
  while (s.board.rows.length < 5) s.board.rows.push({ ip: '', mac: '' });
  s.board.rows = s.board.rows.slice(0, 5).map(r => ({ ip: String((r && r.ip) || ''), mac: String((r && r.mac) || '') }));
  return s;
})();
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 何もしない */ } }

const dev = () => DEVICES[S.device];
function otherGroups() {
  const out = [];
  for (let i = 1; i <= CONFIG.groupCount && out.length < 2; i++) {
    const g = ((S.group - 1 + i) % CONFIG.groupCount) + 1;
    if (g !== S.group) out.push(g);
  }
  while (out.length < 2) out.push(S.group + out.length + 1);
  return out;
}
const doneCount = () => SCENARIOS.filter(sc => S.progress.missions[sc.id]).length;

/* =====================================================
   画面の切り替え（路線図ナビ）
   ===================================================== */
let cur = 0;
const stationDone = i => (i === 1 ? S.progress.connect : i === 2 ? S.progress.check : i === 3 ? doneCount() === SCENARIOS.length : false);
const PIN = ['出', '1', '2', '3', '記'];

function renderNav() {
  $$('#route li').forEach((li, i) => {
    const d = stationDone(i);
    li.classList.toggle('current', i === cur);
    li.classList.toggle('done', d);
    const b = $('.stop', li);
    if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    $('.pin', li).textContent = d ? '✓' : PIN[i];
  });
}
function go(i, scroll = true) {
  cur = i;
  $$('main > section.station').forEach((s, k) => { s.hidden = k !== i; });
  renderNav();
  if (i === 4) renderNotes();
  try { history.replaceState(null, '', '#' + IDS[i]); } catch (e) { /* file:// などでは無視 */ }
  if (scroll) {
    const h = $('main > section.station:not([hidden]) h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  if (scroll) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}

/* =====================================================
   0 出発
   ===================================================== */
function renderMe() { $('#meBtn').textContent = `${S.group}班・${dev().name}`; }
function renderTags() {
  $('#tagList').innerHTML = TERMS.map(([t, m, d]) =>
    `<li class="tagc"><h4>${esc(t)}</h4><p class="as">荷物でいうと：${esc(m)}</p><p>${esc(d)}</p></li>`).join('');
}
function initHome() {
  const sg = $('#selGroup'), sd = $('#selDevice');
  sg.innerHTML = Array.from({ length: CONFIG.groupCount }, (_, i) => `<option value="${i + 1}">${i + 1}班</option>`).join('');
  sd.innerHTML = Object.keys(DEVICES).map(k => `<option value="${k}">${esc(DEVICES[k].name)}</option>`).join('');
  sg.value = String(S.group);
  sd.value = S.device;
  sg.addEventListener('change', () => { S.group = +sg.value; save(); onProfile(); });
  sd.addEventListener('change', () => { S.device = sd.value; save(); B.done = {}; B.msg = ''; onProfile(); });
  renderMe();
}
function onProfile() {
  renderMe();
  resetA(); renderTasksA(); renderLabelA(); renderA();
  renderB();
  renderMission();
}

/* =====================================================
   1 接続：スマホ画面で練習
   ===================================================== */
const A = {};
function resetA() {
  A.token = (A.token || 0) + 1;
  Object.assign(A, { wifi: false, screen: 'list', target: null, tries: 0, err: '', show: false, val: '', stage: 0, warn: false, tasks: { wifi: false, ssid: false, key: false, join: false } });
}
const TASKS_A = [['wifi', 'Wi-Fiのスイッチをオンにする'], ['ssid', '自分の班のSSIDを選ぶ'], ['key', '暗号化キーを入れる'], ['join', 'つながって、IPアドレスをもらう']];
const STAGES_A = [['phys', '電波をつかまえた'], ['conf', '暗号化キーの確認OK'], ['conf', 'ルーターから住所（IPアドレス）を受け取った']];

const barsHtml = n => `<span class="bars b${n}" role="img" aria-label="電波${n}本"><i></i><i></i><i></i><i></i></span>`;
const lockHtml = '<svg class="lock" viewBox="0 0 16 16" role="img" aria-label="鍵あり"><use href="#i-lock" width="16" height="16"/></svg>';

function netsA() {
  const [o1, o2] = otherGroups();
  return [
    { ssid: ssidOf(o1), bars: 3, lock: true, kind: 'other' },
    { ssid: ssidOf(S.group), bars: 4, lock: true, kind: 'mine' },
    { ssid: 'Free_WiFi', bars: 3, lock: false, kind: 'open' },
    { ssid: ssidOf(o2), bars: 2, lock: true, kind: 'other' }
  ];
}
function renderTasksA() {
  $('#tasksA').innerHTML = TASKS_A.map(([k, t]) =>
    `<li class="${A.tasks[k] ? 'done' : ''}"><span class="chk" aria-hidden="true">${A.tasks[k] ? '✓' : ''}</span><span>${t}${A.tasks[k] ? '<span class="sr">（できた）</span>' : ''}</span></li>`).join('');
}
function renderLabelA() {
  $('#labelA').innerHTML = `<p class="slip-title">ルーターのシール（練習用）</p>
    <dl class="slip-body">
      <dt>SSID</dt><dd class="dm">${esc(ssidOf(S.group))}</dd>
      <dt>暗号化キー</dt><dd class="dm">${fmtKey(keyOf(S.group))}</dd>
      <dt>暗号化方式</dt><dd>WPA2-PSK</dd>
    </dl>
    <p class="slip-note">数字は<span class="dg">青</span>で表示しているよ。0（ゼロ）とO（オー）に注意！</p>`;
}
function renderA() {
  const el = $('#phoneA');
  if (!el) return;
  let html = '';
  if (A.screen === 'list') {
    html = `<div class="ph-bar"><span class="ph-title">Wi-Fi</span></div>
      <div class="ph-row"><span>Wi-Fi</span><button type="button" class="sw" role="switch" aria-checked="${A.wifi}" aria-label="Wi-Fi" data-act="a-toggle"><i></i></button></div>`;
    if (A.wifi) {
      html += `<p class="ph-cap">ネットワークを選択</p><ul class="netlist">${netsA().map(n =>
        `<li><button type="button" data-act="a-pick" data-ssid="${esc(n.ssid)}"><span class="nm">${esc(n.ssid)}</span><span class="ic">${n.lock ? lockHtml : ''}${barsHtml(n.bars)}</span></button></li>`).join('')}</ul>`;
    } else {
      html += '<p class="ph-empty">Wi-Fiがオフです。<br>上のスイッチをオンにしてみよう。</p>';
    }
    if (A.warn) {
      html += `<div class="ph-alert" role="alertdialog" aria-label="注意"><b>このWi-Fiは暗号化されていません</b>
        <p>鍵マークがないよ。通信の中身が、まわりの人にのぞかれるかもしれない。実習ではえらばないでね。</p>
        <button type="button" class="ph-btn" data-act="a-warnok">もどる</button></div>`;
    }
  } else if (A.screen === 'pw') {
    let hint = '';
    if (A.target.kind === 'other' && A.tries >= 1) hint = '<p class="ph-hint">ヒント：選んだSSIDは、自分の班のもの？ 名前をもう一度見てみよう。</p>';
    else if (A.target.kind === 'mine' && A.tries >= 2) hint = '<p class="ph-hint">ヒント：シールのキーと1文字ずつ見比べよう。0（ゼロ）とO（オー）、1（いち）とl（エル）、大文字と小文字に注意。「表示」を押すと、入力した文字が見えるよ。</p>';
    html = `<div class="ph-bar"><button type="button" class="ph-back" data-act="a-back">キャンセル</button><span class="ph-title" style="font-size:1.05rem">パスワード</span><span style="width:4.6em"></span></div>
      <p class="ph-ssid">「${esc(A.target.ssid)}」</p>
      <div class="pwbox"><input id="aPw" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="パスワードを入力" aria-label="パスワード"><button type="button" class="ph-btn ghost" id="aEye" data-act="a-eye">表示</button></div>
      <p class="ph-err" role="alert">${esc(A.err)}</p>${hint}
      <button type="button" class="ph-btn" data-act="a-join">接続</button>`;
  } else if (A.screen === 'connecting') {
    html = `<div class="ph-bar"><span class="ph-title" style="font-size:1.05rem">接続中…</span></div>
      <p class="ph-ssid">「${esc(A.target.ssid)}」</p>
      <ul class="stagelist">${STAGES_A.map(([k, t], i) =>
        `<li class="${A.stage > i ? 'on' : ''}"><span class="mk" aria-hidden="true">${A.stage > i ? '✓' : ''}</span><span><span class="lay ${k}">${LAYER[k]}</span>${t}</span></li>`).join('')}</ul>`;
  } else if (A.screen === 'done') {
    html = `<div class="ph-done"><div class="okmark" aria-hidden="true">✓</div>
      <b>${esc(A.target.ssid)}</b><p>接続済み</p>
      <p class="ph-hint">ルーターから住所（IPアドレス）が届きました。次の練習で、その住所を見つけに行こう。</p>
      <button type="button" class="btn primary" data-act="a-next">2 確認へ進む</button>
      <button type="button" class="ph-btn ghost" data-act="a-reset">もう一度やる</button></div>`;
  }
  el.innerHTML = html;
  if (A.screen === 'pw') { const i = $('#aPw'); if (i) { i.value = A.val; i.type = A.show ? 'text' : 'password'; } const e = $('#aEye'); if (e) e.textContent = A.show ? 'かくす' : '表示'; }
}
async function runJoin() {
  const my = ++A.token;
  A.screen = 'connecting'; A.stage = 0; renderA();
  for (let i = 1; i <= 3; i++) {
    await sleep(reduced ? 250 : 800);
    if (my !== A.token) return;
    A.stage = i; renderA();
  }
  await sleep(reduced ? 200 : 500);
  if (my !== A.token) return;
  A.screen = 'done'; A.tasks.join = true;
  S.progress.connect = true; save();
  renderA(); renderTasksA(); renderNav();
  announce('接続できました');
}

/* =====================================================
   2 確認：設定画面を読む練習 ＋ アドレス判定機
   ===================================================== */
const B = { priv: true, done: {}, msg: '', kind: '' };
const qsFor = d => ['ip', 'mac', 'gw'].filter(k => d.rows.some(r => r[0] === k));
function valsB() {
  const g = S.group;
  return { ssid: ssidOf(g), ip: `192.168.${g}.${S.seed.host}`, mask: '255.255.255.0', gw: `192.168.${g}.1`, dns: `192.168.${g}.1`, mac: B.priv ? S.seed.macPriv : S.seed.macReal };
}
function renderB() {
  const d = dev();
  $('#devTabs').innerHTML = Object.keys(DEVICES).map(k =>
    `<button type="button" class="tab" aria-pressed="${k === S.device}" data-act="dev" data-dev="${k}">${esc(DEVICES[k].name)}</button>`).join('');
  $('#devSteps').innerHTML = `<ol class="steps">${d.steps.map(s => `<li>${s}</li>`).join('')}</ol><p class="note">${NOTE_MENU}</p>`;

  // クイズ
  const qs = qsFor(d), curQ = qs.find(k => !B.done[k]);
  let q;
  if (curQ) {
    q = `<p class="quiz-q"><span class="quiz-n">問${qs.indexOf(curQ) + 1} / ${qs.length}</span>${QTEXT[curQ]}</p><p class="note" style="margin-top:0">右のスマホの画面で、その行をタップしてね。（${esc(d.name)}の画面です）</p>`;
  } else {
    q = `<p class="quiz-q">全問クリア！ 設定画面の読み方が分かったね。</p><p>ほかの行をタップすると、意味が読めます。下のスイッチも動かしてみよう。</p>
      <div class="btnrow"><button type="button" class="btn primary" data-go="3">3 トラブル練習へ</button></div>`;
  }
  if (B.msg) q += `<div class="fb ${B.kind}">${B.msg}</div>`;
  $('#quizB').innerHTML = q;

  // 設定画面
  const v = valsB();
  const rows = d.rows.map(([key, label]) => key === 'ssid'
    ? `<div class="setrow static"><span class="l">${esc(label)}</span><span class="v">${esc(v.ssid)}</span></div>`
    : `<button type="button" class="setrow${B.done[key] ? ' ok' : ''}" data-act="b-pick" data-key="${key}"><span class="l">${esc(label)}</span><span class="v">${esc(v[key])}</span></button>`).join('');
  const isP = macIsPrivate(v.mac);
  $('#phoneB').innerHTML = `<div class="ph-bar"><span class="ph-title" style="font-size:1.15rem">ネットワークの詳細</span></div>
    <div class="setrows">${rows}</div>
    <div class="ph-row"><span>${esc(d.priv)}</span><button type="button" class="sw" role="switch" aria-checked="${B.priv}" aria-label="${esc(d.priv)}" data-act="b-priv"><i></i></button></div>
    <p class="macnote">MACアドレスの2文字目が <b>2・6・A・E</b> なら、ランダムなアドレス。いまの2文字目は「<b>${esc(v.mac.charAt(1))}</b>」なので、${isP ? 'ランダムな値' : '端末本来の値'}のようです。</p>`;
}
function pickB(key) {
  const qs = qsFor(dev()), target = qs.find(k => !B.done[k]);
  const label = (dev().rows.find(r => r[0] === key) || [key, key])[1];
  if (!target) { B.msg = esc(QEXPL[key] || ''); B.kind = 'info'; }
  else if (key === target) {
    B.done[key] = true; B.msg = '<b>正解！</b> ' + esc(QEXPL[key]); B.kind = 'ok';
    if (qs.every(k => B.done[k])) { S.progress.check = true; save(); renderNav(); }
  } else {
    B.msg = `それは「${esc(label)}」の行。${esc(QEXPL[key] || '')} もういちど探してみよう。`; B.kind = 'ng';
  }
  renderB();
  announce(B.kind === 'ok' ? '正解です' : '');
}

/* --- アドレス判定機 --- */
const NAMES = ['自分', '仲間A', '仲間B', '仲間C', '仲間D'];
const parseIP = s => {
  const m = String(s).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.some(n => n > 255) ? null : o;
};
const isPrivateIP = o => o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168);
const normMac = s => String(s).trim().toUpperCase().replace(/-/g, ':');

function renderBoard() {
  $('#bdGw').value = S.board.gw;
  $('#bdRows').innerHTML = S.board.rows.map((r, i) =>
    `<tr><th scope="row">${NAMES[i]}</th>
      <td><input data-bd="ip" data-i="${i}" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${NAMES[i]}のIPアドレス" placeholder="192.168.3.24" value="${esc(r.ip)}"></td>
      <td><input data-bd="mac" data-i="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${NAMES[i]}のMACアドレス" placeholder="5E:3A:91:C2:07:1D" value="${esc(r.mac)}"></td></tr>`).join('');
}
function judgeBoard() {
  const out = [];
  const gwRaw = S.board.gw.trim(), gw = parseIP(gwRaw);
  if (gwRaw && !gw) out.push({ s: 'ng', t: `<b>ルーター</b>　「${esc(gwRaw)}」の形がちがいます。例：192.168.3.1` });
  const rows = S.board.rows.map((r, i) => ({ name: NAMES[i], ip: r.ip.trim(), mac: normMac(r.mac), macRaw: r.mac.trim() })).filter(r => r.ip || r.mac);
  if (!rows.length) return [{ s: 'na', t: 'どれか1行、入力してから「判定する」を押してね。' }];

  for (const r of rows) {
    if (r.ip) {
      const o = parseIP(r.ip);
      if (!o) out.push({ s: 'ng', t: `<b>${r.name}</b>　IPアドレス「${esc(r.ip)}」の形がちがいます。ドットで区切った4つの数字（0〜255）です。写し間違いがないか見直そう。例：192.168.3.24` });
      else if (o[0] === 169 && o[1] === 254) out.push({ s: 'ng', t: `<b>${r.name}</b>　169.254.x.x は、ルーターから住所をもらえなかったときに端末が自分でつける仮の住所です（DHCPの失敗）。まず<b>物理</b>（電源・電波）、次に<b>設定</b>（キー・IP設定）の順に調べよう。` });
      else if (o.every(x => x === 0)) out.push({ s: 'ng', t: `<b>${r.name}</b>　0.0.0.0 は「まだ住所がない」状態です。接続できているか確かめよう。` });
      else {
        if (!isPrivateIP(o)) out.push({ s: 'warn', t: `<b>${r.name}</b>　学校や家庭のルーターでは、192.168.x.x や 10.x.x.x などが多いです。写し間違いがないか見直そう。` });
        if (gw) {
          if (o.join('.') === gw.join('.')) out.push({ s: 'ng', t: `<b>${r.name}</b>　ルーターと同じ住所です。1つの住所を2台では使えません。写し間違いかも。` });
          else if (o[0] === gw[0] && o[1] === gw[1] && o[2] === gw[2]) out.push({ s: 'ok', t: `<b>${r.name}</b>　ルーターと同じ町（${gw.slice(0, 3).join('.')}）で、番地（${o[3]}）はちがう。正常な姿です。` });
          else out.push({ s: 'ng', t: `<b>${r.name}</b>　ルーターとちがう町の住所です（ルーター ${gw.slice(0, 3).join('.')}／${r.name} ${o.slice(0, 3).join('.')}）。IP設定が「手動」になっていないか確かめよう。` });
        } else out.push({ s: 'na', t: `<b>${r.name}</b>　ルーターのアドレスも入れると、同じ町かどうかを判定できます。` });
      }
    }
    if (r.mac) {
      if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(r.mac)) out.push({ s: 'ng', t: `<b>${r.name}</b>　MACアドレス「${esc(r.macRaw)}」の形がちがいます。0〜9とA〜Fの2文字を、:（コロン）でつないだ6組です。例：5E:3A:91:C2:07:1D` });
      else if (macIsPrivate(r.mac)) out.push({ s: 'warn', t: `<b>${r.name}</b>　2文字目が「${r.mac.charAt(1)}」なので、ランダムなMACアドレス（プライベートアドレス）のようです。端末本来の値とは別ものです。` });
      else out.push({ s: 'ok', t: `<b>${r.name}</b>　MACアドレスの形は正しいです。` });
    }
  }
  // かぶりチェック
  const dup = (key, fn, what) => {
    const seen = {};
    rows.forEach(r => { const v = fn(r); if (v) (seen[v] = seen[v] || []).push(r.name); });
    Object.keys(seen).forEach(v => { if (seen[v].length > 1) out.push({ s: 'ng', t: `<b>${seen[v].join('と')}</b>　${what}「${esc(v)}」がかぶっています。別の端末なら、ふつうは必ず別の値になります。写し間違いか、手動設定を疑おう。` }); });
  };
  dup('ip', r => (parseIP(r.ip) ? parseIP(r.ip).join('.') : ''), 'IPアドレス');
  dup('mac', r => (/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(r.mac) ? r.mac : ''), 'MACアドレス');

  const ipRows = rows.filter(r => parseIP(r.ip));
  if (gw && ipRows.length >= 2 && !out.some(x => x.s === 'ng')) {
    out.unshift({ s: 'ok', t: '<b>まとめ</b>　みんな同じ町にいて、番地とMACアドレスはバラバラ。これがふつうの姿です。' });
  } else if (rows.length === 1) {
    out.push({ s: 'na', t: '仲間の端末のぶんも入れると、比べられるよ。' });
  }
  return out;
}
const BADGE = { ok: 'OK', ng: '要確認', warn: '注意', na: 'メモ' };
function renderResult() {
  $('#bdResult').innerHTML = judgeBoard().map(x => `<li class="${x.s}"><span class="b">${BADGE[x.s]}</span><span>${x.t}</span></li>`).join('');
}

/* =====================================================
   3 トラブル：物理 → 設定 の順で切り分ける
   ===================================================== */
const M = { cur: null, examined: [], wrong: 0, hint: 0, solved: false, msg: '', kind: '' };
const physDone = () => ['p1', 'p2', 'p3'].every(id => M.examined.includes(id));
const ON = '#2FBF71', OFF = '#C9D3DC';

const lampsHtml = (p, w, n) => {
  const li = (t, on) => `<li><span class="lamp${on ? ' on' : ''}"></span>${t}：${on ? '点灯' : '消灯'}</li>`;
  return `<div class="evrow"><svg viewBox="0 0 120 90" style="--l1:${p ? ON : OFF};--l2:${w ? ON : OFF};--l3:${n ? ON : OFF}" role="img" aria-label="ルーターのランプ"><use href="#i-router" width="120" height="90"/></svg>
    <ul class="lamptxt">${li('電源', p)}${li('Wi-Fi', w)}${li('インターネット', n)}</ul></div>`;
};
const switchHtml = (label, on, bad) => `<div class="mini-sw"><span>${label}</span><span class="st${on ? (bad ? ' bad' : ' on') : ''}">${on ? 'オン' : 'オフ'}</span></div>`;
const netListHtml = list => `<ul class="evnets">${list.map(([ssid, bars, me]) =>
  `<li class="${me ? 'me' : ''}"><span class="dm">${esc(ssid)}${me ? '（自分の班）' : ''}</span>${barsHtml(bars)}</li>`).join('')}</ul>`;
const chSpan = (c, diff) => `<span class="ch${diff ? ' diff' : (/[0-9]/.test(c) ? ' dg' : '')}">${esc(c)}</span>`;
function cmpKey(label, typed) {
  const n = Math.max(label.length, typed.length);
  let l = '', t = '';
  for (let i = 0; i < n; i++) {
    const a = label[i] === undefined ? '' : label[i], b = typed[i] === undefined ? '' : typed[i], diff = a !== b;
    l += chSpan(a, diff); t += chSpan(b, diff);
  }
  return `<dl class="cmp"><dt>シールのキー</dt><dd class="dm">${l}</dd><dt>入力したキー</dt><dd class="dm">${t}</dd></dl>`;
}
const ipTable = (mode, ip, gw) => `<table class="iptable"><tr><th>IPの取得</th><td>${mode}</td></tr><tr><th>IPアドレス</th><td>${esc(ip)}</td></tr><tr><th>ルーター</th><td>${esc(gw)}</td></tr></table>`;

// 各点検で見つかる「証拠」を返す
function evidence(sc, cid) {
  const g = S.group, mine = ssidOf(g), key = keyOf(g), host = S.seed.host, id = sc.id;
  const [o1, o2] = otherGroups().map(ssidOf);
  const na = t => ({ st: 'na', html: '', text: t });
  switch (cid) {
    case 'p1':
      return id === 'power'
        ? { st: 'ng', html: lampsHtml(false, false, false), text: 'ランプが全部消えている。ルーターに電気が来ていないみたい。' }
        : { st: 'ok', html: lampsHtml(true, true, true), text: 'ランプが3つとも点灯している。ルーターは動いている。' };
    case 'p2':
      return id === 'airplane'
        ? { st: 'ng', html: switchHtml('Wi-Fi', false) + switchHtml('機内モード', true, true), text: '機内モードがオン。Wi-Fiの電波を受け取れない状態。' }
        : { st: 'ok', html: switchHtml('Wi-Fi', true) + switchHtml('機内モード', false), text: 'Wi-Fiはオン、機内モードはオフ。端末側のスイッチは正常。' };
    case 'p3':
      if (id === 'power') return { st: 'ng', html: netListHtml([[o1, 3], [o2, 2]]), text: '他の班のSSIDは見えるのに、自分の班のSSIDだけがない。' };
      if (id === 'airplane') return na('Wi-Fiがオフなので、一覧そのものが出ない。');
      if (id === 'weak') return { st: 'ng', html: netListHtml([[o1, 3], [mine, 1, true]]), text: '自分の班のSSIDは見えるが、電波が1本だけ。弱いと切れたり遅くなったりする。' };
      return { st: 'ok', html: netListHtml([[o1, 3], [mine, 4, true], [o2, 2]]), text: '自分の班のSSIDが見えていて、電波も強い（4本）。' };
    case 'c1':
      if (id === 'power' || id === 'airplane') return na('つなぐSSIDがまだ出ていないので、確認できない。');
      if (id === 'wrongssid') return { st: 'ng', html: `<p>つなごうとしたSSID：<span class="dm">${esc(o1)}</span></p><p>自分の班のSSID：<span class="dm">${esc(mine)}</span></p>`, text: '選んだSSIDが、自分の班のものではない（他の班のSSID）。' };
      return { st: 'ok', html: `<p>つないでいるSSID：<span class="dm">${esc(mine)}</span></p>`, text: '自分の班のSSIDを選べている。' };
    case 'c2':
      if (id === 'power' || id === 'airplane') return na('接続の手前で止まっているので、まだ確認できない。');
      if (id === 'wrongkey') return { st: 'ng', html: cmpKey(key, mistype(key)), text: 'シールのキーと、入力したキーが1文字ちがう（赤い文字）。' };
      return { st: 'ok', html: cmpKey(key, key), text: '入力したキーは、シールのキーと1文字ずつ同じ。' + (id === 'wrongssid' ? 'ただし、他の班のSSIDには自分の班のキーは使えない。' : '') };
    case 'c3':
      if (id === 'staticip') return { st: 'ng', html: ipTable('手動', '10.0.0.25', `192.168.${g}.1`), text: 'IPの設定が「手動」で、ルーターとちがう町の住所（10.0.0.x）が入っている。' };
      if (['power', 'airplane', 'wrongssid', 'wrongkey'].includes(id)) return na('まだ接続できていないので、IPアドレスももらえていない。');
      return { st: 'ok', html: ipTable('自動（DHCP）', `192.168.${g}.${host}`, `192.168.${g}.1`), text: `自動（DHCP）で、ルーターと同じ町（192.168.${g}）の住所をもらえている。` };
    default:
      return na('');
  }
}

function renderMissionList() {
  $('#missionList').innerHTML = SCENARIOS.map((sc, i) => {
    const d = S.progress.missions[sc.id];
    return `<li><button type="button" class="ticket${M.cur === i ? ' on' : ''}${d ? ' done' : ''}" data-act="c-pick" data-i="${i}" aria-pressed="${M.cur === i}">
      <span class="tno">依頼${i + 1}${d ? '　復旧ずみ' : ''}</span><span class="tt">${esc(sc.title)}</span>${d ? `<span class="tres">${esc(sc.label)}</span>` : ''}</button></li>`;
  }).join('');
}
function startMission(i) {
  Object.assign(M, { cur: i, examined: [], wrong: 0, hint: 0, solved: false, msg: '', kind: '' });
  renderMissionList(); renderMission();
}

function sceneHtml(sc) {
  const s = M.solved ? { mark: '✓', head: 'Wi-Fi', body: '接続済み。ページが開いた！', ok: true } : sc.screen;
  let style, cap;
  const allOn = `--l1:${ON};--l2:${ON};--l3:${ON}`, allOff = `--l1:${OFF};--l2:${OFF};--l3:${OFF}`;
  if (M.solved || (M.examined.includes('p1') && sc.id !== 'power')) { style = allOn; cap = 'ランプ：点灯'; }
  else if (M.examined.includes('p1')) { style = allOff; cap = 'ランプ：消灯'; }
  else { style = allOff; cap = 'ランプ：まだ見ていない'; }
  return `<div class="scene">
    <div class="bubble"><b>依頼${M.cur + 1}</b>${esc(sc.symptom)}</div>
    <div class="scene-art">
      <div class="phone"><div class="phone-screen"><div class="mk-big${s.ok ? ' ok' : ''}" aria-hidden="true">${s.mark}</div><p class="ph-head">${esc(s.head)}</p><p class="ph-msg">${esc(s.body)}</p></div></div>
      <div class="router-box"><svg viewBox="0 0 120 90" style="${style}" role="img" aria-label="班のルーター"><use href="#i-router" width="120" height="90"/></svg><span>班のルーター<br>${cap}</span></div>
    </div>
    <div class="road" aria-hidden="true">${M.solved ? '<svg class="truck go" viewBox="0 0 120 70"><use href="#i-truck" width="120" height="70"/></svg>' : ''}</div>
  </div>`;
}
function checkHtml(sc, c, locked) {
  const done = M.examined.includes(c.id), ev = done ? evidence(sc, c.id) : null;
  const badge = ev ? ST[ev.st] : (locked ? '通行止め' : '調べる');
  return `<li class="check ${ev ? ev.st : ''}">
    <button type="button" class="chk-btn" data-act="c-check" data-id="${c.id}"${locked ? ' aria-disabled="true"' : ''}><span>${esc(c.title)}</span><span class="cbadge">${badge}</span></button>
    ${ev ? `<div class="evid">${ev.html}<p class="evtext">${esc(ev.text)}</p></div>` : `<p class="how">${esc(c.how)}</p>`}</li>`;
}
function renderMission(focusSel) {
  const area = $('#missionArea');
  if (M.cur == null) {
    area.innerHTML = '<p class="empty">上の「依頼」から1つ選んでね。どれから始めてもOKです。</p>';
    return;
  }
  const sc = SCENARIOS[M.cur], pd = physDone();
  const board = `<div class="layer"><h4><span class="tag">物理</span>1段目　目で見て、さわって確かめる（電源・電波）</h4>
      <ul class="checks">${CHECKS.filter(c => c.layer === 'phys').map(c => checkHtml(sc, c, false)).join('')}</ul></div>
    <div class="layer"><h4><span class="tag conf">設定</span>2段目　画面で確かめる（キー・IP）</h4>
      ${pd ? '' : '<p class="gate"><span>通行止め：1段目の3つを見終えると通れます</span></p>'}
      <ul class="checks">${CHECKS.filter(c => c.layer === 'conf').map(c => checkHtml(sc, c, !pd)).join('')}</ul></div>`;
  const actions = `<div class="actions"><h4>直す</h4><p class="lead">原因の見当がついたら、直し方を1つ選ぼう。</p>
    <ul>${ACTIONS.map(a => {
      const lk = a.layer === 'conf' && !pd && !M.solved;
      return `<li><button type="button" class="act${lk ? ' locked' : ''}" data-act="c-fix" data-id="${a.id}"${M.solved ? ' disabled' : ''}>${esc(a.label)}${a.layer !== 'none' ? `<span class="tag mini${a.layer === 'conf' ? ' conf' : ''}">${LAYER[a.layer]}</span>` : ''}</button></li>`;
    }).join('')}</ul></div>`;
  const fb = M.msg ? `<div class="fb ${M.kind}">${M.msg}</div>` : '';
  const tools = M.solved ? '' : `<div class="tools"><button type="button" class="btn small" data-act="c-hint">ヒント</button><button type="button" class="btn small" data-act="c-retry">最初から調べ直す</button></div>`;
  let recap = '';
  if (M.solved) {
    const order = M.examined.map(id => CHECKS.find(c => c.id === id).short).join(' → ');
    const usedConf = M.examined.some(id => id.startsWith('c'));
    const isLast = doneCount() === SCENARIOS.length;
    recap = `<div class="recap"><div class="stamp">復旧！</div>
      <div class="rtext"><h4>原因：${esc(sc.label)}（${LAYER[sc.layer]}）</h4><p>${esc(sc.why)}</p>
      <p><b>調べた順番：</b>${esc(order)}<br>${usedConf ? '物理の点検が先で、設定はそのあと。いい順番です。' : '物理の段階で原因を見つけて、設定に進まずに直せました。むだのない切り分けです。'}</p>
      <p><b>本番で起こすには：</b>${esc(sc.induce)}</p></div>
      <button type="button" class="btn primary" data-act="c-next">${isLast ? '全部できた！ ノートへ' : '次の依頼へ'}</button></div>`;
  }
  area.innerHTML = `<div class="mission">${sceneHtml(sc)}<div class="work">${board}${actions}${fb}${tools}${recap}</div></div>`;
  if (focusSel) { const t = area.querySelector(focusSel); if (t) t.focus({ preventScroll: true }); }
  if (M.msg) announce(M.msg.replace(/<[^>]+>/g, ''));
}
function solve(sc) {
  M.solved = true; M.kind = ''; M.msg = '';
  S.progress.missions[sc.id] = true; save();
  renderNav(); renderMissionList(); renderMission();
  announce('復旧しました');
}

/* =====================================================
   4 ノート
   ===================================================== */
function renderNotes() {
  const n = doneCount(), total = SCENARIOS.length;
  const stamps = [['1 接続', S.progress.connect, 'まだ'], ['2 確認', S.progress.check, 'まだ'], ['3 復旧', n === total, `${n} / ${total}`]];
  $('#stampCard').innerHTML = stamps.map(([t, d, sub]) =>
    `<div class="stp${d ? ' got' : ''}"><span>${t}<small>${d ? '済み' : sub}</small></span></div>`).join('');
  $('#checklists').innerHTML = LISTS.map(l =>
    `<div class="cl"><p class="slip-title">${l.title}</p>${l.order ? '<p class="order">この順番で調べる：物理（①〜③）→ 設定（④〜⑥）</p>' : ''}
      <ul>${l.items.map(([id, t]) => `<li><label><input type="checkbox" data-cl="${id}"${S.list[id] ? ' checked' : ''}><span>${t}</span></label></li>`).join('')}</ul></div>`).join('');
}

/* =====================================================
   クリック操作（まとめて受け取る）
   ===================================================== */
const H = {
  // 1 接続
  'a-toggle'() { A.wifi = !A.wifi; if (A.wifi) A.tasks.wifi = true; renderTasksA(); renderA(); const s = $('#phoneA .sw'); if (s) s.focus(); },
  'a-pick'(el) {
    const n = netsA().find(x => x.ssid === el.dataset.ssid);
    if (!n) return;
    if (n.kind === 'open') { A.warn = true; renderA(); const b = $('#phoneA .ph-alert .ph-btn'); if (b) b.focus(); return; }
    A.target = n; A.screen = 'pw'; A.val = ''; A.err = ''; A.tries = 0; A.show = false;
    if (n.kind === 'mine') A.tasks.ssid = true;
    renderTasksA(); renderA();
    const i = $('#aPw'); if (i) i.focus();
  },
  'a-warnok'() { A.warn = false; renderA(); },
  'a-back'() { A.screen = 'list'; A.err = ''; renderA(); },
  'a-eye'(el) { A.show = !A.show; const i = $('#aPw'); if (i) i.type = A.show ? 'text' : 'password'; el.textContent = A.show ? 'かくす' : '表示'; },
  'a-join'() {
    if (!A.target) return;
    if (!A.val) { A.err = 'パスワードを入力してください。'; renderA(); const i = $('#aPw'); if (i) i.focus(); return; }
    if (A.target.kind === 'mine' && A.val === keyOf(S.group)) { A.err = ''; A.tasks.key = true; renderTasksA(); runJoin(); return; }
    A.tries++; A.err = 'パスワードが正しくありません。';
    renderA(); const i = $('#aPw'); if (i) i.focus();
  },
  'a-reset'() { resetA(); renderTasksA(); renderA(); },
  'a-next'() { go(2); },

  // 2 確認
  'dev'(el) { S.device = el.dataset.dev; save(); B.done = {}; B.msg = ''; $('#selDevice').value = S.device; renderMe(); renderB(); },
  'b-pick'(el) { pickB(el.dataset.key); },
  'b-priv'() { B.priv = !B.priv; renderB(); const s = $('#phoneB .sw'); if (s) s.focus(); },
  'bd-judge'() { renderResult(); },
  'bd-sample'() {
    S.board.gw = '192.168.3.1';
    S.board.rows = [
      { ip: '192.168.3.24', mac: '5E:3A:91:C2:07:1D' },
      { ip: '192.168.3.31', mac: 'A4:83:E7:5B:10:22' },
      { ip: '169.254.11.8', mac: '3C:22:FB:0E:9A:41' },
      { ip: '192.168.3.24', mac: '7A:10:5D:88:E3:C4' },
      { ip: '', mac: '' }
    ];
    save(); renderBoard(); renderResult();
  },
  'bd-clear'() { S.board = { gw: '', rows: blankRows() }; save(); renderBoard(); $('#bdResult').innerHTML = ''; },

  // 3 トラブル
  'c-pick'(el) { startMission(+el.dataset.i); },
  'c-random'() {
    const open = SCENARIOS.map((s, i) => i).filter(i => !S.progress.missions[SCENARIOS[i].id]);
    const pool = open.length ? open : SCENARIOS.map((s, i) => i);
    startMission(pool[Math.floor(Math.random() * pool.length)]);
  },
  'c-check'(el) {
    if (M.cur == null) return;
    const id = el.dataset.id, c = CHECKS.find(x => x.id === id);
    if (c.layer === 'conf' && !physDone()) {
      M.kind = 'ng'; M.msg = '<b>通行止め！</b> 設定を調べる前に、物理の3つ（ランプ・Wi-Fiスイッチ・電波）をぜんぶ見よう。';
      renderMission(`[data-act="c-check"][data-id="${id}"]`); return;
    }
    const before = physDone();
    if (!M.examined.includes(id)) M.examined.push(id);
    M.msg = ''; M.kind = '';
    if (!before && physDone()) { M.kind = 'info'; M.msg = '1段目を見終えた！ 通行止めが解除されたよ。'; }
    renderMission(`[data-act="c-check"][data-id="${id}"]`);
  },
  'c-fix'(el) {
    if (M.cur == null || M.solved) return;
    const sc = SCENARIOS[M.cur], act = ACTIONS.find(a => a.id === el.dataset.id);
    const say = (kind, msg) => { M.kind = kind; M.msg = msg; renderMission(`[data-act="c-fix"][data-id="${act.id}"]`); };
    if (!M.examined.length) return say('ng', 'まず点検しよう。証拠がないまま直すと、たまたま直っても、原因が分からないままだよ。');
    if (act.layer === 'conf' && !physDone()) return say('ng', '<b>通行止め！</b> 設定を直す前に、物理の3つをぜんぶ点検しよう。');
    if (act.id === sc.fix) {
      if (!M.examined.includes(sc.root)) return say('ng', 'その直し方が合っているか、点検メモにまだ証拠がないよ。点検を進めてから、もう一度選ぼう。');
      return solve(sc);
    }
    M.wrong++;
    if (act.id === 'reboot') return say('ng', '再起動で直ることもあるけれど、原因が分からないままだよ。点検メモの「異常あり」を見て、原因に合った直し方を選ぼう。');
    if (act.id === 'newkey') return say('ng', 'ルーターのキーを変えると、班の全員がつながらなくなるかも。原因が別のところにあるなら直らないよ。点検メモを見直そう。');
    say('ng', 'その直し方に合う「異常あり」は、点検メモにまだ見つかっていないよ。メモをもう一度見直そう。');
  },
  'c-hint'() {
    if (M.cur == null) return;
    const sc = SCENARIOS[M.cur];
    M.hint++;
    M.kind = 'info';
    M.msg = M.hint === 1
      ? `ヒント：原因は「${LAYER[sc.layer]}」の中にあるよ。`
      : `ヒント：「${CHECKS.find(c => c.id === sc.root).title}」の点検結果を見てみよう。`;
    renderMission();
  },
  'c-retry'() { if (M.cur != null) startMission(M.cur); },
  'c-next'() {
    const total = SCENARIOS.length;
    for (let k = 1; k <= total; k++) {
      const j = (M.cur + k) % total;
      if (!S.progress.missions[SCENARIOS[j].id]) { startMission(j); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
    }
    go(4);
  },

  // 4 ノート
  'n-print'() { window.print(); },
  'n-reset'() {
    if (window.confirm('練習の記録（スタンプ・チェック・入力した表）をぜんぶ消します。よいですか？')) {
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 何もしない */ }
      window.location.reload();
    }
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-go]');
  if (!el) return;
  if (el.dataset.go !== undefined) { go(+el.dataset.go); return; }
  const f = H[el.dataset.act];
  if (f) f(el, e);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'aPw') A.val = t.value;
  else if (t.id === 'bdGw') { S.board.gw = t.value; save(); }
  else if (t.dataset && t.dataset.bd) { S.board.rows[+t.dataset.i][t.dataset.bd] = t.value; save(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.cl) { S.list[t.dataset.cl] = t.checked; save(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'aPw') { e.preventDefault(); H['a-join'](); }
});
window.addEventListener('hashchange', () => {
  const i = IDS.indexOf(location.hash.slice(1));
  if (i >= 0 && i !== cur) go(i, false);
});

/* =====================================================
   はじめる
   ===================================================== */
function init() {
  initHome();
  renderTags();
  resetA(); renderTasksA(); renderLabelA(); renderA();
  renderB(); renderBoard();
  renderMissionList(); renderMission();
  renderNotes();
  const i = IDS.indexOf(location.hash.slice(1));
  go(i >= 0 ? i : 0, false);
}
init();
})();
