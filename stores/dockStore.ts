import { defineStore } from "pinia";
import axios from "axios";

export const useDockStore = defineStore("dock", {
  state: () => ({
    dockConfigs: [] as dockConfigs[],
    onlineRobots: [] as onlineRobot[]
  }),
  actions: {
    async createConfig(configPayload: createDockConfig, docksPayload: createDock[]| [], formDataMap: FormData, robotPoses: robotPose[] | []) {
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
            const uploadMapRes = await axios.post(`${baseurl}map/upload`, formDataMap, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            const map = uploadMapRes.data;

            const updatedRobotPoses = robotPoses.map(pose => ({
                ...pose,
                map_id: map.id
            }))
            await axios.post(`${baseurl}robots/infos`, updatedRobotPoses);

            console.log("Config created successfully:", config);
            console.log("Docks updated with config_id:", updatedDocksPayload);  
            console.log("Map files uploaded successfully");
   
        } catch (error) {
            console.error("Error creating config:", error);
        }
    },
    async fetchDockConfigs() {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            const response = await axios.get(`${baseurl}dock/configs`);
            this.dockConfigs = response.data;
        } catch (error) {
            console.error("Error fetching dock configurations:", error);
        }
    },
    async fetchOnlineRobots() {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            const response = await axios.get(`${baseurl}robots/online`);
            const robots = response.data.data;
            console.log("Fetched online robots:", robots);
            this.onlineRobots = robots.map((robot: onlineRobot) => ({
                ...robot,
                battery: Math.floor(Math.random() * 100) + 1, // Simulate battery level
                status: "Idle" // Default status, can be updated based on real data
            }));
        } catch (error) {
            console.error("Error fetching online robots:", error);
            return [];
        }
    }
  },
});

interface createDockConfig {
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
interface robotPose {
    robot_name: string
    initial_x: number
    initial_y: number
    initial_theta: number
}
interface dockConfigs {
    id: number;
    name: string;
    description: string;
}
interface onlineRobot {
    ip: string;
    hostname: string;
    namespace: string;
    ros_domain_id: string;
    battery: number; //TODO: replace with real battery data from backend
    status: string; //TODO: replace with real status data from roslib
    timestamp: number;
}