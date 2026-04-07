import { defineStore } from "pinia";
import axios from "axios";

export const useDockStore = defineStore("dock", {
  state: () => ({
    dockConfigs: [] as dockConfigs[],
    onlineRobots: [] as onlineRobot[],
    toMappingRobots : [] as onlineRobot[],
    toLaunchRobots : [] as onlineRobot[],
    toDockRobots : [] as onlineRobot[],
    docks_pickups: [] as Docks[],
    docks_receivers: [] as Docks[],
  }),
  actions: {
    async createConfig(configPayload: createDockConfig, docksPayload: createDock[]| [], formDataMap: FormData, robotPoses: robotPose[] | []) {
        let configId: number | undefined = undefined;
        let mapId: number | undefined = undefined;
        const baseurl = useRuntimeConfig().public.baseURL;
        try {
            const createConfigRes = await axios.post(`${baseurl}dock`, configPayload);
            const config = createConfigRes.data
            configId = config.id;
            const updatedDocksPayload = docksPayload.map(dock => ({
                ...dock,
                config_id: configId
            }))
            await axios.post(`${baseurl}dock/create_dock`, updatedDocksPayload);

            if (configId === undefined) {
                throw new Error("Config ID is undefined after creation");
            }
            formDataMap.append("dock_config_id", configId.toString());
            const uploadMapRes = await axios.post(`${baseurl}map/upload`, formDataMap, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            const map = uploadMapRes.data;
            mapId = map.id;

            if (mapId === undefined) {
                throw new Error("Map ID is undefined after upload");
            }
            const updatedRobotPoses = robotPoses.map(pose => ({
                ...pose,
                map_id: mapId
            }))
            await axios.post(`${baseurl}robots/infos`, updatedRobotPoses);

            console.log("Config created successfully:", config);
            console.log("Docks updated with config_id:", updatedDocksPayload);  
            console.log("Map files uploaded successfully");
   
        } catch (error:any) {
            const errorDetail = error.response.data.detail;
            if (errorDetail == 'YAML filename already exists') {
                // delete the created config to prevent orphaned configs without maps
                await axios.delete(`${baseurl}dock/delete_config`, { params: { config_id: configId } });
            }
            throw new Error(error.response.data.detail || "Error creating dock configuration");  
        }
    },
    async fetchDockConfigs() {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            const response = await axios.get(`${baseurl}dock/configs`);
            this.dockConfigs = response.data;
            console.log("Fetched dock configurations:", this.dockConfigs);
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
                status: "" // Default status, can be updated based on real data
            }));
        } catch (error) {
            console.error("Error fetching online robots:", error);
            return [];
        }
    },
    fetchToMappingRobots() {
        //console.log("Filtering to mapping robots from online robots:", this.onlineRobots);
        this.toMappingRobots = this.onlineRobots.filter(robot => robot.status.toUpperCase() === 'MAPPING' || robot.status.toUpperCase() === 'IDLE');
    },
    fetchToLaunchRobots() {
        //console.log("Filtering to launch robots from online robots:", this.onlineRobots);
        this.toLaunchRobots = this.onlineRobots.filter(robot => robot.status.toUpperCase() === 'IDLE' || robot.status.toUpperCase() === 'PROCESSING');
    },
    fetchToDockRobots() {
        //console.log("Filtering to dock robots from online robots:", this.onlineRobots);
        this.toDockRobots = this.onlineRobots.filter(robot => robot.status.toUpperCase() === 'NAVIGATING' || robot.status.toUpperCase() === 'READY');
    },
    updateRobotStatus(ip: string, status: string) {
        const robotIndex = this.onlineRobots.findIndex(robot => robot.ip === ip);
        if (robotIndex !== -1) {
            this.onlineRobots[robotIndex].status = status;
        }
        this.fetchToLaunchRobots();
        this.fetchToDockRobots();
        this.fetchToMappingRobots();
    },
    async deleteDockConfig(configId: number) {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            await axios.delete(`${baseurl}dock/delete_config`, { params: { config_id: configId } });
            this.dockConfigs = this.dockConfigs.filter(config => config.id !== configId);
            console.log(`Dock configuration with ID ${configId} deleted successfully.`);
        } catch (error) {
            console.error("Error deleting dock configuration:", error);
        }
    },
    async fetchDocks() {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            const response = await axios.get(`${baseurl}dock/all_dock_states`);
            let docks = response.data;
            this.docks_pickups = docks.filter((dock: Docks) => dock.dock_type === 'pickup');
            this.docks_receivers = docks.filter((dock: Docks) => dock.dock_type === 'receiver');
            this.docks_pickups.sort((a, b) => a.dock_id.localeCompare(b.dock_id));
            this.docks_receivers.sort((a, b) => a.dock_id.localeCompare(b.dock_id));
        } catch (error) {
            console.error("Error fetching docks:", error);
        }
    },
    async actionRunNavigation(config_id: number | null, robot_data : robotData[]) {
        try {
            // await Promise.reject(new Error("Simulated navigation launch error"))
            console.log("Launching navigation with config_id:", config_id, "and robot_data:", robot_data);
            const baseurl = useRuntimeConfig().public.baseURL;
            await axios.post(`${baseurl}actions/run_nav`, 
                { 
                    config_id, 
                    robot_data
                });
            console.log("Navigation launched successfully");
        } catch (error) {
            console.error("Error launching navigation:", error);
             throw new Error(`Error launching navigation`);
        }
    },
    async actionStopNavigation(config_id: number | null, robot_data : robotData[]) {
        try {
            console.log("Stopping navigation with config_id:", config_id, "and robot_data:", robot_data);
            const baseurl = useRuntimeConfig().public.baseURL;
            const res = await axios.post(`${baseurl}actions/stop_nav`, { config_id, robot_data });
            return {
                successful: res.data.successful,
                message: res.data.failed
            }
        } catch (error) {
            console.error("Error stopping navigation:", error);
            throw new Error(`Error stopping navigation`);
        }
    },
    async activateDockConfig(configId: number) {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            await axios.post(`${baseurl}dock/activate`, null, { params: { config_id: configId } });
            console.log(`Dock configuration with ID ${configId} activated successfully.`);
        } catch (error) {
            console.error("Error activating dock configuration:", error);
            throw new Error(`Error activating dock configuration`);
        }
    },
    async dockClear() {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            await axios.post(`${baseurl}dock/clear`);
            this.docks_pickups = [];
            this.docks_receivers = [];
            console.log("All docks cleared successfully.");
        } catch (error) {
            console.error("Error clearing docks:", error);
            throw new Error(`Error clearing docks`);
        }
    },
    async deleteDockItem(dock_id: string) {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            await axios.post(`${baseurl}dock/remove-item`, {
                dock_id
            });
            console.log(`Dock item with ID ${dock_id} deleted successfully.`);
            await this.fetchDocks(); // Refresh dock states after deletion
        } catch (error) {
            console.error("Error deleting dock item:", error);
            throw new Error(`Error deleting dock item`);
        }
    },
    async addDockItem(dock_id: string, receiver_dock_id: string, item_id: string, item_weight: number) {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            await axios.post(`${baseurl}dock/add-item`, {
                dock_id,
                receiver_dock_id,
                item_id,
                item_weight
            });
            console.log(`Item added to dock with ID ${dock_id} successfully.`);
            await this.fetchDocks(); // Refresh dock states after addition
        }catch (error) {
            console.error("Error adding item to dock:", error);
            throw new Error(`Error adding item to dock`);
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
    is_active: boolean;
}
interface onlineRobot {
    ip: string;
    hostname: string;
    namespace: string;
    ros_domain_id: string;
    battery: number; //TODO: replace with real battery data from backend
    status: string; 
    timestamp: number;
}
interface Docks {
    dock_type: string;
    dock_id: string;
    status: string;
    robot_id: string;
    item_id: string;
    item_weight: number; // Simulated weight for demonstration
    receiver_dock_id: string; // For pickup docks, this will be null. For receiver docks, this will indicate which pickup dock is assigned to it.
}
interface robotData {
    namespace: string;
    robot_ip: string;
}
