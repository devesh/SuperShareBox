/*
 * Copyright 2013 Devesh Parekh All Rights Reserved.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Injects the XHR wrapper into the page and sets up a relay between that page
// and the background page, where all the communication to other social networks
// occurs.
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

