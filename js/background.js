/**
 * @constructor
 * @struct
 * @param {string} id The id of this friend in the network.
 * @param {string} name The name of this friend.
 * @param {string} picUrl The URL of the profile picture for this friend.
 * @param {Array.<string>} friendLists The friendList ids that this friend belongs to, null means empty.
 */
function SSBFriend(id, name, picUrl, friendLists) {
    this.id = id;
    this.name = name;
    this.picUrl = picUrl;
    this.friendLists = friendLists || [];
}

/**
 * @constructor
 * @struct
 * @param {string} id The id of this friend in the network.
 * @param {string} name The name of this friend list.
 * @param {string} picUrl The URL of the profile picture for this friend.
 * @param {Array.<string>} friendLists The friendList ids that this friend belongs to, null means empty.
 */
function SSBFriendList(id, name) {
    this.id = id;
    this.name = name;
}

// This needs to be kept in sync with its definition in inject.js. I'd like to share this
// definition, but I don't know how without polluting window.
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

// TODO(devesh): Move the stuff common to Background and Options out.
angular.module('Background', [])
    .value('GA', analytics.getService('SuperShareBox'))
    .factory('Tracker', function(GA) {
        return GA.getTracker('UA-37177863-2');
    })
    .factory('Storage', function($q, $timeout) {
        return {
            get: function(key) {
                var deferred = $q.defer();
                chrome.storage.sync.get(key, function(items) {
                    $timeout(function() {
                        deferred.resolve(items[key]);
                    });
                });
                return deferred.promise;
            },
            set: function(key, value) {
                var values = {};
                values[key] = value;
                chrome.storage.sync.set(values);
            },
        };
    })
    .factory('Settings', function(Storage) {
        return {
            get: function() {
                return Storage.get('settings').then(function(settings) {
                    settings = settings || {};
                    // Set defaults.
                    settings.enabledNetworks = settings.enabledNetworks || {};
                    settings.truncateLength = (settings.truncateLength === undefined) ? 100 : settings.truncateLength;
                    return settings;
                });
            },
            set: function(settings) {
                Storage.set('settings', settings);
            }
        };
    })
    .factory('Networks', function($q, $http, $timeout, Settings, Tracker) {
        var instance = {};
        /**
         * @param {string} s the string to shorten
         * @param {number} n the length to shorten it to
         */
        function cutString(s, n) {
            if (s.length <= n) {
                return s;
            }
            var cut = s.lastIndexOf(' ', n-1);
            if (cut == -1) {
                cut = n-1;
            }
            return s.substring(0, cut) + '…';
        }

        var networks = [
            {
                /**
                 * @type {string} A unique id for this network.
                 */
                id: 'fb',
                /**
                 * @type {string} The human-readable name of this network.
                 */
                name: 'Facebook',
                oauth: new OAuth2('facebook', {
                    client_id: '524771387562499',
                    api_scope: 'publish_stream,read_friendlists,read_stream'
                }),
                /**
                 * @param {boolean} whether to force reauthorization
                 * @return {Promise} resolved when authorization is complete
                 */
                authorize: function(reauthorize) {
                    var deferred = $q.defer();
                    this.oauth.authorize(function() {
                        $timeout(deferred.resolve);
                    }, reauthorize);
                    return deferred.promise;
                },
                /**
                 * @return {Promise<Array.<SSBFriendList>>} the friend lists/groups the user has in this network.
                 */
                getFriendsAndLists: function() {
                    var fb = this;
                    return fb.authorize()
                        .then(function() {
                            var basicFriendLists = [
                                new SSBFriendList('EVERYONE', 'Public'),
                                new SSBFriendList('ALL_FRIENDS', 'Friends'),
                                new SSBFriendList('FRIENDS_OF_FRIENDS', 'Friends of Friends'),
                                new SSBFriendList('SELF', 'Self')];
                            return $http.get('https://graph.facebook.com/me/friendlists',
                                             { cache : true, headers : { Authorization : 'OAuth ' + fb.oauth.getAccessToken() } })
                                .then(function(response) {
                                    Tracker.sendEvent('Facebook', 'FriendLists', 'success');
                                    return _.union(basicFriendLists, _.map(response.data.data, function(fl) { return new SSBFriendList(fl.id, fl.name); }));
                                }, function(reason) {
                                    Tracker.sendEvent('Facebook', 'FriendLists', 'failure');
                                    return basicFriendLists;
                                }).then(function(friendLists) {
                                    var flRequest = $http.get('https://graph.facebook.com/fql?q=SELECT%20flid%2Cuid%20FROM%20friendlist_member%20WHERE%20flid%20IN%20(SELECT%20flid%20from%20friendlist%20WHERE%20owner%3Dme())',
                                                              { cache : true, headers : { Authorization : 'OAuth ' + fb.oauth.getAccessToken() } });
                                    var friendRequest = $http.get('https://graph.facebook.com/me/friends',
                                                                  { cache : true, headers :
                                                                    { Authorization : 'OAuth ' + fb.oauth.getAccessToken() } });
                                    return flRequest.then(function(response) {
                                        var friendGroups = {};
                                        for (var i = response.data.data.length; --i >= 0;) {
                                            var flData = response.data.data[i];
                                            friendGroups[flData.uid] = (friendGroups[flData.uid] || []);
                                            friendGroups[flData.uid].push(flData.flid);
                                        }
                                        return friendGroups;
                                    }, function(reason) {
                                        Tracker.sendEvent('Facebook', 'Friends', 'failure');
                                        return {};
                                    }).then(function(friendGroups) {
                                        return friendRequest.then(function(response) {
                                            Tracker.sendEvent('Facebook', 'Friends', 'success');
                                            return {
                                                friends: _.map(response.data.data, function(friend) {
                                                    return new SSBFriend(friend.id, friend.name, 'https://graph.facebook.com/' + friend.id + '/picture', _.union(['EVERYONE', 'ALL_FRIENDS', 'FRIENDS_OF_FRIENDS'], friendGroups[friend.id] || []));
                                                }),
                                                friendLists: friendLists
                                            };
                                        }, function(reason) {
                                            Tracker.sendEvent('Facebook', 'Friends', 'failure');
                                            return {
                                                friends: [],
                                                friendLists: friendLists
                                            };
                                        });
                                    });
                                });
                        });
                },
                verifyPost: function(postId) {
                    var fb = this;
                    $http.get('https://graph.facebook.com/' + postId,
                              { headers : { Authorization : 'OAuth ' + fb.oauth.getAccessToken() } })
                        .success(function(response) {
                            if (response.privacy.value == 'SELF') {
                                Tracker.sendEvent('Facebook', 'Post', 'private');
                                if (confirm('Posting to selected Facebook friends failed. Click on Super Share Box on the Facebook App Settings page, and set "Posts on your behalf:" to "Public".')) {
                                    chrome.tabs.query(
                                        { currentWindow: true, active: true },
                                        function (tabArray) {
                                            // Open a new tab for Facebook application settings.
                                            chrome.tabs.create({url: 'https://www.facebook.com/settings/?tab=applications', openerTabId: tabArray[0].id});
                                        });
                                }
                            } else {
                                Tracker.sendEvent('Facebook', 'Post', 'success');
                            }
                        })
                        .error(function(data, status) {
                            Tracker.sendEvent('Facebook', 'Post', 'failure');
                            if (status == 400 || status == 401 || status == 403) {
                                if (confirm("Post to Facebook failed. Please authorize Super Share Box to access Facebook and accept *all* permissions.")) {
                                    fb.authorize(function() {
                                        verifyPost(postId);
                                    }, true);
                                }
                            } else {
                                alert(data);
                            }
                        })
                },
                /**
                 * @param {SSBPost} the post to post
                 */
                post: function(post) {
                    var fb = this;
                    var message = cutString(post.text || '', 60000);
                    var privacyString;
                    if (_.contains(post.people, 'EVERYONE')) {
                        privacyString = '{"value":"EVERYONE"}';
                    } else if (post.people.length == 1 && post.people[0] == 'SELF') {
                        privacyString = '{"value":"SELF"}';
                    } else {
                        privacyString = '{"value":"CUSTOM","allow":"' + _.without(post.people, 'SELF').join() + '"}';
                    }
                    var data = 'link=' + encodeURIComponent(post.postUrl) + '&name=' + encodeURIComponent(post.linkHeadline || (post.user + ' ' + new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString())) + '&caption=' + encodeURIComponent(post.postUrl) + '&message=' + encodeURIComponent(message) + '&privacy=' + encodeURIComponent(privacyString) + '&picture=' + encodeURIComponent(post.linkPic || post.userPicUrl) + '&description=' + encodeURIComponent(post.linkDescription || 'Click this link to read the full post.');
                    fb.authorize().then(function() {
                        $http.post('https://graph.facebook.com/me/feed', data,
                                   { headers : { Authorization : 'OAuth ' + fb.oauth.getAccessToken() } })
                            .success(function(response) {
                                // If Facebook was supposed to post it to more than just ourselves, make sure it did after waiting for the post to propagate
                                if (privacyString != '{"value":"SELF"}') {
                                    setTimeout(function() {
                                        fb.verifyPost(response.id);
                                    }, 5000);
                                } else {
                                    Tracker.sendEvent('Facebook', 'Post', 'success');
                                }
                            })
                        .error(function(data, status) {
                            if (status == 401 || status == 403) {
                                Tracker.sendEvent('Facebook', 'Post', 'reauthorize');
                                if (confirm("Post to Facebook failed. Please reauthorize Super Share Box to access Facebook and accept all permissions.")) {
                                    fb.authorize(true).then(function() { fb.post(post) });
                                }
                            } else {
                                Tracker.sendEvent('Facebook', 'Post', 'failure');
                                alert(data);
                            }
                        });
                    });
                }
            },
            {
                id: 'twit',
                name: 'Twitter',
                oauth: ChromeExOAuth.initBackgroundPage({
                    'request_url': 'https://api.twitter.com/oauth/request_token',
                    'authorize_url': 'https://api.twitter.com/oauth/authenticate',
                    'access_url': 'https://api.twitter.com/oauth/access_token',
                    'consumer_key': 'OrpzSLozQWSbAaWtNTfFw',
                    'consumer_secret': 'oLPrdsfUx90HAEtAMEoS0lS4kH7I02nVbtQKKi6QilE',
                    'scope': '',
                    'app_name': 'Super Share Box'
                }),
                authorize: function(reauthorize) {
                    var deferred = $q.defer();
                    this.oauth.authorize(function() {
                        $timeout(deferred.resolve);
                    }, reauthorize);
                    return deferred.promise;
                },
                getFriendsAndLists: function() {
                    var deferred = $q.defer();
                    deferred.resolve({
                        friends: [],
                        friendLists: [ new SSBFriendList('PUBLIC', 'Public') ]
                    });
                    return deferred.promise;
                },
                post: function(post) {
                    var twitter = this;
                    twitter.authorize()
                        .then(function() {
                            twitter.oauth.sendSignedRequest(
                                'https://api.twitter.com/1.1/statuses/update.json',
                                function(response, xhr) {
                                    if (xhr.status == 401) {
                                        Tracker.sendEvent('Twitter', 'Post', 'reauthorize');
                                        if (confirm("Post to Twitter failed. Please reauthorize Super Share Box to access Twitter.")) {
                                            twitter.authorize(true).then(function() {
                                                twitter.post(post);
                                            });
                                        }
                                    } else if (xhr.status != 200) {
                                        Tracker.sendEvent('Twitter', 'Post', 'failure');
                                        alert(xhr.responseText);
                                    } else {
                                        Tracker.sendEvent('Twitter', 'Post', 'success');
                                    }
                                }, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded'
                                    },
                                    body: 'status=' + encodeURIComponent(cutString(post.text || post.linkDescription, 100) + ' ' + post.postUrl)
                                });
                        });
                }
            }
        ]
        instance.getFriendsAndLists = function() {
            return Settings.get().then(function(settings) {
                return $q.all(_.map(networks, function(network) {
                    var enabled = settings.enabledNetworks[network.id];
                    if (enabled === undefined) {
                        enabled = confirm('Enable Super Share Box to post to ' + network.name + '?\n\nYou will only be asked once. To enable or disable sharing to ' + network.name + ' later, go to the extension settings.');
                        settings.enabledNetworks[network.id] = enabled;
                        Settings.set(settings);
                    }
                    if (!enabled) {
                        return [];
                    }
                    return network.getFriendsAndLists().then(function(friendsAndLists) {
                        return {
                            friends: _.map(friendsAndLists.friends, function(friend) {
                                return new SSBFriend(network.id + ':' + friend.id, network.name + ': ' + friend.name, friend.picUrl, _.map(friend.friendLists, function(friendList) {
                                    return network.id + ':' + friendList;
                                }));
                            }),
                            friendLists: _.map(friendsAndLists.friendLists, function(friendList) {
                                return new SSBFriendList(network.id + ':' + friendList.id, network.name + ': ' + friendList.name);
                            })
                        };
                    });
                })).then(function(friendsAndListsArray) {
                    return {
                        friends: _.flatten(_.pluck(friendsAndListsArray, 'friends')),
                        friendLists: _.flatten(_.pluck(friendsAndListsArray, 'friendLists'))
                    };
                });
            }, function(error) { alert(error); });
        };
        instance.post = function(post) {
            Settings.get().then(function(settings) {
                _.each(networks, function(network) {
                    var networkIdPlusColon = network.id + ':';
                    var idLength = networkIdPlusColon.length;
                    // Get the people who are in this network, and remove the id prefix.
                    var filteredPeople = _.compact(_.map(post.people, function(person) {
                        return (person.indexOf(networkIdPlusColon) == 0)
                            ? person.substr(idLength)
                            : undefined;
                    }));
                    if (filteredPeople.length > 0) {
                        if (settings.truncateLength) {
                            post.text = cutString(post.text, settings.truncateLength);
                        }
                        network.post(new SSBPost(post.postUrl, post.text, post.user, post.userPicUrl, filteredPeople, post.linkUrl, post.linkHeadline, post.linkDescription, post.linkPic));
                    }
                });
            }, function(error) { alert(error); });
        };
        instance.listNetworks = function() {
            return _.map(networks, function(network) {
                return {
                    id: network.id,
                    name: network.name
                };
            });
        }
        return instance;
    });


function BackgroundCtrl(Networks, $timeout, Tracker) {
    Tracker.sendAppView('Background');
    chrome.runtime.onConnect.addListener(function(port) {
        console.assert(port.name == "ssb");
        port.onMessage.addListener(
            function(request) {
                $timeout(function() {
                if ((request.message || {}).postUrl) {
                    Networks.post(request.message);
                } else if (request.message == 'GET_FRIENDS') {
                    Networks.getFriendsAndLists().then(function(response) {
                        port.postMessage({
                            responseId: request.messageId,
                            response: response
                        });
                    });
                }
                });
            });
    });
}
