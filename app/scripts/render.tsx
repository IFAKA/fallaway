// bun scripts/render.tsx — server-render the app in a few states to catch runtime errors (no browser needed).
import { renderToString } from 'react-dom/server'
import App from '../src/App'
const html = renderToString(<App />)
console.log('rendered', html.length, 'chars; cards:', (html.match(/class="acard/g) ?? []).length, 'buttons:', (html.match(/<button/g) ?? []).length)
