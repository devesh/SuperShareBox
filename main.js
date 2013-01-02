readFriends(function(friends) {
    chrome.storage.sync.get('friendLists', function(items) {
        var fl = document.createElement('script');
        fl.innerText = 'var ssbFriendLists = ' + JSON.stringify(items.friendLists || [])
            + ';var ssbFriends = ' + JSON.stringify(friends) + ';';
        document.documentElement.insertBefore(fl, document.documentElement.firstChild);
        fl.parentNode.removeChild(fl);
    });
});

var s = document.createElement('script');
s.src = chrome.extension.getURL('inject.js');
document.documentElement.insertBefore(s, document.documentElement.firstChild);
s.parentNode.removeChild(s);

// A relay to communicate between the script injected into the page and the extension's background page.
window.addEventListener("message", function(event) {
    // We only accept messages from ourselves
    if (event.source != window)
      return;

    chrome.extension.sendMessage(event.data);
}, false);

