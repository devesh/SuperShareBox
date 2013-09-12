angular.module('Options', ['Background']);

function OptionsCtrl($scope, Networks, Settings, GA, Tracker) {
    Tracker.sendAppView('Options');
    Settings.get().then(function(settings) {
        $scope.networks = _.map(Networks.listNetworks(), function(network) {
            return {
                id: network.id,
                name: network.name,
                enabled: settings.enabledNetworks[network.id]
            };
        });
        $scope.truncate = settings.truncateLength !== null;
        $scope.truncateLength = settings.truncateLength || 100;

        $scope.setNetworkEnabled = function(networkId, enabled) {
            settings.enabledNetworks[networkId] = enabled;
            Settings.set(settings);
        };
        $scope.setTruncateLength = function() {
            if (!$scope.truncate) {
                settings.truncateLength = null;
            } else if ($scope.truncateLength) {
                settings.truncateLength = $scope.truncateLength;
            } else {
                return;
            }
            Settings.set(settings);
        };
    });
    GA.getConfig().addCallback(function(config) {
        $scope.gaEnabled = config.isTrackingPermitted();

        $scope.setTrackingEnabled = function(enabled) {
            config.setTrackingPermitted(enabled);
        };
    });
}
