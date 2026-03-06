import { defineStore } from "pinia";
import axios from "axios";

export const useDockStore = defineStore("dock", {
  state: () => ({

  }),
  actions: {
    async createConfig(configPayload: dockConfig, docksPayload: createDock[]| [], formDataMap: FormData) {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            const createConfigRes = await axios.post(`${baseurl}dock`, configPayload);
            const config = createConfigRes.data
            const updatedDocksPayload = docksPayload.map(dock => ({
                ...dock,
                config_id: config.id
            }))
            await axios.post(`${baseurl}dock/create_dock`, updatedDocksPayload);

            formDataMap.append("dock_config_id", config.id);
            await axios.post(`${baseurl}map/upload`, formDataMap, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });

            // TODO add here rquest for intial poses yaml

            console.log("Config created successfully:", config);
            console.log("Docks updated with config_id:", updatedDocksPayload);  
            console.log("Map files uploaded successfully");
   
        } catch (error) {
            console.error("Error creating config:", error);
        }
    }
  },
});

interface dockConfig {
  name: string;
  description: string;
}
interface createDock {
    config_id: number | undefined;
    dock_id: string;
    dock_type: string;
    x: number;
    y: number;
    theta: number;
    aruco_id: number;
}