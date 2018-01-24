'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _getWindow = require('get-window');

var _getWindow2 = _interopRequireDefault(_getWindow);

var _findPoint = require('../util/find-point');

var _findPoint2 = _interopRequireDefault(_findPoint);

var _environment = require('../util/environment');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var jsdiff = require('diff');

/**
 * Debug.
 *
 * @type {Function}
 */

var debug = (0, _debug2.default)('slate:gboard');

/**
 * Plugin to handle Gboard interaction with Slate.
 *
 * @return {Object}
 */

function GboardPlugin() {
  var compositionCount = 0;
  var isComposing = false;

  /**
   * On composition end. Handle text entry into Editor.
   *
   * @param {Event} event
   * @param {Change} change
   * @param {Editor} editor
   */

  function onCompositionEnd(event, change, editor) {
    var n = compositionCount;

    // The `count` check here ensures that if another composition starts
    // before the timeout has closed out this one, we will abort unsetting the
    // `isComposing` flag, since a composition is still in affect.
    window.requestAnimationFrame(function () {
      if (compositionCount > n) return;
      isComposing = false;
    });

    if (_environment.IS_ANDROID && isComposing) {
      if (event.data !== '') {
        // TODO: Do not insert text if the cursor is in the middle of text
        change.insertText(event.data);
      }
    }

    debug('onCompositionEnd', { event: event });
  }

  /**
   * On composition start. Need to keep track of isComposing.
   *
   * @param {Event} event
   * @param {Change} change
   * @param {Editor} editor
   */

  function onCompositionStart(event, change, editor) {
    isComposing = true;
    compositionCount++;

    debug('onCompositionStart', { event: event });
  }

  /**
   * On input. Intercept core after onInput, so need to provide same
   * core functionality.
   *
   * @param {Event} eventvent
   * @param {Change} change
   */

  function onInput(event, change, editor) {
    debug('onInput', { event: event });

    var window = (0, _getWindow2.default)(event.target);
    var value = change.value;

    // Get the selection point. (Default behavior)

    var native = window.getSelection();
    var anchorNode = native.anchorNode,
        anchorOffset = native.anchorOffset;

    var point = (0, _findPoint2.default)(anchorNode, anchorOffset, value);
    if (!point) return;

    // Get the text node and leaf in question. (Default behavior)
    var document = value.document,
        selection = value.selection;

    var node = document.getDescendant(point.key);
    var block = document.getClosestBlock(node.key);
    var leaves = node.getLeaves();
    var lastText = block.getLastText();
    var lastLeaf = leaves.last();
    var start = 0;
    var end = 0;

    var leaf = leaves.find(function (r) {
      start = end;
      end += r.text.length;
      if (end >= point.offset) return true;
    }) || lastLeaf;

    // Get the text information. (Default behavior)
    var text = leaf.text;
    var textContent = anchorNode.textContent;

    var isLastText = node == lastText;
    var isLastLeaf = leaf == lastLeaf;
    var lastChar = textContent.charAt(textContent.length - 1);

    // COMPAT: If this is the last leaf, and the DOM text ends in a new line,
    // we will have added another new line in <Leaf>'s render method to account
    // for browsers collapsing a single trailing new lines, so remove it.
    if (isLastText && isLastLeaf && lastChar == '\n') {
      textContent = textContent.slice(0, -1);
    }

    // If the text is no different, abort.
    if (textContent == text) return;

    if (_environment.IS_ANDROID) {
      // Use difference to determine what the intended action was
      var diffs = jsdiff.diffChars(text, textContent);
      // TODO: How to differentiate between delete and adding space in a word?
      if (diffs.length > 0) {
        var ind = diffs[0].count;

        if (diffs[1].removed === true) {
          if (diffs[1].count === 1) {
            // Set selection, delete char
            selection.collapseToStart().move(ind);
            change.deleteCharBackward();
          } else {
            // There is a selection of text - continue with core Slate behavior
            updateTextAndSelection(change, textContent, text, point, start, end, leaf.marks);
          }
        }
      }
    } else {
      // Continue with default behavior
      updateTextAndSelection(change, textContent, text, point, start, end, leaf.marks);
    }

    // Prevent Core onInput after plugin
    return false;
  }

  /**
   * Extracted helper method from Slate's core after onInput method. Some situations
   * require default Slate behavior.
   *
   * @param {Change} change
   * @param {String} textContent
   * @param {String} text
   * @param {Object} point
   * @param {Number} start
   * @param {Number} end
   * @param {Object} marks
   */

  function updateTextAndSelection(change, textContent, text, point, start, end, marks) {
    // Determine what the selection should be after changing the text.
    var selection = change.value.selection;
    var delta = textContent.length - text.length;
    var corrected = selection.collapseToEnd().move(delta);
    var entire = selection.moveAnchorTo(point.key, start).moveFocusTo(point.key, end);

    change.insertTextAtRange(entire, textContent, marks).select(corrected);
  }

  /**
   * Return the plugin.
   *
   * @type {Object}
   */

  return {
    onCompositionEnd: onCompositionEnd,
    onCompositionStart: onCompositionStart,
    onInput: onInput
  };
}

/**
 * Export.
 *
 * @type {function}
 */

exports.default = GboardPlugin;