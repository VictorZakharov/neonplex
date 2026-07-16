import './styles.css';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { App } from './ui/App';

const root = document.querySelector<HTMLElement>('#app');

if (root === null) {
  throw new Error('Application root was not found.');
}

const app = new App(root);
app.mount();
registerServiceWorker();
