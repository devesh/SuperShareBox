var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-37177863-1']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

function privacyString(privacy, friendLists) {
    if (privacy) {
        return '{"value":"' + privacy + '"}';
    } else {
        return '{"value":"CUSTOM","allow":"' + friendLists +'"}';
    }
}

function cutString(s, n) {
    var cut= s.indexOf(' ', n);
    if(cut== -1) return s;
    return s.substring(0, cut) + '...';
}

var facebook = new OAuth2('facebook', {
    client_id: '524771387562499',
    api_scope: 'publish_stream,read_friendlists,read_stream'
});

function verifyPost(postId, privacy, friendLists) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if(xhr.status == 200) {
            var response = JSON.parse(xhr.responseText);
            var missing = false;
            var actualLists = response.privacy.allow.split(',');
            for (var i = friendLists.length; --i >= 0;) {
                if (actualLists.indexOf(friendLists[i]) < 0) {
                    missing = true;
                    break;
                }
            }
            if (privacy && privacy != response.privacy.value) {
                missing = true;
            }
            if (missing) {
                if (confirm('Posting to selected Facebook friends failed. Click on Super Share Box on the Facebook App Settings page, and set "Posts on your behalf:" to "Public".')) {
                    chrome.tabs.query(
                        { currentWindow: true, active: true },
                        function (tabArray) {
                            // Open a new tab for Facebook application settings.
                            chrome.tabs.create({url: 'https://www.facebook.com/settings/?tab=applications', openerTabId: tabArray[0].id});
                        });
                }
            }
        } else if (xhr.status == 400 || xhr.status == 401 || xhr.status == 403) {
            if (confirm("Post to Facebook failed. Please authorize Super Share Box to access Facebook and accept *all* permissions.")) {
                facebook.authorize(function() { verifyPost(postId) }, true);
            }
        } else {
            // TODO: Handle other errors.
            alert(xhr.responseText);
        }
    };
    xhr.open('GET', 'https://graph.facebook.com/' + postId);
    xhr.setRequestHeader('Authorization', 'OAuth ' + facebook.getAccessToken());
    xhr.send();
}

function makePost(request) {
    // Make an XHR that creates the task
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        _gaq.push(['_trackEvent', 'Facebook', 'Share', xhr.status.toString()]);
        if(xhr.status == 200) {
            // If Facebook was supposed to post it to more than just ourselves, make sure it did.
            if (request.privacy != 'SELF') {
                verifyPost(JSON.parse(xhr.responseText).id, request.privacy, request.friendLists);
            }
        } else if (xhr.status == 401 || xhr.status == 403) {
            if (confirm("Post to Facebook failed. Please reauthorize Super Share Box to access Facebook and accept all permissions.")) {
                facebook.authorize(function() { makePost(request) }, true);
            }
        } else {
            // TODO: Handle other errors.
            alert(xhr.responseText);
        }
    };
    xhr.open('POST', 'https://graph.facebook.com/me/feed', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'OAuth ' + facebook.getAccessToken());
    chrome.storage.sync.get('postSnippet', function(items) {
        var description = (items.postSnippet === false)
            ? 'Click this link to read my post.'
            : cutString(request.message, 50);
        var data = 'link=' + encodeURIComponent(request.link) + '&name=' + encodeURIComponent(request.user + ' ' + new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()) + '&caption=' + encodeURIComponent(request.link) + '&message=' + encodeURIComponent('I made a post on Google+. Click the link below to read it.') + '&privacy=' + encodeURIComponent(privacyString(request.privacy,request.friendLists)) + '&picture=' + encodeURIComponent(request.pic) + '&description=' + encodeURIComponent(description);
        xhr.send(data);
    });
}

chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.type == 'POST') {
            facebook.authorize(function() { makePost(request) });
        }
    });
