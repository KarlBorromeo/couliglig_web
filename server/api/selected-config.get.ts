import { appState } from "./selected-config";

export default defineEventHandler((event) => {
  return { configID: appState.configID };
});