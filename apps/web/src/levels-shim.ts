import type { BoardModel } from "./engine-bridge";
import {
  CAMPAIGN_LEVEL_IDS,
  CAMPAIGN_START_ID,
  CHAPTERS,
  campaignIndex,
  getDailyLevelId,
  isCampaignLevelId,
  LEAGUE_LEVEL_ID,
  nextCampaignLevelId,
  PACKED_LEVEL_IDS,
  SILHOUETTE_LEVEL_IDS,
  TIER_LABEL,
  levelNumber,
  tierForLevel,
} from "../../../packages/levels/src/catalog.ts";
import flow0001 from "../../../packages/levels/src/levels/flow_0001.json";
import flow0002 from "../../../packages/levels/src/levels/flow_0002.json";
import flow0003 from "../../../packages/levels/src/levels/flow_0003.json";
import flow0004 from "../../../packages/levels/src/levels/flow_0004.json";
import flow0005 from "../../../packages/levels/src/levels/flow_0005.json";
import flow0006 from "../../../packages/levels/src/levels/flow_0006.json";
import flow0007 from "../../../packages/levels/src/levels/flow_0007.json";
import flow0008 from "../../../packages/levels/src/levels/flow_0008.json";
import flow0009 from "../../../packages/levels/src/levels/flow_0009.json";
import flow0010 from "../../../packages/levels/src/levels/flow_0010.json";
import flow0011 from "../../../packages/levels/src/levels/flow_0011.json";
import flow0012 from "../../../packages/levels/src/levels/flow_0012.json";
import flow0013 from "../../../packages/levels/src/levels/flow_0013.json";
import flow0014 from "../../../packages/levels/src/levels/flow_0014.json";
import flow0015 from "../../../packages/levels/src/levels/flow_0015.json";
import flow0016 from "../../../packages/levels/src/levels/flow_0016.json";
import flow0017 from "../../../packages/levels/src/levels/flow_0017.json";
import flow0018 from "../../../packages/levels/src/levels/flow_0018.json";
import flow0019 from "../../../packages/levels/src/levels/flow_0019.json";
import flow0020 from "../../../packages/levels/src/levels/flow_0020.json";
import flow0021 from "../../../packages/levels/src/levels/flow_0021.json";
import flow0022 from "../../../packages/levels/src/levels/flow_0022.json";
import flow0023 from "../../../packages/levels/src/levels/flow_0023.json";
import flow0024 from "../../../packages/levels/src/levels/flow_0024.json";
import flow0025 from "../../../packages/levels/src/levels/flow_0025.json";
import flow0026 from "../../../packages/levels/src/levels/flow_0026.json";
import flow0027 from "../../../packages/levels/src/levels/flow_0027.json";
import flow0028 from "../../../packages/levels/src/levels/flow_0028.json";
import flow0029 from "../../../packages/levels/src/levels/flow_0029.json";
import flow0030 from "../../../packages/levels/src/levels/flow_0030.json";
import flow0031 from "../../../packages/levels/src/levels/flow_0031.json";
import flow0032 from "../../../packages/levels/src/levels/flow_0032.json";
import flow0033 from "../../../packages/levels/src/levels/flow_0033.json";
import flow0034 from "../../../packages/levels/src/levels/flow_0034.json";
import flow0035 from "../../../packages/levels/src/levels/flow_0035.json";
import flow0036 from "../../../packages/levels/src/levels/flow_0036.json";
import flow0037 from "../../../packages/levels/src/levels/flow_0037.json";
import flow0038 from "../../../packages/levels/src/levels/flow_0038.json";
import flow0039 from "../../../packages/levels/src/levels/flow_0039.json";
import flow0040 from "../../../packages/levels/src/levels/flow_0040.json";
import flow0041 from "../../../packages/levels/src/levels/flow_0041.json";
import flow0042 from "../../../packages/levels/src/levels/flow_0042.json";
import flow0043 from "../../../packages/levels/src/levels/flow_0043.json";
import flow0044 from "../../../packages/levels/src/levels/flow_0044.json";

const LEVELS = [
  flow0001,
  flow0002,
  flow0003,
  flow0004,
  flow0005,
  flow0006,
  flow0007,
  flow0008,
  flow0009,
  flow0010,
  flow0011,
  flow0012,
  flow0013,
  flow0014,
  flow0015,
  flow0016,
  flow0017,
  flow0018,
  flow0019,
  flow0020,
  flow0021,
  flow0022,
  flow0023,
  flow0024,
  flow0025,
  flow0026,
  flow0027,
  flow0028,
  flow0029,
  flow0030,
  flow0031,
  flow0032,
  flow0033,
  flow0034,
  flow0035,
  flow0036,
  flow0037,
  flow0038,
  flow0039,
  flow0040,
  flow0041,
  flow0042,
  flow0043,
  flow0044,
] as BoardModel[];

export function getLevel(id: string): BoardModel {
  const found = LEVELS.find((level) => level.levelId === id);
  if (!found) throw new Error(`unknown level ${id}`);
  return JSON.parse(JSON.stringify(found)) as BoardModel;
}

export function hasLevel(id: string): boolean {
  return LEVELS.some((level) => level.levelId === id);
}

export function listLevelIds(): string[] {
  return LEVELS.map((level) => level.levelId);
}

export {
  CAMPAIGN_LEVEL_IDS,
  CAMPAIGN_START_ID,
  CHAPTERS,
  campaignIndex,
  getDailyLevelId,
  isCampaignLevelId,
  LEAGUE_LEVEL_ID,
  nextCampaignLevelId,
  PACKED_LEVEL_IDS,
  SILHOUETTE_LEVEL_IDS,
  TIER_LABEL,
  levelNumber,
  tierForLevel,
};
