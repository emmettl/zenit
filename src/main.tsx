import { mountMotionStudy } from '@motionstudies/web/mount-motion-study'
import '@motionstudies/web/fonts.css'
import { App } from './App'
import './style.css'

mountMotionStudy({ id: 'zenit', theme: {
  background: '#05090e', ink: '#e4edf3', muted: '#8b9daa', line: '#263a47',
  primary: '#a5d2e6', secondary: '#debd8a', panel: '#0b141b',
  air: '#a5d2e6', roadLight: '#a5d2e6', roadHeavy: '#debd8a',
} }, <App />)
