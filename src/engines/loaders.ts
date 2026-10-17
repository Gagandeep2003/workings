/**
 * Engine modules are loaded on demand so a visitor only downloads the code for the tool they open.
 * The same loaders are used by the browser runner, the server (to compute worked examples) and the tests.
 */
import type { Engine, EngineMap, EngineModule } from "@/tools/types";

type Loader = () => Promise<{ engines: EngineMap }>;

export const engineModules: Record<EngineModule, Loader> = {
  "math/percentage": () => import("./math/percentage"),
  "math/fractions": () => import("./math/fractions"),
  "math/numbers": () => import("./math/numbers"),
  "math/commerce": () => import("./math/commerce"),
  "math/motion": () => import("./math/motion"),
  "everyday/dates": () => import("./everyday/dates"),
  "everyday/convert": () => import("./everyday/convert"),
  "everyday/timezone": () => import("./everyday/timezone"),
  "student/marks": () => import("./student/marks"),
  "student/grades": () => import("./student/grades"),
  "career/salary": () => import("./career/salary"),
  "career/time": () => import("./career/time"),
  "career/ctc": () => import("./career/ctc"),
  "money/loans": () => import("./money/loans"),
  "money/growth": () => import("./money/growth"),
  "money/tax": () => import("./money/tax"),
  "developer/json": () => import("./developer/json"),
  "developer/encode": () => import("./developer/encode"),
  "developer/web": () => import("./developer/web"),
  "developer/text": () => import("./developer/text"),
  "developer/regex": () => import("./developer/regex"),
  "developer/qr": () => import("./developer/qr"),
  "exams/ssc": () => import("./exams/ssc"),
  "math/algebra": () => import("./math/algebra"),
  "math/geometry": () => import("./math/geometry"),
  "math/numtheory": () => import("./math/numtheory"),
  "math/statistics": () => import("./math/statistics"),
  "math/scientific": () => import("./math/scientific"),
  "everyday/time": () => import("./everyday/time"),
  "money/planning": () => import("./money/planning"),
  "career/overtime": () => import("./career/overtime"),
  "developer/hash": () => import("./developer/hash"),
  "developer/diff": () => import("./developer/diff"),
  "developer/cron": () => import("./developer/cron"),
  "developer/more": () => import("./developer/more"),
  "developer/markdown": () => import("./developer/markdown"),
  "exams/entrance": () => import("./exams/entrance"),
  "exams/gate": () => import("./exams/gate"),
  "exams/management": () => import("./exams/management"),
  "exams/percentile": () => import("./exams/percentile"),
  "exams/government": () => import("./exams/government"),
  "exams/planner": () => import("./exams/planner"),
};

export async function loadEngine(module: EngineModule, toolId: string): Promise<Engine> {
  const loader = engineModules[module];
  if (!loader) throw new Error(`Unknown engine module "${module}"`);
  const mod = await loader();
  const engine = mod.engines[toolId];
  if (!engine) throw new Error(`Engine module "${module}" has no engine for "${toolId}"`);
  return engine;
}
