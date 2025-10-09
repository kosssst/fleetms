#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import math
import time
import traceback
from datetime import datetime
from typing import List, Dict, Tuple, Optional

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from joblib import dump
import pika
from pymongo import MongoClient
from pymongo.collection import Collection
from bson.objectid import ObjectId


# ================ ENV ================
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://mongo:27017/fleetms")
MONGO_DB  = os.getenv("MONGODB_DB", "fleetms")
QUEUE_IN  = os.getenv("TRAIN_QUEUE", "model-train")
MODELS_ROOT = os.getenv("MODELS_ROOT", "/models")  # volume

# ================ Mongo ================
mongo_client: Optional[MongoClient] = None
db = None
Models: Collection = None
Trips: Collection = None
Samples: Collection = None


def mongo_connect():
    global mongo_client, db, Models, Trips, Samples
    mongo_client = MongoClient(MONGO_URI)
    # Якщо в URI нема /db, дозволимо перевизначити через MONGO_DB
    if "/" in MONGO_URI.split("://", 1)[-1] and MONGO_URI.split("/")[-1]:
        dbname = MONGO_URI.split("/")[-1].split("?")[0]
    else:
        dbname = MONGO_DB
    db = mongo_client[dbname]
    Models  = db["models"]
    Trips   = db["trips"]
    Samples = db["samples"]


# ================ RabbitMQ ================
def make_channel():
    url = os.getenv("RABBITMQ_URL", "amqp://user:password@rabbitmq")
    params = pika.URLParameters(url)
    conn = pika.BlockingConnection(params)
    ch = conn.channel()
    ch.queue_declare(queue=QUEUE_IN, durable=True)
    ch.basic_qos(prefetch_count=1)
    return conn, ch


# ================ Utils ================
def to_oid(s: str) -> Optional[ObjectId]:
    try:
        return ObjectId(s)
    except Exception:
        return None


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def save_text(path: str, text: str):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1 = np.radians(lat1); phi2 = np.radians(lat2)
    dphi = np.radians(lat2 - lat1); dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi/2.0)**2 + np.cos(phi1)*np.cos(phi2)*np.sin(dlambda/2.0)**2
    c = 2*np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c


def robust_rolling(series: pd.Series, window: int = 5) -> pd.Series:
    med = series.rolling(window=window, center=True, min_periods=max(1, window // 2)).median()
    sm = med.rolling(window=window, center=True, min_periods=max(1, window // 2)).mean()
    return sm


def compute_gps_speed(df: pd.DataFrame,
                      gap_s: float = 6.0,
                      same_eps_m: float = 2.0,
                      max_span_s: float = 15.0,
                      min_span_s: float = 1.5) -> pd.Series:
    """
    Якщо координати не змінюються кілька семплів — чекаємо першого з новими координатами
    і розкидаємо середню швидкість на весь “плоский” відрізок; fallback — диференційний розрахунок.
    """
    out = np.full(len(df), np.nan, dtype=float)
    for _, g in df.sort_values(["tripId", "timestamp"]).groupby("tripId", sort=False):
        idx = g.index.to_numpy()
        lat = g["gps_latitude"].astype(float).to_numpy()
        lon = g["gps_longitude"].astype(float).to_numpy()
        ts  = pd.to_datetime(g["timestamp"], utc=True, errors="coerce").astype("int64").to_numpy() / 1e9
        if len(idx) == 0:
            continue
        anchor = 0
        while anchor < len(idx) - 1:
            j = anchor + 1
            while j < len(idx):
                dist_m = haversine_km(lat[anchor], lon[anchor], lat[j], lon[j]) * 1000.0
                if np.isfinite(dist_m) and dist_m > same_eps_m:
                    break
                j += 1
            if j < len(idx):
                dt = ts[j] - ts[anchor]
                if (dt > min_span_s) and (dt <= max_span_s):
                    dist_km = haversine_km(lat[anchor], lon[anchor], lat[j], lon[j])
                    out[idx[anchor+1:j+1]] = (dist_km / dt) * 3600.0
                anchor = j
            else:
                break

        prev_ts  = np.r_[np.nan, ts[:-1]]
        prev_lat = np.r_[np.nan, lat[:-1]]
        prev_lon = np.r_[np.nan, lon[:-1]]
        dt1 = ts - prev_ts
        dist1_km = haversine_km(prev_lat, prev_lon, lat, lon)
        with np.errstate(divide="ignore", invalid="ignore"):
            v1 = (dist1_km / dt1) * 3600.0
        bad = (dt1 <= 0) | (dt1 > gap_s)
        v1[bad] = np.nan
        fill = np.isnan(out[idx]) & np.isfinite(v1)
        out[idx[fill]] = v1[fill]
    return pd.Series(out, index=df.index, name="gpsSpeedKmh")


def complementary_fuse(v_obd: pd.Series, v_gps: pd.Series,
                       base_alpha: float = 0.6,
                       mismatch_thr_kmh: float = 15.0) -> pd.Series:
    alpha = np.full(len(v_obd), float(base_alpha), dtype=float)
    alpha = np.where(v_gps.isna(), 0.85, alpha)
    mismatch = (np.abs(v_obd - v_gps) > mismatch_thr_kmh)
    alpha = np.where(mismatch, np.maximum(alpha, 0.75), alpha)
    fused = alpha * v_obd + (1.0 - alpha) * v_gps
    fused = np.where(np.isnan(fused) & ~v_obd.isna(), v_obd, fused)
    fused = np.where(np.isnan(fused) & ~v_gps.isna(), v_gps, fused)
    return pd.Series(fused, index=v_obd.index, name="speedKmh")


def build_features(df: pd.DataFrame,
                   min_speed_kmh: float = 0.0,
                   gap_s: float = 6.0,
                   alpha: float = 0.6,
                   break_s: float = 120.0,
                   drop_idle: bool = False,
                   idle_speed_kmh: float = 0.05,
                   idle_fuel_mls: float = 0.005,
                   mismatch_kmh: float = 15.0,
                   a_accel_max_ms2: float = 6.0,
                   a_decel_max_ms2: float = 6.0,
                   phys_margin_kmh: float = 5.0,
                   gps_same_eps_m: float = 2.0,
                   gps_min_span_s: float = 1.5,
                   gps_max_span_s: float = 15.0,
                   vmax_kmh: float = 160.0) -> Tuple[pd.DataFrame, List[str]]:
    """
    df приходить уже з плоскими полями:
    gps_latitude, gps_longitude, gps_altitude,
    obd_speed, obd_rpm, obd_throttle, coolantC, intakeC,
    fuelRate, tripId, timestamp
    """
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df = df.dropna(subset=["timestamp", "tripId", "gps_latitude", "gps_longitude"])

    # GPS speed + згладження
    df["gpsSpeedKmh_raw"] = compute_gps_speed(
        df,
        gap_s=gap_s,
        same_eps_m=gps_same_eps_m,
        max_span_s=gps_max_span_s,
        min_span_s=gps_min_span_s
    )
    df["gpsSpeedKmh_smooth"] = (
        df.groupby("tripId", sort=False)[["gpsSpeedKmh_raw"]]
        .apply(lambda s: robust_rolling(s["gpsSpeedKmh_raw"], window=5))
        .reset_index(level=0, drop=True)
    )
    df["gpsSpeedKmh_raw"] = df["gpsSpeedKmh_raw"].clip(upper=vmax_kmh)
    df["gpsSpeedKmh_smooth"] = df["gpsSpeedKmh_smooth"].clip(upper=vmax_kmh)

    # Фізика: перевіряємо GPS за границями прискорення
    dt = df.groupby("tripId", sort=False)[["timestamp"]] \
        .apply(lambda s: s["timestamp"].diff().dt.total_seconds()) \
        .reset_index(level=0, drop=True)

    v_obd_prev = df.groupby("tripId", sort=False)[["obd_speed"]] \
        .apply(lambda s: s["obd_speed"].shift(1)).reset_index(level=0, drop=True)
    v_gps_prev = df.groupby("tripId", sort=False)[["gpsSpeedKmh_smooth"]] \
        .apply(lambda s: s["gpsSpeedKmh_smooth"].shift(1)).reset_index(level=0, drop=True)

    v_prev_ref = v_obd_prev.fillna(v_gps_prev)

    def bounds(prev_v_kmh, dt_s):
        dvp = np.maximum(0.0, dt_s) * float(a_accel_max_ms2) * 3.6
        dvm = np.maximum(0.0, dt_s) * float(a_decel_max_ms2) * 3.6
        lower = np.maximum(0.0, prev_v_kmh - dvm) - float(phys_margin_kmh)
        upper = (prev_v_kmh + dvp) + float(phys_margin_kmh)
        return lower, upper

    gps_low, gps_up = bounds(v_prev_ref, dt)
    gps_ok = (
            df["gpsSpeedKmh_smooth"].isna() |
            v_prev_ref.isna() |
            dt.isna() |
            ((df["gpsSpeedKmh_smooth"] >= gps_low) & (df["gpsSpeedKmh_smooth"] <= gps_up))
    )
    gps_phys_mask = ~gps_ok
    df.loc[gps_phys_mask, "gpsSpeedKmh_smooth"] = np.nan

    # Ф’юзинг швидкостей, OBD ми не відкидаємо
    df["obd_speed"] = pd.to_numeric(df["obd_speed"], errors="coerce")
    df["gpsSpeedKmh_smooth"] = pd.to_numeric(df["gpsSpeedKmh_smooth"], errors="coerce")
    df["speedKmh"] = complementary_fuse(df["obd_speed"], df["gpsSpeedKmh_smooth"],
                                        base_alpha=alpha, mismatch_thr_kmh=mismatch_kmh)
    df["speedKmh"] = df["speedKmh"].clip(upper=vmax_kmh)

    # Таргет
    df["y"] = pd.to_numeric(df["fuelRate"], errors="coerce")
    df = df.dropna(subset=["y"])

    # Прибрати "вимкнений" стан
    if drop_idle:
        sp = df["speedKmh"].fillna(0).abs() <= float(idle_speed_kmh)
        fu = df["y"].fillna(0).abs() <= float(idle_fuel_mls)
        df = df[~(sp & fu)].copy()

    # Прискорення
    def compute_accel(group: pd.DataFrame) -> pd.Series:
        v_ms = (group["speedKmh"] / 3.6).to_numpy()
        t = pd.to_datetime(group["timestamp"], utc=True, errors="coerce").astype("int64").to_numpy() / 1e9
        dt_local = np.diff(t)
        dv1 = np.diff(v_ms)
        with np.errstate(divide="ignore", invalid="ignore"):
            a = dv1 / dt_local
        out = np.r_[np.nan, a]
        out = np.where(np.r_[True, dt_local > gap_s], np.nan, out)
        return pd.Series(out, index=group.index, name="accel_ms2")

    df["accel_ms2"] = (
        df.groupby("tripId", sort=False)[["timestamp", "speedKmh"]]
        .apply(compute_accel).reset_index(level=0, drop=True)
    )

    # Ролінг-ознаки
    for col in ["speedKmh", "accel_ms2", "obd_rpm", "obd_throttle"]:
        df[f"{col}_mean5"] = (
            df.groupby("tripId", sort=False)[[col]]
            .apply(lambda s: s[col].rolling(5, min_periods=1).mean())
            .reset_index(level=0, drop=True)
        )
        df[f"{col}_std5"] = (
            df.groupby("tripId", sort=False)[[col]]
            .apply(lambda s: s[col].rolling(5, min_periods=1).std())
            .reset_index(level=0, drop=True)
        )

    # Уклон (grade)
    def compute_grade(group: pd.DataFrame) -> pd.Series:
        lat = group["gps_latitude"].to_numpy()
        lon = group["gps_longitude"].to_numpy()
        alt = pd.to_numeric(group["gps_altitude"], errors="coerce").to_numpy()
        lat_prev = np.r_[np.nan, lat[:-1]]
        lon_prev = np.r_[np.nan, lon[:-1]]
        alt_prev = np.r_[np.nan, alt[:-1]]
        dist_km = haversine_km(lat_prev, lon_prev, lat, lon)
        dist_m = dist_km * 1000.0
        dh = alt - alt_prev
        grade = np.full_like(dist_m, np.nan, dtype=float)
        valid = np.isfinite(dist_m) & (dist_m > 1e-3) & np.isfinite(dh)
        grade[valid] = dh[valid] / dist_m[valid]
        ser = pd.Series(grade, index=group.index)
        return ser.rolling(window=5, min_periods=1).median()

    df["grade"] = (
        df.groupby("tripId", sort=False)[["gps_latitude", "gps_longitude", "gps_altitude"]]
        .apply(compute_grade).reset_index(level=0, drop=True)
    )

    # Мінімальна швидкість (лишити таргет або швидкість вище порогу)
    if min_speed_kmh > 0:
        df = df[(df["speedKmh"].fillna(0) >= float(min_speed_kmh)) | (df["y"].notna())]

    feature_cols = [
        "speedKmh", "accel_ms2", "obd_rpm", "obd_throttle", "coolantC", "intakeC",
        "speedKmh_mean5", "speedKmh_std5", "accel_ms2_mean5", "accel_ms2_std5",
        "obd_rpm_mean5", "obd_rpm_std5", "obd_throttle_mean5", "obd_throttle_std5", "grade"
    ]
    for c in feature_cols + ["y"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=["y"])
    df = df.dropna(subset=feature_cols, how="all")
    for c in feature_cols:
        df[c] = df[c].fillna(df[c].median())

    out_cols = ["tripId", "timestamp"] + feature_cols + ["y"]
    return df[out_cols].copy(), feature_cols


# ================ Aggregation (No path collisions) ================
def load_samples_for_trips(trip_ids: List[ObjectId]) -> pd.DataFrame:
    """
    Витягаємо семпли по списку tripId через агрегування з плоским $project.
    Це уникає path collision (наприклад, obd vs obd.fuelConsumptionRate).
    """
    if not trip_ids:
        return pd.DataFrame()

    pipeline = [
        {"$match": {"tripId": {"$in": trip_ids}}},
        {"$project": {
            "_id": 0,
            "tripId": 1,
            "timestamp": 1,

            # GPS → плоскі ключі
            "gps_latitude":  "$gps.latitude",
            "gps_longitude": "$gps.longitude",
            "gps_altitude":  "$gps.altitude",

            # OBD → плоскі ключі
            "obd_speed":     "$obd.vehicleSpeed",
            "obd_rpm":       "$obd.engineRpm",
            "obd_throttle":  "$obd.acceleratorPosition",
            "coolantC":      "$obd.engineCoolantTemp",
            "intakeC":       "$obd.intakeAirTemp",

            # Паливо: ifNull(obd.fuelConsumptionRate, fuelConsumptionRate)
            "fuelRate": {"$ifNull": ["$obd.fuelConsumptionRate", "$fuelConsumptionRate"]},
        }}
    ]
    rows = list(Samples.aggregate(pipeline, allowDiskUse=True))
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    # привести типи
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    if "tripId" in df.columns:
        # tripId уже ObjectId → зробимо str для групувань у sklearn
        df["tripId"] = df["tripId"].astype(str)
    return df


# ================ Training ================
def train_and_evaluate(df_feat: pd.DataFrame, feature_cols: List[str], out_dir: str) -> Dict[str, float]:
    from sklearn.model_selection import GroupShuffleSplit
    from sklearn.neural_network import MLPRegressor
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    from sklearn.compose import TransformedTargetRegressor

    ensure_dir(out_dir)
    plots_dir = os.path.join(out_dir, "plots")
    ensure_dir(plots_dir)

    groups = df_feat["tripId"].values
    X = df_feat[feature_cols].values
    y = df_feat["y"].values

    gss = GroupShuffleSplit(n_splits=1, train_size=0.8, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    base_reg = Pipeline([
        ("scaler", StandardScaler()),
        ("mlp", MLPRegressor(
            hidden_layer_sizes=(64, 32, 16),
            activation="relu",
            solver="adam",
            learning_rate_init=1e-3,
            max_iter=300,
            random_state=42,
            alpha=1e-4,
            early_stopping=True,
            n_iter_no_change=10,
            validation_fraction=0.1
        ))
    ])

    model = TransformedTargetRegressor(regressor=base_reg, func=np.log1p, inverse_func=np.expm1)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_pred = np.clip(y_pred, 0.0, None)  # ніколи < 0

    mae = mean_absolute_error(y_test, y_pred)
    rmse = math.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    # save model + columns
    dump(model, os.path.join(out_dir, "model.joblib"))
    with open(os.path.join(out_dir, "feature_columns.json"), "w", encoding="utf-8") as f:
        json.dump(feature_cols, f, ensure_ascii=False, indent=2)

    # plots
    plt.figure()
    plt.scatter(y_test, y_pred, s=8, alpha=0.6)
    lims = [min(np.min(y_test), np.min(y_pred)), max(np.max(y_test), np.max(y_pred))]
    plt.plot(lims, lims, linewidth=1)
    plt.xlabel("Actual fuel rate (mL/s)")
    plt.ylabel("Predicted fuel rate (mL/s)")
    plt.title("Parity plot: BPNN")
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, "parity_bpn.png"), dpi=200)
    plt.close()

    residuals = y_test - y_pred
    plt.figure()
    plt.scatter(y_pred, residuals, s=8, alpha=0.6)
    plt.axhline(0.0, linewidth=1)
    plt.xlabel("Predicted fuel rate (mL/s)")
    plt.ylabel("Residual (mL/s)")
    plt.title("Residuals vs Predicted")
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, "residuals_vs_pred.png"), dpi=200)
    plt.close()

    plt.figure()
    plt.hist(residuals, bins=50)
    plt.xlabel("Residual (mL/s)")
    plt.ylabel("Count")
    plt.title("Residuals distribution")
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, "residuals_hist.png"), dpi=200)
    plt.close()

    plt.figure()
    plt.hist(df_feat.iloc[test_idx]["speedKmh"].values, bins=60)
    plt.xlabel("Fused speed (km/h)")
    plt.ylabel("Count")
    plt.title("Speed distribution (test set)")
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, "speed_hist.png"), dpi=200)
    plt.close()

    with open(os.path.join(out_dir, "metrics.txt"), "w", encoding="utf-8") as f:
        f.write(f"Samples: total={len(df_feat)}, train={len(train_idx)}, test={len(test_idx)}\n")
        f.write(f"MAE (mL/s): {mae:.4f}\nRMSE (mL/s): {rmse:.4f}\nR2: {r2:.4f}\n")

    return {"mae": mae, "rmse": rmse, "r2": r2}


# ================ Trainer Flow ================
def find_manifest(model_id: Optional[str], vehicle_id: Optional[str], version: Optional[str]) -> Optional[dict]:
    """
    Порядок пошуку:
      1) _id
      2) (vehicleId, version)
    """
    q = None
    if model_id:
        oid = to_oid(model_id)
        if oid:
            q = {"_id": oid}
    if q is None and vehicle_id and version:
        vo = to_oid(vehicle_id)
        if vo:
            q = {"vehicleId": vo, "version": version}
    if q is None:
        return None
    return Models.find_one(q)


def update_manifest_status(manifest: dict, status: str, extra: Optional[dict] = None):
    patch = {"status": status, "updatedAt": datetime.utcnow()}
    if extra:
        patch.update(extra)
    Models.update_one({"_id": manifest["_id"]}, {"$set": patch})


def handle_train_job(payload: dict):
    """
    payload: {"modelId": "...", "vehicleId": "...", "version": "..."}
    """
    model_id = payload.get("modelId")
    vehicle_id = payload.get("vehicleId")
    version = payload.get("version")

    manifest = find_manifest(model_id, vehicle_id, version)
    if not manifest:
        print(f"[warn] manifest not found (vehicleId={vehicle_id}, version={version}, modelId={model_id})")
        return

    # Очікувана структура маніфесту:
    # { trainTripsIds: [ObjectId...], valTripsIds: [ObjectId...], vehicleId, version, ... }
    train_ids = [tid for tid in (manifest.get("trainTripsIds") or []) if isinstance(tid, ObjectId)]
    val_ids   = [tid for tid in (manifest.get("valTripsIds") or []) if isinstance(tid, ObjectId)]
    all_ids   = train_ids + val_ids
    if not all_ids:
        print("[warn] manifest has empty trip lists")
        return

    update_manifest_status(manifest, "training")

    # Витягнути семпли агрегуванням без конфліктів
    df = load_samples_for_trips(all_ids)
    if df.empty:
        update_manifest_status(manifest, "failed", {"error": "no_samples"})
        print("[err] no samples found for given trips")
        return

    # Підготовка ознак
    df_feat, feature_cols = build_features(
        df,
        min_speed_kmh=float(os.getenv("MIN_SPEED_KMH", "0.0")),
        gap_s=float(os.getenv("GAP_S", "6.0")),
        alpha=float(os.getenv("ALPHA", "0.6")),
        break_s=float(os.getenv("BREAK_S", "120.0")),
        drop_idle=os.getenv("DROP_IDLE", "false").lower() == "true",
        idle_speed_kmh=float(os.getenv("IDLE_SPEED_KMH", "0.05")),
        idle_fuel_mls=float(os.getenv("IDLE_FUEL_MLS", "0.005")),
        mismatch_kmh=float(os.getenv("MISMATCH_KMH", "15.0")),
        a_accel_max_ms2=float(os.getenv("A_ACCEL_MAX_MS2", "6.0")),
        a_decel_max_ms2=float(os.getenv("A_DECEL_MAX_MS2", "6.0")),
        phys_margin_kmh=float(os.getenv("PHYS_MARGIN_KMH", "5.0")),
        gps_same_eps_m=float(os.getenv("GPS_SAME_EPS_M", "2.0")),
        gps_min_span_s=float(os.getenv("GPS_MIN_SPAN_S", "1.5")),
        gps_max_span_s=float(os.getenv("GPS_MAX_SPAN_S", "15.0")),
        vmax_kmh=float(os.getenv("VMAX_KMH", "160.0")),
    )

    if df_feat.empty:
        update_manifest_status(manifest, "failed", {"error": "no_features"})
        print("[err] df_feat empty after feature build")
        return

    # Тренування + збереження
    vehicle_oid = manifest["vehicleId"]
    vehicle_str = str(vehicle_oid)
    version_str = manifest["version"]
    out_dir = os.path.join(MODELS_ROOT, vehicle_str, version_str)
    ensure_dir(out_dir)

    metrics = train_and_evaluate(df_feat, feature_cols, out_dir)

    # Оновити маніфест
    update_manifest_status(manifest, "completed", {
        "artifacts": {
            "path": out_dir,
            "model_file": "model.joblib",
            "columns_file": "feature_columns.json",
            "plots_dir": "plots",
        },
        "metrics": metrics
    })
    print(f"[ok] trained model saved to {out_dir} :: {metrics}")


# ================ Main loop ================
def on_message(ch, method, properties, body):
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        print("[err] bad payload (not json)")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    print(f"[info] received: {payload}")
    t0 = time.time()
    try:
        handle_train_job(payload)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print("[err] training failed:", e)
        traceback.print_exc()
        # ack все одно, щоб не зависало в черзі нескінченно (або можна nack+requeue=false)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    finally:
        dt = time.time() - t0
        print(f"[info] done in {dt:.2f}s")


def main():
    mongo_connect()
    conn, ch = make_channel()
    print(f"[ready] waiting jobs in '{QUEUE_IN}' ...")
    ch.basic_consume(queue=QUEUE_IN, on_message_callback=on_message)
    try:
        ch.start_consuming()
    except KeyboardInterrupt:
        print("stopping ...")
    finally:
        try:
            ch.stop_consuming()
        except Exception:
            pass
        conn.close()
        if mongo_client:
            mongo_client.close()


if __name__ == "__main__":
    main()
