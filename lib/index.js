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
          // Some text was removed - update selection and delete character
          selection.collapseToStart().move(ind)
          change.deleteCharBackward()
        }
      }
    }
    else {
      // Continue with default behavior
      const delta = textContent.length - text.length
      const corrected = selection.collapseToEnd().move(delta)
      const entire = selection.moveAnchorTo(point.key, start).moveFocusTo(point.key, end)

      change
        .insertTextAtRange(entire, textContent, leaf.marks)
        .select(corrected)
    }

    // Prevent Core onInput after plugin
    return false
  }

  /**
   * Return the plugin.
   *
   * @type {Object}
   */

  return {
    onCompositionEnd,
    onCompositionStart,
    onInput,
  }
}

/**
 * Export.
 *
 * @type {Object}
 */

export default GboardPlugin
