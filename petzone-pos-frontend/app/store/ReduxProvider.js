'use client'

import { Provider } from 'react-redux'
import { store } from './index'

export function ReduxProvider({ children }) {
  if (!store) {
    return <div>Loading...</div>
  }
  
  return <Provider store={store}>{children}</Provider>
}
