function Options($scope, $http) {
    var facebook = new OAuth2('facebook', {
        client_id: '524771387562499',
        api_scope: 'publish_stream,read_friendlists,read_stream'
    });

    // Chrome's sync storage has a limit of 4KiB per item. Break the friends list
    // into chunks of 50.
    function writeFriends(friends) {
        var friendData = {};
        friendData.friendChunks = Math.ceil(friends.length / 50);
        // friends instead of friends1 for backwards-compatibility.
        friendData.friends = friends.slice(0, 50);
        for (var i = 1; i < friendData.friendChunks; ++i) {
            friendData['friends' + (i+1)] = friends.slice(i * 50, (i+1) * 50);
        }
        chrome.storage.sync.set(friendData);
    }

    function loadFriends() {
        function handleError(data, status) {
            if (status == 401 || status == 403) {
                if (confirm("Load failed. Please authorize Super Share Box to access Facebook and accept *all* permissions.")) {
                    facebook.authorize(loadFriends, true);
                }
            } else {
                // TODO: Handle other errors.
                alert(JSON.stringify(data));
            }
        }

        $http.get('https://graph.facebook.com/me/friends',
                  { headers : { Authorization : 'OAuth ' + facebook.getAccessToken() } })
            .success(function(friendsResponse) {
                writeFriends(friendsResponse.data);
                $http.get('https://graph.facebook.com/me/friendlists',
                          { headers : { Authorization : 'OAuth ' + facebook.getAccessToken() } })
                    .success(function(friendlistsResponse) {
                        chrome.storage.sync.set({'friendLists': friendlistsResponse.data });
                        $scope.friends = friendsResponse.data;
                        $scope.friendLists = friendlistsResponse.data;
                    }).error(handleError);
            }).error(handleError);
    }

    $scope.loadLists = function() {
        facebook.authorize(loadFriends);
    };

    chrome.storage.sync.get('friendLists', function(items) {
        $scope.friendLists = items.friendLists;
        $scope.$apply();
    });

    readFriends(function(friends) {
        $scope.friends = friends;
        $scope.$apply();
    });
}
