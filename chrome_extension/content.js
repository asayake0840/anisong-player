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
  const isUfret = location.hostname === "www.ufret.jp";

  // U-FRET：外部の広告枠とオーバーレイ広告を非表示にする（U-FRET自身の案内は残す）
  if (isUfret) {
    const st = document.createElement("style");
    st.textContent = `
      div:has(> div[id^="google_ads_iframe_"]), iframe[id^="google_ads_iframe_"],
      ins.adsbygoogle, ins#geniee_overlay_outer, [id^="div-gpt-ad"],
      [id^="gn_interstitial"], [class*="gn_interstitial"], tonefuse-ad { display: none !important; }
      html, body { overflow: visible !important; }`;   /* 割り込み広告でスクロールが止められないように */
    (document.head || document.documentElement).appendChild(st);
  }
  // U-FRET：形の決まっていない広告もまとめて消す
  //  ・コード譜と YouTube 以外の外部の埋め込み枠（iframe）を、それを包む「広告の箱」ごと非表示にする
  //  ・画面に固定表示された重なり順の高い要素（全画面広告など）を、サイトのメニュー以外は非表示にする
  function sweepAds() {
    if (!isUfret) return;
    const chord = document.getElementById("my-chord-data");
    const hide = (el) => el.style.setProperty("display", "none", "important");
    const shortText = (el) => (el.innerText || "").replace(/close|閉じる|広告|PR|スポンサー\S*|×|✕|\s/gi, "").length < 60;
    document.querySelectorAll("iframe").forEach((f) => {
      if (f.dataset.anisongChecked) return;
      if (chord && chord.contains(f)) return;
      const src = f.getAttribute("src") || "";
      if (/youtube\.com|youtube-nocookie\.com|ufret\.jp/.test(src)) return;
      f.dataset.anisongChecked = "1";
      let box = f;
      for (let p = f.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        if (chord && (p.contains(chord) || chord.contains(p))) break;
        if (p.matches("main, header, nav, footer, .l-main, .l-nav, .l-search, .l-header")) break;
        if (!shortText(p)) break;
        box = p;
      }
      hide(box);
    });
    document.querySelectorAll("body *").forEach((el) => {
      if (el.dataset.anisongFixed) return;
      const st = getComputedStyle(el);
      if (st.position !== "fixed" || (parseInt(st.zIndex, 10) || 0) < 10000) return;
      if (el.matches(".l-nav, .l-search, .l-header, header, nav, .remodal-wrapper, .remodal-overlay") || el.closest(".l-nav, .l-search, .l-header, .remodal-wrapper")) return;
      // 中に外部の埋め込み枠がある、または名前が広告らしいものだけ（サイト自身のダイアログは残す）
      const name = (el.id + " " + el.className).toString();
      if (!el.querySelector("iframe") && !/(^|[-_\s])(ad|ads|gn|geniee|interstitial|banner|sponsor|overlay_ad)([-_\s]|$)/i.test(name)) return;
      el.dataset.anisongFixed = "1";
      hide(el);
    });
  }
  if (isUfret) {
    sweepAds();
    new MutationObserver(() => { clearTimeout(sweepAds.t); sweepAds.t = setTimeout(sweepAds, 300); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
  // U-FRET：楽器（ギター／ウクレレ／ピアノ／ベース）の切り替え。ページ内の切り替えリンクを押す
  function setInstrument(name) {
    if (!isUfret || !/^(Guitar|Ukulele|Piano|Bass)$/.test(name)) return;
    const a = document.querySelector(`a[onclick*="show${name}Chords"]`);
    if (a) a.click();
  }

  function box() {
    // 歌ネット：歌詞の枠（id="kashi-box"、無ければ kashi_area）
    const k = document.getElementById("kashi-box") || document.getElementById("kashi_area");
    if (k) { const r = k.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; }
    // U-FRET：コード譜の部分
    const u = document.getElementById("my-chord-data");
    if (u) { const r = u.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; }
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
  // 動き出したことを知らせる（プレーヤー側で「拡張機能が動いているか」を表示するため）
  parent.postMessage({ type: "anisong-ext-hello", version: (self.chrome && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : "?", href: location.href }, parentOrigin);
  if (document.readyState === "complete") { if (!checkNoChord()) send(); }
  else addEventListener("load", () => { if (!checkNoChord()) send(); });
  let n = 0; const timer = setInterval(() => { send(); if (++n > 30) clearInterval(timer); }, 1000);
  new ResizeObserver(send).observe(document.documentElement);
  // プレーヤーから問い合わせがあったら送り直す
  addEventListener("message", (ev) => {
    if (ev.origin !== parentOrigin || !ev.data) return;
    if (ev.data.type === "anisong-lyrics-box?") { last = ""; if (!checkNoChord()) send(); }
    if (ev.data.type === "anisong-instrument") { setInstrument(ev.data.name); last = ""; setTimeout(send, 300); }
  });
})();
