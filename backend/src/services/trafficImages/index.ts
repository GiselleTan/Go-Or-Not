import { API_URLS } from '../../config/api.js';
import { trafficCameraMapping } from '../../config/trafficCameraMapping.js';
import type { ServiceResult } from '../../types/index.js';
import { withCache } from '../../utils/cache.js';
import type {
  TrafficImageResult,
  TrafficImageAPIResponse,
  Highways,
} from './types.js';

const CACHE_TTL_MINUTES = 15;
const CACHE_PK = 'TrafficImages';

export const getTrafficImages = async (
  highway: Highways,
): Promise<ServiceResult<TrafficImageResult[]>> => {
  return withCache({
    pk: CACHE_PK,
    sk: highway,
    ttlMinutes: CACHE_TTL_MINUTES,
    label: `Traffic images for ${highway}`,
    fetch: async () => {
      const response = await fetch(API_URLS.trafficImages);
      if (!response.ok) {
        throw new Error(
          `Traffic Images API returned ${response.status}: ${response.statusText}`,
        );
      }
      const apiData = (await response.json()) as TrafficImageAPIResponse;

      const requiredCameraIds = Object.entries(trafficCameraMapping)
        .filter(([_, info]) => info.highway === highway)
        .map(([id]) => id);
      const imageData = apiData.items?.[0]?.cameras
        ?.filter((camera) => requiredCameraIds.includes(camera.camera_id))
        .map((data) => {
          return { image: data.image, camera_id: data.camera_id };
        });
      const result =
        imageData?.map((image) => ({
          image: image.image,
          highway,
          description:
            trafficCameraMapping[
              image.camera_id as keyof typeof trafficCameraMapping
            ]?.description,
        })) ?? [];

      return result;
    },
  });
};
