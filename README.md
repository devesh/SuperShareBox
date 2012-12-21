Super Share Box
===============

Exposes friends and friend groups from other social networks in the Google+ share box by wrapping the circles XHR.
Wraps the post message XHR to determine whether the post should be shared to those other social networks.
Posts links to the Google+ post on the other social networks.

The code is currently very hacky. A few next steps:
- Clean up the code, especially the hacked-together oauth code mangled from the [oauth2-extensions](https://github.com/borismus/oauth2-extensions) repository by Boris Smus.
- Add more social networks.
- Fix the hovercard for external "circles"
- Remove external "circles" from places they don't belong, like the circles editor.
- Localization.
- UI cleanup.
