import { AppRegistry, type RootTag } from 'react-native';
import App from '../App';
import app from '../app.json';
import './fonts.css';

// The same registration the Android entry point performs; on the web the
// application is then mounted into a DOM node.
AppRegistry.registerComponent(app.name, () => App);

const rootTag = document.getElementById('root');
if (!rootTag) {
  throw new Error('#root is missing from index.html');
}

AppRegistry.runApplication(app.name, {
  initialProps: {},
  // The one place the two platforms disagree, and it is a type-only lie:
  // react-native-web mounts into the DOM node itself, while React Native's
  // RootTag is a branded native-surface symbol — and react-native-web ships
  // no types of its own, so `react-native` is what this program is checked
  // against.
  rootTag: rootTag as unknown as RootTag,
});
