# predictor.py
# -*- coding: utf-8 -*-
import os, json, argparse, asyncio, math, sys, time, logging, pathlib, datetime
from typing import Optional, Tuple, Dict, Any, List

import numpy as np
import pandas as pd
from pymongo import MongoClient
from bson import ObjectId
from joblib import load

# RabbitMQ (AMQP)
try:
    import aio_pika  # pip install aio-pika
    HAS_AMQP = True
except Exception:
    HAS_AMQP = False


# ==========================
#   LOGGING / DEBUG SETUP
# ==========================

def setup_logging():
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
        stream=sys.stdout,
    )
    logging.getLogger("pika").setLevel(logging.WARNING)
    logging.getLogger("aio_pika").setLevel(logging.WARNING)

logger = logging.getLogger("predictor")


def ensure_dir(p: str):
    pathlib.Path(p).mkdir(parents=True, exist_ok=True)


def _json_default(o):
    """Safe JSON serializer for ObjectId, datetime, numpy, pandas types."""
    if isinstance(o, ObjectId):
        return str(o)
    if isinstance(o, (datetime.datetime, pd.Timestamp)):
        return o.isoformat()
    if isinstance(o, (np.integer, )):
        return int(o)
    if isinstance(o, (np.floating, )):
        return float(o)
    if isinstance(o, (np.bool_, )):
        return bool(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if pd.api.types.is_scalar(o) and pd.isna(o):
        return None
    return str(o)


# ==========================
#   RAW ACCESS HELPERS
# ==========================

def _series_from_path(df: pd.DataFrame, path: str, default=np.nan) -> pd.Series:
    """Get column by dotted path 'a.b' or flat name; default if missing."""
    if path in df.columns:
        return df[path]
    parts = path.split(".")
    root = parts[0]
    if root in df.columns and df[root].apply(lambda x: isinstance(x, dict)).any():
        def dig(d):
            cur = d
            for p in parts[1:]:
                if not isinstance(cur, dict) or p not in cur:
                    return default
                cur = cur[p]
            return cur
        return df[root].apply(dig)
    return pd.Series([default] * len(df), index=df.index)


# ==========================
#   FEATURE ENGINEERING
# ==========================

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    lat1 = np.radians(lat1); lon1 = np.radians(lon1)
    lat2 = np.radians(lat2); lon2 = np.radians(lon2)
    dlat = lat2 - lat1; dlon = lon2 - lon1
    a = np.sin(dlat/2.0)**2 + np.cos(lat1)*np.cos(lat2)*np.sin(dlon/2.0)**2
    c = 2*np.arctan2(np.sqrt(a), np.sqrt(1-a))
    return R * c

def compute_gps_speed_backfill(lat, lon, ts_s,
                               same_eps_m=2.0, min_span_s=1.5, max_span_s=15.0, vmax_kmh=120.0):
    """Backfill-швидкість для плоских (стійких) GPS позицій."""
    n = len(lat)
    v_kmh = np.zeros(n, dtype=float)
    i = 0
    while i < n - 1:
        j = i + 1
        while j < n and haversine_m(lat.iloc[i], lon.iloc[i], lat.iloc[j], lon.iloc[j]) <= same_eps_m:
            j += 1
        if j >= n:
            break
        dist = haversine_m(lat.iloc[i], lon.iloc[i], lat.iloc[j], lon.iloc[j])  # м
        dt = max(1e-6, ts_s.iloc[j] - ts_s.iloc[i])                              # с
        if dt < min_span_s or dt > max_span_s:
            speed_kmh = 0.0
        else:
            speed_kmh = (dist / dt) * 3.6
        v_kmh[i:j+1] = float(np.clip(speed_kmh, 0.0, vmax_kmh))
        i = j
    return v_kmh

def build_engineered_features(df_raw: pd.DataFrame,
                              alpha: float = 0.7,
                              vmax_kmh: float = 120.0,
                              min_speed_kmh: float = 0.0,
                              a_accel_max_ms2: float = 6.0,
                              a_decel_max_ms2: float = 6.0,
                              same_eps_m: float = 2.0,
                              min_span_s: float = 1.5,
                              max_span_s: float = 15.0) -> pd.DataFrame:
    """
    Відтворює фічі, схожі на ті, що в feature_columns.json:
    - speedKmh (злиття GPS+OBD)
    - accel_ms2 (похідна)
    - obd_rpm / obd_throttle / coolantC / intakeC
    - rolling mean/std з вікном 5 для ключових сигналів
    """
    df = df_raw.copy()
    # час
    ts = _series_from_path(df, "timestamp")
    t = pd.to_datetime(ts, utc=True)
    df["timestamp"] = t
    t_s = t.astype("int64") / 1e9
    dt = np.r_[0.0, np.maximum(0.0, np.diff(t_s))]
    df["dt"] = dt

    # GPS
    lat = pd.to_numeric(_series_from_path(df, "gps.latitude"), errors="coerce")
    lon = pd.to_numeric(_series_from_path(df, "gps.longitude"), errors="coerce")
    v_gps = compute_gps_speed_backfill(lat, lon, pd.Series(t_s),
                                       same_eps_m=same_eps_m, min_span_s=min_span_s,
                                       max_span_s=max_span_s, vmax_kmh=vmax_kmh)

    # OBD speed
    v_obd = pd.to_numeric(_series_from_path(df, "obd.vehicleSpeed"), errors="coerce").fillna(0.0).to_numpy()

    # злиття
    speedKmh = np.where(np.isfinite(v_gps), alpha*v_gps + (1-alpha)*v_obd, v_obd)
    speedKmh = np.clip(speedKmh, 0.0, vmax_kmh)
    speedKmh[speedKmh < min_speed_kmh] = 0.0
    df["speedKmh"] = speedKmh

    # прискорення
    v_ms = speedKmh / 3.6
    a = np.r_[0.0, np.diff(v_ms)] / np.maximum(1e-6, dt)
    a = np.clip(a, -a_decel_max_ms2, a_accel_max_ms2)
    df["accel_ms2"] = a

    # плоскі OBD поля під очікувані імена
    df["obd_rpm"] = pd.to_numeric(_series_from_path(df, "obd.engineRpm"), errors="coerce")
    df["obd_throttle"] = pd.to_numeric(_series_from_path(df, "obd.acceleratorPosition"), errors="coerce")
    df["coolantC"] = pd.to_numeric(_series_from_path(df, "obd.engineCoolantTemp"), errors="coerce")
    df["intakeC"] = pd.to_numeric(_series_from_path(df, "obd.intakeAirTemp"), errors="coerce")

    # ролінгові ознаки для ключових сигналів (вікно=5)
    base_signals = ["speedKmh", "accel_ms2", "obd_rpm", "obd_throttle", "coolantC", "intakeC"]
    for col in base_signals:
        if col in df.columns:
            s = pd.to_numeric(df[col], errors="coerce")
            df[f"{col}_mean5"] = s.rolling(window=5, min_periods=1).mean()
            df[f"{col}_std5"]  = s.rolling(window=5, min_periods=1).std(ddof=0)

    return df


def build_X_matching_expected(df_eng: pd.DataFrame, expected_cols: List[str]) -> pd.DataFrame:
    """
    Формує X рівно в порядку expected_cols, підтягує з df_eng або сирих шляхів.
    Все, чого немає — лог і 0.0.
    """
    X = pd.DataFrame(index=df_eng.index)
    missing = []
    for name in expected_cols:
        if name in df_eng.columns:
            X[name] = pd.to_numeric(df_eng[name], errors="coerce")
        else:
            # спроба витягти як dotted path з сирих (раптом у маніфесті такий)
            s = _series_from_path(df_eng, name)
            if s.isna().all():
                missing.append(name)
                X[name] = 0.0
            else:
                X[name] = pd.to_numeric(s, errors="coerce").fillna(0.0)
    if missing:
        logger.warning(f"[features] missing {len(missing)} expected columns -> filled with 0: {missing[:12]}{'...' if len(missing)>12 else ''}")
    return X


def log_feature_diagnostics(X: pd.DataFrame, prefix: str = "[features]"):
    n = len(X)
    if n == 0:
        logger.warning(f"{prefix} EMPTY X")
        return
    non_nan = X.notna().sum() / n
    non_zero = (X.fillna(0.0) != 0).sum() / n
    logger.info(f"{prefix} rows={n}, cols={X.shape[1]}")
    logger.info(f"{prefix} coverage_nonNaN (first 12): {(non_nan.head(12).round(3)).to_dict()}")
    logger.info(f"{prefix} share_nonZero  (first 12): {(non_zero.head(12).round(3)).to_dict()}")
    nz = float(np.linalg.norm(X.fillna(0.0).to_numpy()))
    logger.info(f"{prefix} l2_norm(X)={nz:.6f}")
    with np.printoptions(precision=4, suppress=True):
        logger.debug(f"{prefix} head(3):\n{X.head(3)}")


# ==========================
#   MODEL STORE (volume)
# ==========================

class LocalModelStore:
    """
    /models/{vehicleId}/{version}/
      model.joblib
      feature_columns.json
      meta.json (optional)
    """
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or "/models"
        self._cache: Dict[str, Dict[str, Any]] = {}

    def load(self, vehicle_id: str, version: str) -> Dict[str, Any]:
        key = f"{vehicle_id}@{version}"
        if key in self._cache:
            return self._cache[key]
        base = os.path.join(self.base_dir, vehicle_id, version)
        model_path = os.path.join(base, "model.joblib")
        cols_path  = os.path.join(base, "feature_columns.json")
        meta_path  = os.path.join(base, "meta.json")
        if not (os.path.exists(model_path) and os.path.exists(cols_path)):
            raise FileNotFoundError(f"Model not found at {base}")
        model = load(model_path)
        with open(cols_path, "r", encoding="utf-8") as f:
            feat_cols = json.load(f)
        meta = {}
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        pkg = {"model": model, "feature_cols": feat_cols, "meta": meta, "version": version}
        self._cache[key] = pkg
        return pkg


# ==========================
#          CORE
# ==========================

def _as_oid(s: str) -> Optional[ObjectId]:
    try:
        return ObjectId(s)
    except Exception:
        return None

def fetch_trip_and_samples(mongo: MongoClient, db: str, trip_id: str) -> Tuple[dict, pd.DataFrame]:
    trips = mongo[db]["trips"]
    samples = mongo[db]["samples"]
    oid = _as_oid(trip_id)

    trip = trips.find_one({
        "$or": [
            ({"_id": oid} if oid else {"_id": None}),
            {"_id": trip_id},
            ({"tripId": oid} if oid else {"tripId": None}),
            {"tripId": trip_id},
        ]
    })
    if not trip:
        raise ValueError(f"Trip not found (got '{trip_id}')")

    sample_query = {"$or": [{"tripId": oid}, {"tripId": trip_id}]} if oid else {"tripId": trip_id}
    rows = list(samples.find(sample_query).sort("timestamp", 1))
    if not rows:
        raise ValueError(f"Samples not found for tripId={trip_id}")

    df_raw = pd.json_normalize(rows)
    return trip, df_raw

def _metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    err = y_true - y_pred
    mae = float(np.mean(np.abs(err)))
    rmse = float(math.sqrt(np.mean(err**2)))
    ss_res = float(np.sum(err**2))
    ss_tot = float(np.sum((y_true - np.mean(y_true))**2))
    r2 = float(1.0 - ss_res/ss_tot) if ss_tot > 0 else float("nan")
    return {"MAE": mae, "RMSE": rmse, "R2": r2}

def _summ(vals: np.ndarray) -> Dict[str, float]:
    if vals.size == 0:
        return {"min": np.nan, "p10": np.nan, "mean": np.nan, "p90": np.nan, "max": np.nan, "share_zero": np.nan, "share_neg": np.nan}
    v = vals.astype(float)
    return {
        "min": float(np.nanmin(v)),
        "p10": float(np.nanpercentile(v, 10)),
        "mean": float(np.nanmean(v)),
        "p90": float(np.nanpercentile(v, 90)),
        "max": float(np.nanmax(v)),
        "share_zero": float(np.mean(np.isclose(v, 0.0))),
        "share_neg": float(np.mean(v < 0.0)),
    }

def compute_prediction_summary(df_raw: pd.DataFrame, model, feature_cols: List[str],
                               debug=False, debug_dir=None, trip_id: str = "") -> Dict[str, float]:
    # 0) інженіримо фічі під очікувані назви
    df_eng = build_engineered_features(df_raw)

    # 1) X у тій самій послідовності, що чекала модель
    logger.info(f"[features] expected columns ({len(feature_cols)}): {feature_cols[:12]}{'...' if len(feature_cols)>12 else ''}")
    X = build_X_matching_expected(df_eng, feature_cols)

    # 2) діагностика фіч
    if debug:
        log_feature_diagnostics(X)
        logger.info(f"[features] actual columns ({len(X.columns)}): {list(X.columns[:12])}{'...' if len(X.columns)>12 else ''}")

    # 3) NumPy без імен
    X_np = X.fillna(0.0).to_numpy(dtype=float)

    # 4) час для інтегрування
    t = pd.to_datetime(df_eng["timestamp"], utc=True).astype("int64") / 1e9
    t = t.to_numpy()
    dt = np.r_[0.0, np.maximum(0.0, np.diff(t))]
    if debug:
        dupl_ts = int((pd.Series(t).diff(1).fillna(0) == 0).sum())
        logger.info(f"[time] dt summary: {_summ(dt)} (duplicates_ts={dupl_ts})")

    # 5) y_true з сирих
    y_true_series = _series_from_path(df_raw, "obd.fuelConsumptionRate")
    y_true = pd.to_numeric(y_true_series, errors="coerce").to_numpy()

    # 6) predict
    try:
        y_pred = model.predict(X_np)  # ml/s
    except Exception as e:
        logger.exception("[model] predict() failed")
        raise
    y_pred = np.clip(y_pred, 0.0, None)

    if debug:
        logger.info(f"[pred] y_pred summary: {_summ(y_pred)}")
        if np.isfinite(y_true).any():
            logger.info(f"[true] y_true summary: {_summ(y_true)}")

    # 7) інтеграл → літри
    fuel_mL = float((y_pred * dt).sum())
    fuel_L = fuel_mL / 1000.0

    # 8) середня витрата (L/h)
    avg_mlps = float(np.nanmean(y_pred)) if len(y_pred) else 0.0
    avg_Lph = avg_mlps * 3.6

    # 9) метрики, якщо є y_true
    mae = rmse = r2 = None
    if np.isfinite(y_true).any() and len(y_true) == len(y_pred):
        mask = np.isfinite(y_true)
        if mask.sum() > 0:
            m = _metrics(y_true[mask], y_pred[mask])
            mae, rmse, r2 = m["MAE"], m["RMSE"], m["R2"]
            if debug:
                logger.info(f"[metrics] MAE={mae:.4f} RMSE={rmse:.4f} R2={r2:.4f}")

    summary = {
        "fuelUsedL": round(fuel_L, 2),
        "avgFuelRateLph": round(avg_Lph, 2),
        "MAE": round(mae, 4) if mae is not None else None,
        "RMSE": round(rmse, 4) if rmse is not None else None,
        "R2": round(r2, 4) if r2 is not None else None,
    }

    # 10) debug-артефакти
    if os.getenv("DEBUG_SAVE", "0") == "1":
        ddir = debug_dir or os.getenv("DEBUG_DIR", "/tmp/predictor-debug")
        ensure_dir(ddir)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        base = os.path.join(ddir, f"{trip_id}_{stamp}")
        try:
            X.head(200).to_csv(base + "_X_head.csv", index=False)
            with open(base + "_raw_head.jsonl", "w", encoding="utf-8") as f:
                for rec in df_raw.head(200).to_dict(orient="records"):
                    f.write(json.dumps(rec, ensure_ascii=False, default=_json_default) + "\n")
            meta = {
                "feature_columns_expected": feature_cols,
                "X_cols_actual": list(X.columns),
                "y_pred_summary": _summ(y_pred),
                "y_true_summary": _summ(y_true) if np.isfinite(y_true).any() else None,
                "summary": summary,
            }
            with open(base + "_meta.json", "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2, default=_json_default)
            logger.info(f"[debug] artifacts saved under {base}_*.{{csv,json,jsonl}}")
        except Exception:
            logger.exception("[debug] failed to save artifacts")

    return summary

def upsert_prediction_summary(mongo: MongoClient, db: str, trip_id: str, summary: Dict[str, float]):
    mongo[db]["trips"].update_one(
        {"$or": [{"_id": _as_oid(trip_id)}, {"_id": trip_id}, {"tripId": _as_oid(trip_id)}, {"tripId": trip_id}]},
        {"$set": {"predictionSummary": summary}},
        upsert=False
    )


# ==========================
#     AMQP CONSUMER
# ==========================

async def _connect_amqp(url: str, attempts=20, delay=2):
    last = None
    for _ in range(attempts):
        try:
            return await aio_pika.connect_robust(url, timeout=10)
        except Exception as e:
            last = e
            await asyncio.sleep(delay)
    raise last

async def consume_amqp(mongo_uri: str, db: str, models_dir: str, amqp_url: str, queue_name: str):
    if not HAS_AMQP:
        raise RuntimeError("aio-pika не встановлено (pip install aio-pika)")
    logger.info(f"Connecting to AMQP: {amqp_url}")
    store = LocalModelStore(models_dir)
    mongo = MongoClient(mongo_uri)
    debug = os.getenv("DEBUG_FEATURES", "0") == "1"
    debug_dir = os.getenv("DEBUG_DIR", "/tmp/predictor-debug")

    conn = await _connect_amqp(amqp_url)
    chan = await conn.channel()
    await chan.set_qos(prefetch_count=4)
    queue = await chan.declare_queue(queue_name, durable=True)
    logger.info(f"listening '{queue_name}'")

    async with queue.iterator() as it:
        async for msg in it:
            async with msg.process():
                payload = json.loads(msg.body.decode("utf-8"))
                trip_id = payload["tripId"]
                vehicle_id = payload.get("VehicleId", payload.get("vehicleId"))
                version = payload["version"]

                logger.info(f"trip={trip_id} veh={vehicle_id} ver={version}")
                _, df_raw = fetch_trip_and_samples(mongo, db, trip_id)
                pkg = store.load(vehicle_id, version)
                logger.info(f"[model] loaded version={version}; feature_cols={len(pkg['feature_cols'])}")
                summary = compute_prediction_summary(
                    df_raw, pkg["model"], pkg["feature_cols"],
                    debug=debug, debug_dir=debug_dir, trip_id=str(trip_id)
                )
                upsert_prediction_summary(mongo, db, trip_id, summary)
                logger.info(f"trips.predictionSummary updated: {summary}")


# ==========================
#          CLI
# ==========================

def main():
    setup_logging()
    ap = argparse.ArgumentParser("Trip predictor (versioned models from local volume; independent of trainer)")
    ap.add_argument("--mongo", default=os.getenv("MONGO_URI", "mongodb://mongo:27017"))
    ap.add_argument("--db", default=os.getenv("MONGO_DB", "fleetms"))
    ap.add_argument("--models-dir", default=os.getenv("MODELS_DIR", "/models"))
    ap.add_argument("--amqp-url", default=os.getenv("AMQP_URL") or os.getenv("RABBITMQ_URL") or "amqp://guest:guest@rabbitmq:5672/%2F")
    ap.add_argument("--amqp-queue", default=os.getenv("AMQP_QUEUE", "predict.trip"))
    ap.add_argument("--trip-id", default=None)
    ap.add_argument("--vehicle-id", default=None)
    ap.add_argument("--version", default=None)
    args = ap.parse_args()

    # One-shot mode
    if args.trip_id:
        if not (args.vehicle_id and args.version):
            raise SystemExit("Для --trip-id потрібні також --vehicle-id і --version")
        store = LocalModelStore(args.models_dir)
        mongo = MongoClient(args.mongo)
        _, df_raw = fetch_trip_and_samples(mongo, args.db, args.trip_id)
        pkg = store.load(args.vehicle_id, args.version)
        logger.info(f"[model] loaded version={pkg['version']}; feature_cols={len(pkg['feature_cols'])}")
        debug = os.getenv("DEBUG_FEATURES", "0") == "1"
        debug_dir = os.getenv("DEBUG_DIR", "/tmp/predictor-debug")
        summary = compute_prediction_summary(df_raw, pkg["model"], pkg["feature_cols"], debug=debug, debug_dir=debug_dir, trip_id=str(args.trip_id))
        upsert_prediction_summary(mongo, args.db, args.trip_id, summary)
        print(json.dumps({"tripId": args.trip_id, "predictionSummary": summary}, ensure_ascii=False, default=_json_default))
        return

    # AMQP consumer
    asyncio.run(consume_amqp(args.mongo, args.db, args.models_dir, args.amqp_url, args.amqp_queue))


if __name__ == "__main__":
    main()
