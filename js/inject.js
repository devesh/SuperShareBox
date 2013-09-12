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

// Injected into the page and running in the page's context. We wrap XHRs, so we can modify the
// responses.
(function(window) {
    /**
     * All the details about a post.
     *
     * @constructor
     * @struct
     * @param {string} postUrl The url of this post.
     * @param {string} text The text of the post.
     * @param {string} user The name of the poster.
     * @param {string} userPicUrl An image URL for the poster's profile picture.
     * @param {Array.<string>} people The ids of people to share the post with
     * @param {string=} linkUrl The link URL if the post contains a link.
     * @param {string=} linkHeadline The link headline if the post contains a link.
     * @param {string=} linkDescription The link description text if the post contains a link.
     * @param {string=} linkPic An image URL from the link if the post contains a link.
     */
    function SSBPost(postUrl, text, user, userPicUrl, people, linkUrl, linkHeadline, linkDescription, linkPic) {
        this.postUrl = postUrl;
        this.text = text;
        this.user = user;
        this.userPicUrl = userPicUrl;
        this.people = people;
        this.linkUrl = linkUrl;
        this.linkHeadline = linkHeadline;
        this.linkDescription = linkDescription;
        this.linkPic = linkPic;
    }

    var XMLHttpRequestWrapper = function() {
        function isFunction(object) {
            return typeof(object) == 'function';
        }

        // Communication with the content script.
        var callbacks = {};
        window.addEventListener('message', function(event) {
            // We only accept messages from ourselves for requests that we sent.
            if (event.source != window || !event.data.responseId || !callbacks[event.data.responseId])
                return;

            callbacks[event.data.responseId](event.data.response);
            delete callbacks[event.data.responseId];
        });
        function callExtension(message, callback) {
            var post = {
                messageId: Math.random(),
                message: message
            };
            if (callback) {
                callbacks[post.messageId] = callback;
            }
            window.postMessage(post, '*');
        }

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // XMLHttpRequestWrapper internal variables

        var xhrRequest = new _XMLHttpRequest(),
        self = this,
        synchronous = false,
        isPost = false,
        isCircles = false,
        friends = [],
        friendsToAdd,
        friendListsToAdd,
        circlesResponse;

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // XMLHttpRequestWrapper internal methods
        
        var updateSelfPropertiesIgnore = {
            abort: 1,
            channel: 1,
            getAllResponseHeaders: 1,
            getInterface: 1,
            getResponseHeader: 1,
            mozBackgroundRequest: 1,
            multipart: 1,
            onreadystatechange: 1,
            open: 1,
            send: 1,
            setRequestHeader: 1
        };

        var makeCircle = function(id, name) {
            return [[id], [name,,,,,,,,,2,2,,'z' + id,0,1,1]];
        }

        var makeFriend = function(id, name, friendLists, pic) {
            var friend = [[,,id],[],[name,,,,,,,,pic],[]];
            for (var i = friendLists.length; --i >= 0;) {
                friend[3].push([2,,[friendLists[i]]]);
            }
            return friend;
        }

        var readyToProcessCircles = function() {
            return (friendsToAdd && friendListsToAdd && circlesResponse);
        }

        var finishCircles = function() {
            if (readyToProcessCircles()) {
                var startIndex = circlesResponse.indexOf('[');
                var circles = eval(circlesResponse.substring(startIndex));
                for (var i = friendsToAdd.length; --i >= 0;) {
                    var friend = friendsToAdd[i];
                    circles[0][1][2].push(makeFriend(friend.id, friend.name, friend.friendLists, friend.picUrl));
                }
                for (var i = friendListsToAdd.length; --i >= 0;) {
                    var friendList = friendListsToAdd[i];
                    circles[0][1][1].push(makeCircle(friendList.id, friendList.name));
                }
                self.responseText = self.response = circlesResponse.substring(0, startIndex) + JSON.stringify(circles);
                self.readyState = 4;
                self.onreadystatechange();
            }
        }

        var updateSelfProperties = function() {
            for (var propName in xhrRequest) {
                if (propName in updateSelfPropertiesIgnore) {
                    continue;
                }
                try {
                    var propValue = xhrRequest[propName];
                    if (propValue && !isFunction(propValue)) {
                        self[propName] = propValue;
                    }
                }
                catch(E)
                {
                    console.log(propName, E.message);
                }
            }
            if (isCircles && self.readyState == 4) {
                self.readyState = 3;
                circlesResponse = self.responseText;
                finishCircles();
            }
        };
        
        var updateXHRPropertiesIgnore = {
            channel: 1,
            onreadystatechange: 1,
            readyState: 1,
            responseBody: 1,
            responseText: 1,
            responseXML: 1,
            status: 1,
            statusText: 1,
            upload: 1
        };

        var updateXHRProperties = function()
        {
            for (var propName in self)
            {
                if (propName in updateXHRPropertiesIgnore)
                    continue;
                try
                {
                    var propValue = self[propName];
                    if (propValue && !xhrRequest[propName])
                    {
                        xhrRequest[propName] = propValue;
                    }
                }
                catch(E)
                {
                    console.log(propName, E.message);
                }
            }
        };

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // XMLHttpRequestWrapper public properties and handlers

        this.readyState = 0;

        this.onreadystatechange = function(){};

        var entityMap = {
                '&amp;': '&',
                '&lt;': '<',
                '&gt;': '>',
                '&quot;': '"',
                '&#39;': "'",
                '&#47;': '/'
        };
        var entityRegex = new RegExp('(' + Object.keys(entityMap).join('|') + ')', 'g');
        var unescape = function(string) {
            if (string == null) return '';
            return ('' + string).replace(entityRegex, function(match) {
                return entityMap[match];
            });
        };

        var finishXHR = function() {
            if (isPost && friends.length) {
                var createdPost = eval(xhrRequest.responseText.substring(xhrRequest.responseText.indexOf('[')));
                var postDetails = createdPost[0][1][1][0][0];
                var userPicUrl = postDetails[18] || '//lh5.googleusercontent.com/E4Mt_NjeN66Z1TAHbfRB5NuBDHlGbxr6eIoe5EPvZmM3QJmk9cWEOv1MKTyuM0iM0HYjnHjT';
                if (userPicUrl.indexOf('http') != 0) {
                    userPicUrl = 'https:' + userPicUrl;
                }
                // 14 has the text with referenced people turned into @ strings.
                // 20 has the visible text (instead of @ strings).
                // 48 has the user's comment for a reshared post with referenced people turned into @ strings.
                // 47 has the user's comment for a reshared post marked up with HTML
                var post = new SSBPost('https://plus.google.com/' + postDetails[21], postDetails[47] ? postDetails[47].replace(/(<([^>]+)>)/ig,'') : postDetails[20], postDetails[3], userPicUrl, friends);
                if (postDetails[11].length > 0) {
                    post.linkHeadline = unescape(postDetails[11][0][3]);
                    post.linkDescription = unescape(postDetails[11][0][21]);
                    if (((postDetails[11][1] || [])[41] || [])[0]) {
                        // This is where pictures shared from normal web pages go.
                        post.linkPic = postDetails[11][1][41][0][1];
                    } else if ((postDetails[11][0][41] || [])[0]) {
                        // This is where YouTube thumbnail pictures and pictures from reshares go.
                        post.linkPic = postDetails[11][0][41][0][1];
                    }
                }
                callExtension(post);
            }
            updateSelfProperties();
        };

        var handleStateChange = function() {
            self.readyState = xhrRequest.readyState;
            if (xhrRequest.readyState == 4)
            {
                finishXHR();
                xhrRequest.onreadystatechange = function(){};
            }
            self.onreadystatechange();
        };

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // XMLHttpRequestWrapper public methods

        this.open = function(method, url, async, user, password) {
            updateSelfProperties();
            synchronous = !async;
            // If I don't copy url before calling indexOf, the onepick dialog doesn't work.
            // I don't know why.
            var uri = url.toString();
            if (uri.indexOf('_/sharebox/post') == 0) {
                isPost = true;
            } else if (uri.indexOf('socialgraph/lookup/circles') >= 0) {
                isCircles = true;
                callExtension('GET_FRIENDS', function(friends) {
                    friendsToAdd = friends;
                    finishCircles();
                });
                callExtension('GET_FRIENDLISTS', function(friendLists) {
                    friendListsToAdd = friendLists;
                    finishCircles();
                });
            } // TODO(devesh): Also handle socialgraph/lookup/hovercards.
            try {
                xhrRequest.open.apply(xhrRequest, arguments);
            } catch (e) {
            } finally {
                xhrRequest.onreadystatechange = handleStateChange;
            }
        };

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        this.send = function(data) {
            if (isPost) {
                var dataParts = data.split('&');
                var keyValue = dataParts[0].split('=');
                var postData = JSON.parse(decodeURIComponent(keyValue[1]));
                // For some reason, people shares are put in both postData[10] and postData[37][0].
                for (var i = postData[10].length; --i >= 0;) {
                    if ((postData[10][i] || [,''])[1].indexOf(':') >= 0) {
                        postData[10].splice(i, 1);
                    }
                }
                // People and circle shares are in postData[37][0].
                // Add the other networks' people and circles to friends, and remove them from the request, so Google+ doesn't see them.
                for (var i = postData[37][0].length; --i >= 0;) {
                    if ((postData[37][0][i][1] || '').indexOf(':') >= 0) {
                        friends.push(postData[37][0][i][1]);
                        postData[37][0].splice(i, 1);
                    } else if ((postData[37][0][i][0] || [,,''])[2].indexOf(':') >= 0) {
                        friends.push(postData[37][0][i][0][2]);
                        postData[37][0].splice(i, 1);
                    }
                }
                if (postData[37][0].length == 0) {
                    alert('You must share to at least one Google+ circle to make the post visible.');
                    self.readyState = 4;
                    self.status = 400;
                    self.responseText = self.response = 'Invalid';
                    setTimeout(self.onreadystatechange, 10);
                    return;
                }
                keyValue[1] = encodeURIComponent(JSON.stringify(postData));
                dataParts[0] = keyValue.join('=');
                data = dataParts.join('&');
            }
            updateXHRProperties();
            try {
                xhrRequest.send(data);
            } catch (e) {
            } finally {
                if (synchronous) {
                    self.readyState = xhrRequest.readyState;
                    try {
                        finishXHR();
                    } catch (e) {
                    }
	        }
            }
        };

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        this.setRequestHeader = function(header, value) {
            return xhrRequest.setRequestHeader(header, value);
        };

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        this.abort = function() {
            xhrRequest.abort();
            updateSelfProperties();
        };

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        this.getResponseHeader = function(header) {
            return xhrRequest.getResponseHeader(header);
        };

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        this.getAllResponseHeaders = function() {
            return xhrRequest.getAllResponseHeaders();
        };

        this.addEventListener = function(type, listener, useCapture) {
            return xhrRequest.addEventListener(type, listener, useCapture);
        };

        this.removeEventListener = function(type, listener, useCapture) {
            return xhrRequest.removeEventListener(type, listener, useCapture);
        };

        this.overrideMimeType = function(mime) {
            xhrRequest.overrideMimeType(mime);
        };

        this.dispatchEvent = function(event) {
            return xhrRequest.dispatchEvent(event);
        };

        return this;
    };

    var _XMLHttpRequest = XMLHttpRequest;
    window.XMLHttpRequest = function() {
        return new XMLHttpRequestWrapper();
    };
})(window);
