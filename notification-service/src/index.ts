/* eslint-disable no-console */
import mongoose, { Schema, Types, model } from "mongoose";

// -------------------- ENV --------------------
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://mongo:27017/fleetms";
const MONGODB_DB  = process.env.MONGODB_DB  || undefined; // якщо в URI немає /db
const POLL_EVERY_MS = 60_000; // 1 хв

// Пороги
const MIN_KM = Number(process.env.MIN_KM ?? 1);
const MIN_FPRED_L = Number(process.env.MIN_FPRED_L ?? 0);
const REL_THRESH = Number(process.env.REL_THRESH ?? 0.10);

// Slack Incoming Webhook
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "";

// Маленький епсілон для ділення
const EPS = 1e-6;

// -------------------- MODELS --------------------
type PredictionSummary = {
  fuelUsedL?: number | null;
  avgFuelRateLph?: number | null;
  MAE?: number | null;
  RMSE?: number | null;
  R2?: number | null;
} | null;

type TripSummary = {
  distanceKm?: number | null;
  fuelUsedL?: number | null;
} | null;

interface TripDoc {
  _id: Types.ObjectId | string;
  vehicleId?: Types.ObjectId | string | null;
  status?: string;
  endTime?: Date | null;
  summary?: TripSummary;
  predictionSummary?: PredictionSummary;
  companyId?: Types.ObjectId | string;
}

const TripSchema = new Schema<TripDoc>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    status: String,
    endTime: Date,
    summary: Schema.Types.Mixed,
    predictionSummary: Schema.Types.Mixed,
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
  },
  { collection: "trips", strict: false }
);
const TripModel = model<TripDoc>("Trip", TripSchema);

interface VehicleDoc {
  _id: Types.ObjectId | string;
  number?: string;
  companyId?: Types.ObjectId | string;
  needsInspection?: boolean;
  fuelAlert?: {
    lastTripId?: string;
    deviationPct?: number;
    deltaL?: number;
    measuredL?: number;
    predictedL?: number;
    distanceKm?: number;
    flaggedAt?: Date;
    clearedAt?: Date;
  };
}

const VehicleSchema = new Schema<VehicleDoc>(
  {
    number: String,
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    needsInspection: { type: Boolean, default: false },
    fuelAlert: {
      lastTripId: String,
      deviationPct: Number,
      deltaL: Number,
      measuredL: Number,
      predictedL: Number,
      distanceKm: Number,
      flaggedAt: Date,
      clearedAt: Date,
    },
  },
  { collection: "vehicles", strict: false }
);
const VehicleModel = model<VehicleDoc>("Vehicle", VehicleSchema);

// -------------------- SLACK --------------------
// мінімально достатні типи Block Kit
type SlackText = { type: "mrkdwn" | "plain_text"; text: string; emoji?: boolean };

interface SlackSectionBlock {
  type: "section";
  text?: SlackText;
  fields?: SlackText[];
}

interface SlackContextBlock {
  type: "context";
  elements: SlackText[];
}

type SlackBlock = SlackSectionBlock | SlackContextBlock;

// хелпери, щоб зберегти літерали type
const section = (args: { text?: SlackText; fields?: SlackText[] }): SlackSectionBlock => ({
  type: "section",
  ...args,
});
const context = (elements: SlackText[]): SlackContextBlock => ({
  type: "context",
  elements,
});

async function slackPost(payload: { text: string; blocks?: SlackBlock[] }) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    const body = SLACK_CHANNEL
      ? { channel: SLACK_CHANNEL, ...payload }   // деякі вебхуки поважають це поле
      : payload;

    const resp = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.error("[slack] non-OK response:", resp.status, await resp.text());
    }
  } catch (e) {
    console.error("[slack] send error:", e);
  }
}

async function notifyOverconsumption(params: {
  vehicleNumber: string;
  tripId: string;
  deviationPct: number;
  deltaL: number;
  measuredL: number;
  predictedL: number;
  distanceKm: number;
}) {
  const {
    vehicleNumber, tripId, deviationPct, deltaL, measuredL, predictedL, distanceKm,
  } = params;

  const text = `:warning: Vehicle *${vehicleNumber}* overconsumption detected (+${deviationPct.toFixed(1)}%).`;
  const blocks: SlackBlock[] = [
    section({ text: { type: "mrkdwn", text: `*:warning: Overconsumption detected* for *${vehicleNumber}*` } }),
    section({
      fields: [
        { type: "mrkdwn", text: `*Deviation:* +${deviationPct.toFixed(1)}%` },
        { type: "mrkdwn", text: `*Δ fuel:* ${deltaL.toFixed(2)} L` },
        { type: "mrkdwn", text: `*Measured:* ${measuredL.toFixed(2)} L` },
        { type: "mrkdwn", text: `*Predicted:* ${predictedL.toFixed(2)} L` },
        { type: "mrkdwn", text: `*Distance:* ${distanceKm.toFixed(1)} km` },
        { type: "mrkdwn", text: `*Trip:* \`${String(tripId)}\`` },
      ],
    }),
    context([{ type: "mrkdwn", text: "_The vehicle has been marked as needs inspection._" }]),
  ];

  await slackPost({ text, blocks });
}

async function notifyBackToNormal(params: {
  vehicleNumber: string;
  lastTripId?: string;
  previousDeviationPct?: number;
}) {
  const { vehicleNumber, lastTripId, previousDeviationPct } = params;

  const text = `:white_check_mark: Vehicle *${vehicleNumber}* fuel consumption back to normal.`;
  const fields: SlackText[] = [];
  if (typeof previousDeviationPct === "number") {
    fields.push({ type: "mrkdwn", text: `*Prev deviation:* +${previousDeviationPct.toFixed(1)}%` });
  }
  if (lastTripId) {
    fields.push({ type: "mrkdwn", text: `*Last trip:* \`${String(lastTripId)}\`` });
  }

  const blocks: SlackBlock[] = [
    section({ text: { type: "mrkdwn", text: `*:white_check_mark: Back to normal* for *${vehicleNumber}*` } }),
    ...(fields.length ? [section({ fields })] : []),
    context([{ type: "mrkdwn", text: "_Inspection flag cleared._" }]),
  ];

  await slackPost({ text, blocks });
}

// -------------------- CORE LOGIC --------------------
function relDeviation(fActualL: number, fPredL: number): number {
  return (fActualL - fPredL) / Math.max(fPredL, EPS);
}

async function processVehicle(vehicle: VehicleDoc) {
  const vid = vehicle._id;
  if (!vid) return;

  // Остання завершена поїздка з предиктом
  const lastTrip = await TripModel.findOne({
    vehicleId: new Types.ObjectId(String(vid)),
    status: "completed",
    predictionSummary: { $exists: true, $ne: null },
  })
    .sort({ endTime: -1 })
    .lean<TripDoc>()
    .exec();

  if (!lastTrip) return;

  const D = Number(lastTrip.summary?.distanceKm ?? 0);
  const F_act = Number(lastTrip.summary?.fuelUsedL ?? 0);
  const F_pred = Number(lastTrip.predictionSummary?.fuelUsedL ?? 0);

  // фільтри якості
  if (!(D > MIN_KM) || !(F_pred >= MIN_FPRED_L)) {
    if (vehicle.needsInspection) {
      const prevDev = vehicle.fuelAlert?.deviationPct;
      await VehicleModel.updateOne(
        { _id: vehicle._id },
        {
          $set: {
            needsInspection: false,
            "fuelAlert.clearedAt": new Date(),
          },
        }
      ).exec();

      await notifyBackToNormal({
        vehicleNumber: vehicle.number ?? String(vehicle._id),
        lastTripId: vehicle.fuelAlert?.lastTripId,
        previousDeviationPct: typeof prevDev === "number" ? prevDev : undefined,
      });
    }
    return;
  }

  const dev = relDeviation(F_act, F_pred); // >0 — перевитрата
  const shouldFlag = dev > REL_THRESH;

  if (shouldFlag) {
    const deltaL = F_act - F_pred;
    const deviationPct = dev * 100;

    if (!vehicle.needsInspection) {
      await VehicleModel.updateOne(
        { _id: vehicle._id },
        {
          $set: {
            needsInspection: true,
            fuelAlert: {
              lastTripId: String(lastTrip._id),
              deviationPct: Number(deviationPct.toFixed(1)),
              deltaL: Number(deltaL.toFixed(2)),
              measuredL: Number(F_act.toFixed(2)),
              predictedL: Number(F_pred.toFixed(2)),
              distanceKm: Number(D.toFixed(2)),
              flaggedAt: new Date(),
              clearedAt: undefined,
            },
          },
        }
      ).exec();

      await notifyOverconsumption({
        vehicleNumber: vehicle.number ?? String(vehicle._id),
        tripId: String(lastTrip._id),
        deviationPct,
        deltaL,
        measuredL: F_act,
        predictedL: F_pred,
        distanceKm: D,
      });
    } else {
      // оновимо деталі без повторного Slack
      await VehicleModel.updateOne(
        { _id: vehicle._id },
        {
          $set: {
            fuelAlert: {
              lastTripId: String(lastTrip._id),
              deviationPct: Number((dev * 100).toFixed(1)),
              deltaL: Number((F_act - F_pred).toFixed(2)),
              measuredL: Number(F_act.toFixed(2)),
              predictedL: Number(F_pred.toFixed(2)),
              distanceKm: Number(D.toFixed(2)),
              flaggedAt: vehicle.fuelAlert?.flaggedAt ?? new Date(),
              clearedAt: undefined,
            },
          },
        }
      ).exec();
    }
  } else {
    if (vehicle.needsInspection) {
      const prevDev = vehicle.fuelAlert?.deviationPct;
      await VehicleModel.updateOne(
        { _id: vehicle._id },
        {
          $set: {
            needsInspection: false,
            "fuelAlert.clearedAt": new Date(),
          },
        }
      ).exec();

      await notifyBackToNormal({
        vehicleNumber: vehicle.number ?? String(vehicle._id),
        lastTripId: vehicle.fuelAlert?.lastTripId,
        previousDeviationPct: typeof prevDev === "number" ? prevDev : undefined,
      });
    }
  }
}

let isRunning = false;

async function tick() {
  if (isRunning) {
    console.log("[skip] previous run still in progress");
    return;
  }
  isRunning = true;
  const t0 = Date.now();
  try {
    const vehicles = await VehicleModel.find({})
      .select({ _id: 1, number: 1, companyId: 1, needsInspection: 1, fuelAlert: 1 })
      .lean<VehicleDoc[]>()
      .exec();

    console.log(`[run] vehicles=${vehicles.length}`);
    for (const v of vehicles) {
      try {
        await processVehicle(v);
      } catch (e) {
        console.error(`[err] vehicle ${v.number ?? v._id}:`, e);
      }
    }
  } catch (e) {
    console.error("[fatal] tick:", e);
  } finally {
    const dt = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`[done] dt=${dt}s`);
    isRunning = false;
  }
}

// -------------------- BOOT --------------------
async function main() {
  const conn = await mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB,
  } as any);
  conn.connection.on("error", (err) => console.error("[mongo] error:", err));
  console.log("[ready] connected to Mongo");

  tick(); // перший запуск одразу
  setInterval(tick, POLL_EVERY_MS); // далі — кожну хвилину
}

main().catch((e) => {
  console.error("[fatal] cannot start:", e);
  process.exit(1);
});
