"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTripById, reanalyzeTrip, deleteTrip } from "@/services/trip.service";
import { Trip } from "@/types/trip.types";
import {
  Paper,
  Title,
  Text,
  Grid,
  Button,
  Group,
  useMantineTheme,
  Checkbox,
} from "@mantine/core";
import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const TripDetailsPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const theme = useMantineTheme();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // visibility of speed series
  const [seriesVisible, setSeriesVisible] = useState({
    gps: true,
    obd: true,
    merged: true,
  });

  // fix for SyntheticEvent pooling: read checked before setState
  const handleSeriesToggle =
    (key: "gps" | "obd" | "merged") =>
      (e: ChangeEvent<HTMLInputElement>) => {
        const { checked } = e.currentTarget; // read now, before state update
        setSeriesVisible((s) => ({ ...s, [key]: checked }));
      };

  const formatDuration = (totalSeconds: number) => {
    const seconds = Math.round(totalSeconds);
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    let formatted = "";
    if (days > 0) formatted += `${days}d `;
    if (hours > 0) formatted += `${hours}h `;
    if (minutes > 0) formatted += `${minutes}m `;
    formatted += `${remainingSeconds}s`;

    return formatted.trim();
  };

  const handleReanalyze = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      await reanalyzeTrip(id as string);
      window.location.reload();
    } catch {
      setError("Failed to reanalyze trip");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (window.confirm("Are you sure you want to delete this trip?")) {
      setLoading(true);
      setError(null);
      try {
        await deleteTrip(id as string);
        router.push("/company/trips");
      } catch {
        setError("Failed to delete trip");
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (id) {
      const fetchTripDetails = async () => {
        const tripData = await getTripById(id as string);
        setTrip(tripData);
      };
      fetchTripDetails();
    }
  }, [id]);

  if (!trip) {
    return <div>Loading...</div>;
  }

  const route =
    trip.summary?.route.map((point) => [point.longitude, point.latitude]) || [];

  // data for speed chart
  const speedData =
    trip.summary?.speedProfile?.map((p) => ({
      t: new Date(p.timestamp).getTime(),
      timeLabel: new Date(p.timestamp).toLocaleTimeString(),
      gps: Number.isFinite(p.gpsSpeedKph) ? p.gpsSpeedKph : 0,
      obd: Number.isFinite(p.obdSpeedKph) ? p.obdSpeedKph : 0,
      merged: Number.isFinite(p.mergedSpeedKph) ? p.mergedSpeedKph : 0,
    })) ?? [];

  // line colors
  const cGps = theme.colors.blue?.[6] ?? "#228be6";
  const cObd = theme.colors.red?.[6] ?? "#fa5252";
  const cMerged = theme.colors.green?.[6] ?? "#40c057";

  return (
    <div className="main-context">
      <Button onClick={() => router.back()} mb="md">
        Return
      </Button>
      <Group justify="apart" mb="md">
        <Title order={2}>Trip Details</Title>
        <Group>
          <Button onClick={handleReanalyze} disabled={loading}>
            {loading ? "Reanalyzing..." : "Re-analyze"}
          </Button>
          <Button color="red" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </Group>
      </Group>
      {error && <Text color="red">{error}</Text>}
      <Grid>
        <Grid.Col span={8}>
          <Paper withBorder radius="md" p="md" style={{ height: "400px" }}>
            {route.length > 0 && (
              <MapContainer
                center={route[0] as [number, number]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {route.length > 1 ? (
                  <Polyline positions={route as [number, number][]} weight={5} />
                ) : (
                  <CircleMarker
                    center={route[0] as [number, number]}
                    radius={5}
                    color="red"
                  />
                )}
              </MapContainer>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={4}>
          <Paper withBorder radius="md" p="md">
            <Title order={3}>Summary</Title>
            {trip.summary ? (
              <>
                <Text>Duration: {formatDuration(trip.summary.durationSec)}</Text>
                <Text>Distance: {trip.summary.distanceKm}km</Text>
                <Text>Average Speed: {trip.summary.avgSpeedKph}km/h</Text>
                <Text>Max Speed: {trip.summary.maxSpeedKph}km/h</Text>
                <Text>Average RPM: {trip.summary.avgRpm}</Text>
                <Text>Max RPM: {trip.summary.maxRpm}</Text>
                <Text>Fuel Used: {trip.summary.fuelUsedL}L</Text>
                <Text>
                  Average Fuel Rate: {trip.summary.avgFuelRateLph}L/h
                </Text>
                {trip.summary.fuelUsedInIdleL ? (
                  <Text>Fuel Used in Idle: {trip.summary.fuelUsedInIdleL}L</Text>
                ) : null}
                {trip.summary.fuelUsedInMotionL ? (
                  <Text>
                    Fuel Used in Motion: {trip.summary.fuelUsedInMotionL}L
                  </Text>
                ) : null}
                {trip.summary.idleDurationSec ? (
                  <Text>
                    Idle Duration: {formatDuration(trip.summary.idleDurationSec)}
                  </Text>
                ) : null}
                {trip.summary.motionDurationSec ? (
                  <Text>
                    Motion Duration:{" "}
                    {formatDuration(trip.summary.motionDurationSec)}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text>Summary not available.</Text>
            )}
          </Paper>
          <Paper withBorder radius="md" p="md" mt="md">
            <Title order={3}>Prediction Summary</Title>
            {trip.predictionSummary ? (
              <>
                <Text>Fuel Used: {trip.predictionSummary.fuelUsedL}L</Text>
                <Text>
                  Average Fuel Rate: {trip.predictionSummary.avgFuelRateLph}L/h
                </Text>
                <Text>MAE: {trip.predictionSummary.MAE}</Text>
                <Text>RMSE: {trip.predictionSummary.RMSE}</Text>
                <Text>R²: {trip.predictionSummary.R2}</Text>
              </>
            ) : (
              <Text>Prediction summary not available.</Text>
            )}
          </Paper>
        </Grid.Col>

        {/* Speed chart with checkboxes */}
        <Grid.Col span={12}>
          <Paper withBorder radius="md" p="md" style={{ height: 360 }}>
            <Group justify="space-between" align="center" mb="sm">
              <Title order={3}>Speed profile</Title>
              <Group gap="md">
                <Checkbox
                  label="GPS"
                  checked={seriesVisible.gps}
                  onChange={handleSeriesToggle("gps")}
                />
                <Checkbox
                  label="OBD"
                  checked={seriesVisible.obd}
                  onChange={handleSeriesToggle("obd")}
                />
                <Checkbox
                  label="Merged"
                  checked={seriesVisible.merged}
                  onChange={handleSeriesToggle("merged")}
                />
              </Group>
            </Group>

            {speedData.length > 0 ? (
              <div style={{ width: "100%", height: "calc(100% - 48px)" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={speedData}
                    margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(ts: number) =>
                        new Date(ts).toLocaleTimeString()
                      }
                      tick={{ fontSize: 12 }}
                      minTickGap={40}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "km/h",
                        angle: -90,
                        position: "insideLeft",
                        offset: 8,
                      }}
                    />
                    <Tooltip
                      formatter={(v: unknown, name: unknown) => [
                        typeof v === "number" ? v.toFixed(2) : String(v ?? ""),
                        String(name ?? ""),
                      ]}
                      labelFormatter={(ts: unknown) =>
                        typeof ts === "number"
                          ? new Date(ts).toLocaleTimeString()
                          : String(ts ?? "")
                      }
                    />
                    <Legend />
                    {seriesVisible.gps && (
                      <Line
                        type="monotone"
                        dataKey="gps"
                        name="GPS"
                        stroke={cGps}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                        connectNulls
                      />
                    )}
                    {seriesVisible.obd && (
                      <Line
                        type="monotone"
                        dataKey="obd"
                        name="OBD"
                        stroke={cObd}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    )}
                    {seriesVisible.merged && (
                      <Line
                        type="monotone"
                        dataKey="merged"
                        name="Merged"
                        stroke={cMerged}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Text c="dimmed" size="sm">
                No speed profile data
              </Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </div>
  );
};

export default TripDetailsPage;
