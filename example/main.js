import React from 'react'
import ReactDOM from 'react-dom'
import { Value } from 'slate'
import { Editor } from 'slate-react'

import INITIAL_VALUE from './value.json'
import GboardPlugin from '../lib'

const plugins = [GboardPlugin()]

class Example extends React.Component {

  state = {
    value: Value.fromJSON(INITIAL_VALUE)
  };

  onChange = ({ value }) => {
    this.setState({
      value
    })
  };

  render() {
    return (
      <Editor
        placeholder={'Enter some text...'}
        plugins={plugins}
        value={this.state.value}
        onChange={this.onChange}
      />
    )
  }

}

// $FlowFixMe
ReactDOM.render(<Example />, document.getElementById('example'))
