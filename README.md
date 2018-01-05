# slate-gboard

An experimental Slate plugin to handle interactions with later versions of Gboard, Android's default virtual keyboard.

Newer versions of Android's Gboard will not send any useful information in KeyboardEvents. The event's `charCode` property is 0, `keyCode` and `which` properties are 229, and `key` is "Unidentified". Discussion on this topic can be found here: https://bugs.chromium.org/p/chromium/issues/detail?id=118639#c261

This plugin attempts to use `onComposition` and `onInput` events to make a Slate Editor behave as it would with normal key down events.

Although there are several bugs with this code (does not handle marks, will not delete nodes, cannot split a word), it is meant to serve as a proof-of-concept using alternate methods of text insertion.

If this concept of using composition and input events gets fleshed out, Slate will have the added benefit from being able to handle other languages as well, as the logic for handling characters in other languages would be similar.