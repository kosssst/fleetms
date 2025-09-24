/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import webSocketTask from './src/tasks/WebSocketTask';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask('WebSocket', () => webSocketTask);
