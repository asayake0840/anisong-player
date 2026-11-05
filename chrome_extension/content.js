// アニソンプレーヤーの歌詞パネル（iframe）で開かれたときだけ動く。
// 歌詞部分の上端・下端の位置（数値）と、コード譜の有無だけを親ページに送る。ページの内容は送らない・変更しない。
(() => {
  if (window.top === window) return;                       // 普通にタブで開いたときは何もしない
  let parentOrigin = "";
  try {
    parentOrigin = (location.ancestorOrigins && location.ancestorOrigins[0]) || new URL(document.referrer).origin;
  } catch (e) { return; }
  // プレーヤー（ローカル起動版・GitHub Pages 版）に埋め込まれたときだけ動く
  const PLAYERS = /^(http:\/\/(localhost|127\.0\.0\.1)(:\d+)?|https:\/\/asayake0840\.github\.io)$/;
  if (!PLAYERS.test(parentOrigin)) return;

  const isUtaChord = location.hostname === "www.uta-net.com" && location.pathname.startsWith("/chord/");

  function box() {
    // 歌ネット：歌詞の枠（id="kashi-box"、無ければ kashi_area）
    const k = document.getElementById("kashi-box") || document.getElementById("kashi_area");
    if (k) { const r = k.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; }
    // ChordWiki：歌詞とコードが入っている body > div.main の最初と最後
    const m = document.querySelector("body > div.main");
    if (m) { const r = m.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; }
    return null;
  }
  let last = "";
  function send() {
    const b = box();
    if (!b) return;
    const msg = { type: "anisong-lyrics-box", href: location.href, top: Math.round(b.top), bottom: Math.round(b.bottom) };
    const key = msg.top + ":" + msg.bottom;
    if (key === last) return;                                 // 位置が変わったときだけ送る（広告の読み込みでずれる）
    last = key;
    parent.postMessage(msg, parentOrigin);
  }
  // 歌ネットのコード譜ページが無い曲（同じアドレスで「見つかりません」の画面になる）を知らせる
  function checkNoChord() {
    if (isUtaChord && !document.getElementById("kashi-box") && !document.getElementById("kashi_area")) {
      parent.postMessage({ type: "anisong-no-chord", href: location.href }, parentOrigin);
      return true;
    }
    return false;
  }
  if (document.readyState === "complete") { if (!checkNoChord()) send(); }
  else addEventListener("load", () => { if (!checkNoChord()) send(); });
  let n = 0; const timer = setInterval(() => { send(); if (++n > 30) clearInterval(timer); }, 1000);
  new ResizeObserver(send).observe(document.documentElement);
  // プレーヤーから問い合わせがあったら送り直す
  addEventListener("message", (ev) => {
    if (ev.origin === parentOrigin && ev.data && ev.data.type === "anisong-lyrics-box?") {
      last = ""; if (!checkNoChord()) send();
    }
  });
})();
