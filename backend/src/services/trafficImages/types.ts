import { trafficCameraMapping } from '../../config/trafficCameraMapping.js';
interface ItemData {
  timestamp: string;
  cameras: Array<CameraData>;
}

interface CameraData {
  timestamp: string;
  image: string;
  location: {
    latitude: number;
    longitude: number;
  };
  camera_id: string;
  image_metadata: {
    height: number;
    width: number;
    md5: string;
  };
}

export interface TrafficImageAPIResponse {
  items: Array<ItemData>;
}

export interface TrafficImageResult {
  highway: string;
  description: string;
  image: string;
}

export type Highways =
  (typeof trafficCameraMapping)[keyof typeof trafficCameraMapping]['highway'];
