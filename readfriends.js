// Chrome's sync storage has a limit of 4 KiB per item. Read the friends list
// from chunks.
function readFriends(callback) {
    chrome.storage.sync.get('friendChunks', function(items) {
        // The first chunk is stored in friends instead of friends1
        // for backwards-compatibility.
        var friendKeys = ['friends'];
        for (var i = 1; i < items.friendChunks; ++i) {
            friendKeys.push('friends' + (i + 1));
        }
        chrome.storage.sync.get(friendKeys, function(friendArrays) {
            var friends = [];
            for (var key in friendArrays) {
                friends = friends.concat(friendArrays[key]);
            }
            callback(friends);
        });
    });
}
