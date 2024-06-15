// ==UserScript==
// @name         HNhance
// @namespace    elpocko
// @version      1
// @description  Hacker News Enhancer
// @icon         https://news.ycombinator.com/favicon.ico
// @author       elpocko
// @match        https://news.ycombinator.com/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
    // I use this as a proxy during development to load the actual userscript from a local webserver.
    // This way I can edit the code in my normal editor.
    unsafeWindow.GM_getValue = GM_getValue
    unsafeWindow.GM_setValue = GM_setValue

    GM.xmlHttpRequest({
        method: 'GET',
        url: `http://127.0.0.1:8000/index.js?ts=${Date.now()}`,
        onload: response => {
            const remoteScript = document.createElement('script')
            remoteScript.textContent = response.responseText
            document.body.appendChild(remoteScript)
        }
    })
})();