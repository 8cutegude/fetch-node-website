import { promisify } from 'util'

import ora from 'ora'
// TODO: replace with `Stream.finished()` after dropping support for Node 8/9
import endOfStream from 'end-of-stream'

const pEndOfStream = promisify(endOfStream)

// Add CLI spinner showing download progress
export const addSpinner = async function(response, progress, path) {
  if (!progress) {
    return
  }

  const text = getText(path)

  const spinner = ora({ color: 'green', spinner: 'star', discardStdin: false })
  pushSpinner(spinner)

  response.on('downloadProgress', ({ transferred }) => {
    updateSpinner(spinner, transferred, text)
  })

  // TODO: use try/finally after dropping support for Node 8/9
  try {
    await pEndOfStream(response, { writable: false })
    popSpinner(spinner)
  } catch {
    // This happens when a network error happens in the middle of the download,
    // which is hard to simulate in tests
    // istanbul ignore next
    popSpinner(spinner)
  }
}

const pushSpinner = function(spinner) {
  // eslint-disable-next-line fp/no-mutating-methods
  spinners.push(spinner)
  startSpinner(spinners[0])
}

const popSpinner = function(spinner) {
  stopSpinner(spinner)
  // eslint-disable-next-line fp/no-mutation
  spinners = spinners.filter(spinnerA => spinnerA !== spinner)
  startSpinner(spinners[0])
}

// When several `fetch-node-website` calls are done in parallel, we ensure
// only one spinner is shown at once
const startSpinner = function(spinner) {
  if (spinner === undefined || spinner.isSpinning) {
    return
  }

  spinner.start()
}

const stopSpinner = function(spinner) {
  if (!spinner.isSpinning) {
    return
  }

  spinner.stop()
}

// eslint-disable-next-line fp/no-let
let spinners = []

// Retrieve the text shown next to the spinner
const getText = function(path) {
  const version = VERSION_TEXT_REGEXP.exec(path)

  if (version !== null) {
    return `${VERSION_TEXT} ${version[1]}...`
  }

  if (INDEX_TEXT_REGEXP.test(path)) {
    return INDEX_TEXT
  }

  return DEFAULT_TEXT
}

const VERSION_TEXT_REGEXP = /^\/?v([\d.]+)\//u
const INDEX_TEXT_REGEXP = /^\/?index.(json|tab)$/u

const VERSION_TEXT = 'Downloading Node.js'
const INDEX_TEXT = 'Downloading list of Node.js versions...'
const DEFAULT_TEXT = 'Downloading Node.js...'

const updateSpinner = function(spinner, transferred, text) {
  // eslint-disable-next-line fp/no-mutation, no-param-reassign
  spinner.text = `${text} ${getMegabytes(transferred)}`
}

const getMegabytes = function(size) {
  const sizeA = Math.floor(size / BYTES_TO_MEGABYTES)
  return `${String(sizeA).padStart(2)}MB`
}

// eslint-disable-next-line no-magic-numbers
const BYTES_TO_MEGABYTES = 1024 ** 2
