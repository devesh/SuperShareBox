function Options($scope, $http) {
    var facebook = new OAuth2('facebook', {
        client_id: '524771387562499',
        api_scope: 'publish_stream,read_friendlists,read_stream'
    });

    $scope.updatePostSnippet = function() {
        chrome.storage.sync.set({postSnippet: $scope.postSnippet});
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
            .success(function(data) {
                $scope.friends = data.data;
                chrome.storage.sync.set({ "friends":  $scope.friends });
                $http.get('https://graph.facebook.com/me/friendlists',
                          { headers : { Authorization : 'OAuth ' + facebook.getAccessToken() } })
                    .success(function(data) {
                        $scope.friendLists = data.data;
                        chrome.storage.sync.set({ "friendLists":  $scope.friendLists });
                    }).error(handleError);
            }).error(handleError);
    }

    $scope.loadLists = function() {
        facebook.authorize(loadFriends);
    };

    chrome.storage.sync.get(['friendLists', 'friends', 'postSnippet'], function(items) {
        $scope.friendLists = items.friendLists;
        $scope.friends = items.friends;
        $scope.postSnippet = (items.postSnippet !== false);
        $scope.$apply();
    });
}
