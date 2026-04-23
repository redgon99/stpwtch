(function () {
  "use strict";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js", { scope: "./" })
      .catch(function () {});
  }

  var el = document.getElementById("installButton");
  if (!el) {
    return;
  }

  var isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    el.hidden = true;
    return;
  }

  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  el.addEventListener("click", function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice
        .then(function () {
          deferredPrompt = null;
        })
        .catch(function () {});
      return;
    }
    window.alert(
      "이 브라우저/환경에서는 자동 설치가 보이지 않을 수 있습니다.\n\n" +
        "· Chrome, Edge(데스크톱/안드): 주소창의 설치 아이콘(⊕) 또는 메뉴(⋮) > '앱 설치'\n" +
        "· Safari(iOS): 공유(□↑) > '홈 화면에 추가'"
    );
  });
})();
