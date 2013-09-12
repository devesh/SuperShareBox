function injectScript(file) {
    var s = document.createElement('script');
    s.src = chrome.extension.getURL(file);
    document.documentElement.insertBefore(s, document.documentElement.firstChild);
    s.parentNode.removeChild(s);
}

injectScript('js/inject.js');

var port = chrome.runtime.connect({name: "ssb"});
port.onMessage.addListener(function(response) {
    setTimeout(function() {
        window.postMessage(response, '*');
    }, 0);
});

// A relay to communicate between the script injected into the page and the extension's background page.
window.addEventListener("message", function(event) {
    // We only accept messages from ourselves
    if (event.source != window || !event.data.messageId || !event.data.message)
      return;

    port.postMessage(event.data);
}, false);

