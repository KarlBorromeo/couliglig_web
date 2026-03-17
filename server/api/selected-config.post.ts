import { appState } from "./selected-config";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { configID } = body;

  console.log("Received request to update selected config ID to:", configID);

  appState.configID = configID;
  console.log("Selected config ID updated to:", configID);
  
  return { success: true, message: "Selected config ID updated successfully." };
});