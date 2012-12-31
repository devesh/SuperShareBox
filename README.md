Super Share Box
===============

Exposes friends and friend groups from other social networks in the Google+ share box by wrapping the circles XHR.
Wraps the post message XHR to determine whether the post should be shared to those other social networks.
Posts links to the Google+ post on the other social networks.

The code is currently very hacky. A few next steps:
- Clean up the code, especially the hacked-together oauth code mangled from the
  [oauth2-extensions](https://github.com/borismus/oauth2-extensions) repository by Boris Smus and the XHR wrapper hacked
  out of [Firebug Lite](http://code.google.com/p/fbug/source/browse/lite/branches/firebug1.5/content/lite/xhr.js) that
  does everything.
- Add more social networks.
- Fix the hovercard for external "circles"
- Remove external "circles" from places they don't belong, like the circles editor.
- Localization.
- UI cleanup.
- Delete corresponding Facebook post when the user deletes a Google+ post.
- Firefox extension

Installing
==========
[Get it here.](https://chrome.google.com/webstore/detail/super-share-box/flndhlfpginekiffiffkmmaajgaagolk)

Development
===========

Developing Chrome extensions is very easy.
Just go to [Three bars (formerly wrench)] -> Tools -> Extensions -> Load Unpacked Extension and choose the directory
containing this code. Open the files in an editor, make changes, and just refresh the Google+ tab when you're done.
