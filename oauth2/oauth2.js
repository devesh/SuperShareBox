/*
 * Copyright 2011 Google Inc. All Rights Reserved.

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


/**
 * Constructor
 *
 * @param {String} adapterName  name of the adapter to use for this OAuth 2
 * @param {Object} config Containing clientId and apiScope
 * @param {String} config Alternatively, OAuth2.FINISH for the finish flow
 */
var OAuth2 = function(adapterName, config) {
  this.adapterName = adapterName;
  var that = this;
  OAuth2.loadAdapter(adapterName, function() {
    that.adapter = OAuth2.adapters[adapterName];
    if (config == OAuth2.FINISH) {
      that.finishAuth();
    } else if (config) {
      that.updateLocalStorage();

      var data = that.get();
      data.clientId = config.client_id;
      data.apiScope = config.api_scope;
      that.setSource(data);
    }
  });
};

/**
 * Pass instead of config to specify the finishing OAuth flow.
 */
OAuth2.FINISH = 'finish';

/**
 * OAuth 2.0 endpoint adapters known to the library
 */
OAuth2.adapters = {};
OAuth2.adapterReverse = localStorage.oauth2_adapterReverse &&
    JSON.parse(localStorage.oauth2_adapterReverse) || {};
// Update the persisted adapterReverse in localStorage.
if (localStorage.adapterReverse) {
  OAuth2.adapterReverse = JSON.parse(localStorage.adapterReverse);
  delete localStorage.adapterReverse;
}

/**
 * Consolidates the data stored in localStorage on the current adapter in to
 * a single JSON object.
 * The update should only ever happen once per adapter and will delete the old
 * obsolete entries in localStorage after copying their values.
 */
OAuth2.prototype.updateLocalStorage = function() {
  // Check if update is even required.
  if (this.getSource()) {
    return;
  }
  var data = {};
  var variables = [
      'accessToken', 'accessTokenDate', 'apiScope', 'clientId', 'expiresIn',
      'refreshToken'
  ];
  // Check if a variable has already been persisted and then copy them.
  var key;
  for (var i = 0; i < variables.length; i++) {
    key = this.adapterName + '_' + variables[i];
    if (localStorage.hasOwnProperty(key)) {
      data[variables[i]] = localStorage[key];
      delete localStorage[key];
    }
  }
  // Persist the new JSON object in localStorage.
  this.setSource(data);
};

/**
 * Opens up an authorization popup window. This starts the OAuth 2.0 flow.
 *
 * @param {Function} callback Method to call when the user finished auth.
 */
OAuth2.prototype.openAuthorizationCodePopup = function(callback) {
    // Store a reference to the callback so that the newly opened window can call
    // it later.
    window['oauth-callback'] = callback;
    var self = this;
    chrome.tabs.query(
        { currentWindow: true, active: true },
        function (tabArray) {
            // Create a new tab with the OAuth 2.0 prompt
            chrome.tabs.create({url: self.adapter.authorizationCodeURL(self.getConfig()), openerTabId: tabArray[0].id});
        });
};

/**
 * Extracts authorizationCode from the URL and makes a request to the last
 * leg of the OAuth 2.0 process.
*/
OAuth2.prototype.finishAuth = function() {
  var authorizationCode = null;
  var that = this;

  // Loop through existing extension views and execute any stored callbacks.
  function callback(error) {
    var views = chrome.extension.getViews();
    for (var i = 0, view; view = views[i]; i++) {
      if (view['oauth-callback']) {
        view['oauth-callback'](error);
        // TODO: Decide whether it's worth it to scope the callback or not.
        // Currently, every provider will share the same callback address but
        // that's not such a big deal assuming that they check to see whether
        // the token exists instead of blindly trusting that it does.
      }
    }

    // Once we get here, close the current tab and we're good to go.
    // The following works around bug: crbug.com/84201
    window.open('', '_self', '');
    window.close();
  }

    var parsedTokens = that.adapter.parseAccessToken(decodeURIComponent(window.location.href.match(/&from=([^&]+)/)[1]));
    var data = that.get();
    data.accessTokenDate = new Date().valueOf();

    // Set all data returned by the OAuth 2.0 provider.
    for (var name in parsedTokens) {
      if (parsedTokens.hasOwnProperty(name) && parsedTokens[name]) {
        data[name] = parsedTokens[name];
      }
    }

    that.setSource(data);
    callback();
};

/**
 * @return True iff the current access token has expired
 */
OAuth2.prototype.isAccessTokenExpired = function() {
  var data = this.get();
  return (new Date().valueOf() - data.accessTokenDate) > data.expiresIn * 1000;
};

/**
 * Get the persisted adapter data in localStorage. Optionally, provide a
 * property name to only retrieve its value.
 *
 * @param {String} [name] The name of the property to be retrieved.
 * @return The data object or property value if name was specified.
 */
OAuth2.prototype.get = function(name) {
  var src = this.getSource();
  var obj = src ? JSON.parse(src) : {};
  return name ? obj[name] : obj;
};

/**
 * Set the value of a named property on the persisted adapter data in
 * localStorage.
 *
 * @param {String} name The name of the property to change.
 * @param value The value to be set.
 */
OAuth2.prototype.set = function(name, value) {
  var obj = this.get();
  obj[name] = value;
  this.setSource(obj);
};

/**
 * Clear all persisted adapter data in localStorage. Optionally, provide a
 * property name to only clear its value.
 *
 * @param {String} [name] The name of the property to clear.
 */
OAuth2.prototype.clear = function(name) {
  if (name) {
    var obj = this.get();
    delete obj[name];
    this.setSource(obj);
  } else {
    delete localStorage['oauth2_' + this.adapterName];
  }
};

/**
 * Get the JSON string for the object stored in localStorage.
 *
 * @return {String} The source JSON string.
 */
OAuth2.prototype.getSource = function() {
  return localStorage['oauth2_' + this.adapterName];
};

/**
 * Set the JSON string for the object stored in localStorage.
 *
 * @param {Object|String} source The new JSON string/object to be set.
 */
OAuth2.prototype.setSource = function(source) {
  if (!source) {
    return;
  }
  if (typeof source !== 'string') {
    source = JSON.stringify(source);
  }
  localStorage['oauth2_' + this.adapterName] = source;
};

/**
 * Get the configuration parameters to be passed to the adapter.
 *
 * @returns {Object} Contains clientId and apiScope.
 */
OAuth2.prototype.getConfig = function() {
  var data = this.get();
  return {
    clientId: data.clientId,
    apiScope: data.apiScope
  };
};

/***********************************
 *
 * STATIC ADAPTER RELATED METHODS
 *
 ***********************************/

/**
 * Loads an OAuth 2.0 adapter and calls back when it's loaded
 *
 * @param adapterName {String} The name of the JS file
 * @param callback {Function} Called as soon as the adapter has been loaded
 */
OAuth2.loadAdapter = function(adapterName, callback) {
  // If it's already loaded, don't load it again
  if (OAuth2.adapters[adapterName]) {
    callback();
    return;
  }
};

/**
 * Registers an adapter with the library. This call is used by each adapter
 *
 * @param {String} name The adapter name
 * @param {Object} impl The adapter implementation
 *
 * @throws {String} If the specified adapter is invalid
 */
OAuth2.adapter = function(name, impl) {
  // Save the adapter in the adapter registry
  OAuth2.adapters[name] = impl;
  // Make an entry in the adapter lookup table
  OAuth2.adapterReverse[impl.redirectURL()] = name;
  // Store the the adapter lookup table in localStorage
  localStorage.oauth2_adapterReverse = JSON.stringify(OAuth2.adapterReverse);
};

/**
 * Looks up the adapter name based on the redirect URL. Used by oauth2.html
 * in the second part of the OAuth 2.0 flow.
 *
 * @param {String} url The url that called oauth2.html
 * @return The adapter for the current page
 */
OAuth2.lookupAdapterName = function(url) {
  var adapterReverse = JSON.parse(localStorage.oauth2_adapterReverse);
  return adapterReverse[url];
};

/***********************************
 *
 * PUBLIC API
 *
 ***********************************/

/**
 * Authorizes the OAuth authenticator instance.
 *
 * @param {Function} callback Tries to callback when auth is successful
 *                            Note: does not callback if grant popup required
 */
OAuth2.prototype.authorize = function(callback, reauthorize) {
  var that = this;
  OAuth2.loadAdapter(that.adapterName, function() {
    that.adapter = OAuth2.adapters[that.adapterName];
    var data = that.get();
    if (!data.accessToken || that.isAccessTokenExpired() || reauthorize) {
      that.openAuthorizationCodePopup(callback);
    } else {
      // We have an access token, and it's not expired yet
      if (callback) {
        callback();
      }
    }
  });
};

/**
 * @returns A valid access token.
 */
OAuth2.prototype.getAccessToken = function() {
  return this.get('accessToken');
};

/**
 * Indicate whether or not a valid access token exists.
 *
 * @returns {Boolean} True if an access token exists; otherwise false.
 */
OAuth2.prototype.hasAccessToken = function() {
  return !!this.get('accessToken');
};

/**
 * Clears an access token, effectively "logging out" of the service.
 */
OAuth2.prototype.clearAccessToken = function() {
  this.clear('accessToken');
};

OAuth2.adapter('facebook', {
  authorizationCodeURL: function(config) {
      return ('https://www.facebook.com/dialog/oauth?' +
              'client_id={{CLIENT_ID}}&' +
              'response_type=token&' +
              'redirect_uri={{REDIRECT_URI}}&' +
              'scope={{API_SCOPE}}')
          .replace('{{CLIENT_ID}}', config.clientId)
          .replace('{{REDIRECT_URI}}', this.redirectURL(config))
          .replace('{{API_SCOPE}}', config.apiScope);
  },

  redirectURL: function(config) {
    return 'https://www.facebook.com/connect/login_success.html';
  },

  parseAccessToken: function(response) {
    return {
      accessToken: response.match(/access_token=([^&]*)/)[1],
      expiresIn: response.match(/expires_in=([^&]*)/)[1]
    };
  }
});
