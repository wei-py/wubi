import { STAGES } from "../data/stages.js";
import { useSave } from "./useSave.js";

/** All lessons are available; progress only records practice achievements. */
export function useLevels() {
  const { isLevelPassed, getLevelResult, recordLevelResult } = useSave();

  function stageProgress(stage) {
    const total = stage.levels.length;
    const passed = stage.levels.filter((level) => isLevelPassed(level.id)).length;
    return { passed, total };
  }

  function recordResult(levelId, speed, accuracy, passed, timeouts) {
    recordLevelResult(levelId, speed, accuracy, passed, timeouts);
  }

  return {
    stages: STAGES,
    isLevelPassed,
    levelResult: getLevelResult,
    stageProgress,
    recordResult,
  };
}
