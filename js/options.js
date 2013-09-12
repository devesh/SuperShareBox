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
