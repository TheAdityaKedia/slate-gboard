import Debug from 'debug'

import getWindow from 'get-window'
import findPoint from '../util/find-point'
import { IS_ANDROID } from '../util/environment'

const jsdiff = require('diff')

/**
 * Debug.
 *
 * @type {Function}
 */

const debug = Debug('slate:gboard')

/**
 * Plugin to handle Gboard interaction with Slate.
 *
 * @return {Object}
 */

function GboardPlugin() {
  let compositionCount = 0
  let isComposing = false

  /**
   * On before input, correct any browser inconsistencies.
   *
   * @param {Event} event
   * @param {Change} change
   * @param {Editor} editor
   */

  function onBeforeInput(event, change, editor) {
    event.preventDefault()
    change.insertText(event.data)

    // Handles auto-correct auto-insertion
    if (IS_ANDROID) {
      // Remove composing flag because Gboard autocorrect automatically
      // inserts the corrected text
      isComposing = false
    }

    // Prevent Core after plugin call
    return false
  }

  /**
   * On composition end. Handle text entry into Editor.
   *
   * @param {Event} event
   * @param {Change} change
   * @param {Editor} editor
   */

  function onCompositionEnd(event, change, editor) {
    const n = compositionCount

    // The `count` check here ensures that if another composition starts
    // before the timeout has closed out this one, we will abort unsetting the
    // `isComposing` flag, since a composition is still in affect.
    window.requestAnimationFrame(() => {
      if (compositionCount > n) return
      isComposing = false
    })

    if (IS_ANDROID && isComposing) {
      if (event.data !== '') {
        // TODO: Do not insert text if the cursor is in the middle of text
        change.insertText(event.data)
      }
    }

    debug('onCompositionEnd', { event })
  }

  /**
   * On composition start. Need to keep track of isComposing.
   *
   * @param {Event} event
   * @param {Change} change
   * @param {Editor} editor
   */

  function onCompositionStart(event, change, editor) {
    isComposing = true
    compositionCount++

    debug('onCompositionStart', { event })
  }

  /**
   * On input. Intercept core after onInput, so need to provide same
   * core functionality.
   *
   * @param {Event} eventvent
   * @param {Change} change
   */

  function onInput(event, change, editor) {
    debug('onInput', { event })

    const window = getWindow(event.target)
    const { value } = change

    // Get the selection point. (Default behavior)
    const native = window.getSelection()
    const { anchorNode, anchorOffset } = native
    const point = findPoint(anchorNode, anchorOffset, value)
    if (!point) return

    // Get the text node and leaf in question. (Default behavior)
    const { document, selection } = value
    const node = document.getDescendant(point.key)
    const block = document.getClosestBlock(node.key)
    const leaves = node.getLeaves()
    const lastText = block.getLastText()
    const lastLeaf = leaves.last()
    let start = 0
    let end = 0

    const leaf = leaves.find((r) => {
      start = end
      end += r.text.length
      if (end >= point.offset) return true
    }) || lastLeaf

    // Get the text information. (Default behavior)
    const { text } = leaf
    let { textContent } = anchorNode
    const isLastText = node == lastText
    const isLastLeaf = leaf == lastLeaf
    const lastChar = textContent.charAt(textContent.length - 1)

    // COMPAT: If this is the last leaf, and the DOM text ends in a new line,
    // we will have added another new line in <Leaf>'s render method to account
    // for browsers collapsing a single trailing new lines, so remove it.
    if (isLastText && isLastLeaf && lastChar == '\n') {
      textContent = textContent.slice(0, -1)
    }

    // If the text is no different, abort.
    if (textContent == text) return

    if (IS_ANDROID) {
      // Use difference to determine what the intended action was
      const diffs = jsdiff.diffChars(text, textContent)
      // TODO: How to differentiate between delete and adding space in a word?
      if (diffs.length > 0) {
        const ind = diffs[0].count

        if (diffs[1].removed === true) {
          if (diffs[1].count === 1) {
            // Set selection, delete char
            selection.collapseToStart().move(ind)
            change.deleteCharBackward()
          }
          else {
            // There is a selection of text - continue with core Slate behavior
            updateTextAndSelection(change, textContent, text, point, start, end, leaf.marks)
          }
        }
      }
    }
    else {
      // Continue with default behavior
      updateTextAndSelection(change, textContent, text, point, start, end, leaf.marks)
    }

    // Prevent Core onInput after plugin
    return false
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
    const selection = change.value.selection
    const delta = textContent.length - text.length
    const corrected = selection.collapseToEnd().move(delta)
    const entire = selection.moveAnchorTo(point.key, start).moveFocusTo(point.key, end)

    change
      .insertTextAtRange(entire, textContent, marks)
      .select(corrected)
  }

  /**
   * Return the plugin.
   *
   * @type {Object}
   */

  return {
    onBeforeInput,
    onCompositionEnd,
    onCompositionStart,
    onInput,
  }
}

/**
 * Export.
 *
 * @type {function}
 */

export default GboardPlugin
