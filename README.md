# slate-gboard

An experimental Slate plugin to handle interactions with later versions of Gboard, Android's default virtual keyboard.

## Background
Newer versions of Android's Gboard will not send any useful information in KeyboardEvents. The event's `charCode` property is 0, `keyCode` and `which` properties are 229, and `key` is "Unidentified". Discussion on this topic can be found here: https://bugs.chromium.org/p/chromium/issues/detail?id=118639#c261

This plugin attempts to use `onComposition` and `onInput` events to make a Slate Editor behave as it would with normal key down events.

Although this code is most definitely in an alpha state, it is meant to serve as a proof-of-concept using alternate methods of text insertion.

If this concept of using composition and input events gets fleshed out, Slate will have the added benefit from being able to handle other languages as well, as the logic for handling character entry in other languages would be similar.

## Approach
This code base will be slowly expanded on to cover various use cases so it can be useful, even as a proof-of-concept. A list of specific use cases is listed below, with a brief description on how the use case is handled by the plug in.

### Insert Word
Using `onComposition` events, this plugin keeps track of when composition has started (using copying Slate core's tracking of `isComposing`). When the `onCompositionEnd` event triggers, the plugin inserts the event data into the Slate value.

### Backspace/Delete
Because we cannot rely on `onKeyDown` event data, character deletion has to be deduced. This deduction happens in `onInput`. A differentiation library ([jsdiff](https://github.com/kpdecker/jsdiff)) is used to compare what the current text is with what the text should be. Given these two sets of information and the diff results, we can make an educated guess on which character should be deleted.

From there, the selection is set and a `change.deleteCharBackward()` is used to mimic the delete behavior from `onKeyDown` in a normal case. Note that there is no need for handling `change.deleteCharForward()` because the selection is always set to be one after the missing character.

BUG: There is currently a known bug in which trying to delete too quickly by pressing the backspace key causes some text insertion. `onCompositionEnd` seems to be the culprit, as it inserts text, but this has not been fully investigated yet.

### Selection Delete
The same procedure to detect a character deletion is used for selection delete as well. Since we are utilizing the jsdiff library, we can actually tell how many characters are different given two texts. If jsdiff reports that there is more than one character that differentiates the inputs, we assume that a selection was intended to be deleted.

Selection delete behavior actually works in Slate core without this plugin, but the logic for the deletion workaround takes priority over Slate's core behavior, so we have to patch this functionality back in.

### Delete Node/Mark
This functionality is not supported yet.

### Autocorrect
When Gboard autocorrects typed text, a `onBeforeInput` event gets sent. By default, Slate will insert the event's text. Since this plugin also inserts text in `onCompositionEnd`, autocorrect operations result in double text entry. This plugin fixes the double entry behavior by inserting the text as Slate does in `onBeforeInput`, but then clearing the `isComposing` flag. Then, in `onCompositionEnd`, the second entry will not be inserted because `isComposing` is not set.
