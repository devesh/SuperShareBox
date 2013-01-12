// Injected onto the page.
if (!_XMLHttpRequest) {
    var XMLHttpRequestWrapper = function()
    {
        function isFunction(object) {
            return typeof(object) == 'function';
        }

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // XMLHttpRequestWrapper internal variables

        var xhrRequest = new _XMLHttpRequest(),
        self = this,
        synchronous = false,
        isPost = false,
        isCircles = false,
        friendLists = [],
        privacy;

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

        var makeCircle = function(id, name, noidea) {
            // I have no idea what that third argument is for.
            return [[id], [name,,,,,,,,,2,2,,noidea,0,1,1]];
        }

        var makeFriend = function(id, name, pic) {
            return [[,,id],[],[name,,,,,,,,pic],[[2,,['fblist:ALL_FRIENDS']]]];
        }

        var updateSelfProperties = function() {
            for (var propName in xhrRequest) {
                if (propName in updateSelfPropertiesIgnore) {
                    continue;
                }
                try {
                    var propValue = xhrRequest[propName];
                    if (propValue && !isFunction(propValue)) {
                        if (isCircles && (propName == 'responseText' || propName == 'response')) {
                            var startIndex = propValue.indexOf('[');
                            var circles = eval(propValue.substring(startIndex));
                            var publicCircle = makeCircle('fbstandard:EVERYONE', 'FB Group: Public', 'zfbpublic');
                            var friendsCircle = makeCircle('fblist:ALL_FRIENDS', 'FB Group: Friends', 'zfbfriends');
                            var fofCircle = makeCircle('fblist:FRIENDS_OF_FRIENDS', 'FB Group: Friends of Friends', 'zfbfof');
                            var selfCircle = makeCircle('fbstandard:SELF', 'FB Group: Self', 'zfbself');
                            circles[0][1][1].push(publicCircle, friendsCircle, fofCircle, selfCircle);
                            for (var i = ssbFriendLists.length; --i >= 0;) {
                                circles[0][1][1].push(makeCircle('fblist:' + ssbFriendLists[i].id, 'FB List: ' + ssbFriendLists[i].name, 'zfb' + ssbFriendLists[i].id));
                            }
                            for (var i = ssbFriends.length; --i >= 0;) {
                                circles[0][1][2].push(makeFriend('fb:'+ssbFriends[i].id, 'FB: ' + ssbFriends[i].name, 'https://graph.facebook.com/' + ssbFriends[i].id + '/picture'));
                            }
                            self[propName] = propValue.substring(0, startIndex) + JSON.stringify(circles);
                        } else {
                            self[propName] = propValue;
                        }
                    }
                }
                catch(E)
                {
                    console.log(propName, E.message);
                }
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
            if (isPost) {
                var createdPost = eval(xhrRequest.responseText.substring(xhrRequest.responseText.indexOf('[')));
                var postDetails = createdPost[0][1][1][0][0];
                var post = { type: 'SSB_POST' };
                post.privacy = privacy;
                post.friendLists = friendLists;
                post.user = postDetails[3];
                post.postText = postDetails[48] || postDetails[14];
                if (postDetails[11].length > 0) {
                    post.linkHeadline = unescape(postDetails[11][0][3]);
                    post.linkDescription = unescape(postDetails[11][0][21]);
                    if (((postDetails[11][1] || [])[41] || [])[0]) {
                        post.linkPic = postDetails[11][1][41][0][1];
                    }
                }
                post.pic = (postDetails[18] || '//lh5.googleusercontent.com/E4Mt_NjeN66Z1TAHbfRB5NuBDHlGbxr6eIoe5EPvZmM3QJmk9cWEOv1MKTyuM0iM0HYjnHjT');
                if (post.pic.indexOf('http') != 0) {
                    post.pic = 'https:' + post.pic;
                }
                post.postLink = 'https://plus.google.com/' + postDetails[21];
                if (privacy || friendLists.length) {
                    window.postMessage(post, '*');
                }
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
                    if ((postData[10][i] || [,''])[1].indexOf('fb:') == 0) {
                        postData[10].splice(i, 1);
                    }
                }
                // People and circle shares are in postData[37][0].
                for (var i = postData[37][0].length; --i >= 0;) {
                    if ((postData[37][0][i][1] || '').indexOf('fbstandard:') == 0) {
                        if (privacy) {
                            privacy = 'EVERYONE';
                        } else {
                            privacy = postData[37][0][i][1].substring(11);
                        }
                        postData[37][0].splice(i, 1);
                    } else if ((postData[37][0][i][1] || '').indexOf('fblist:') == 0) {
                        friendLists.push(postData[37][0][i][1].substring(7));
                        postData[37][0].splice(i, 1);
                    } else if ((postData[37][0][i][0] || [,,''])[2].indexOf('fb:') == 0) {
                        friendLists.push(postData[37][0][i][0][2].substring(3));
                        postData[37][0].splice(i, 1);
                    }
                }
                if (friendLists.length > 0) {
                    if (privacy === 'SELF') {
                        privacy = undefined;
                    } else if (privacy === 'EVERYONE') {
                        friendLists.length = 0;
                    }
                }
                if (postData[37][0].length == 0) {
                    alert('You must share to at least one non-Facebook circle to make the post visible on Google+.');
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
}
