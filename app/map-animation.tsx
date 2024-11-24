"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";

const MapboxExample = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const originRef = useRef<[number, number]>(null);
  const planeRef = useRef<GeoJSON.FeatureCollection>(null);
  const planeRouteRef = useRef<GeoJSON.FeatureCollection>(null);
  const droneRef = useRef<GeoJSON.FeatureCollection>(null);
  const droneRouteRef = useRef<GeoJSON.FeatureCollection>(null);
  const [disabled, setDisabled] = useState(true);
  const steps = 500;
  let counter = 0;
  const [startCoords, setStartCoords] = useState([37.6173, 55.7558]);
  const [endCoords, setEndCoords] = useState([30.5234, 50.4501]);

  function handleClick() {
    planeRef.current.features[0].geometry.coordinates = originRef.current;
    droneRef.current.features[0].geometry.coordinates = originRef.current;
    mapRef.current.getSource("plane").setData(planeRef.current);
    mapRef.current.getSource("drone").setData(droneRef.current);
    animate(0);
    setDisabled(true);
  }

  function animate() {
    const start =
      planeRouteRef.current.features[0].geometry.coordinates[
        counter >= steps ? counter - 1 : counter
      ];
    const end =
      planeRouteRef.current.features[0].geometry.coordinates[
        counter >= steps ? counter : counter + 1
      ];

    const start2 =
      droneRouteRef.current.features[0].geometry.coordinates[
        counter >= steps ? counter - 1 : counter
      ];
    const end2 =
      droneRouteRef.current.features[0].geometry.coordinates[
        counter >= steps ? counter : counter + 1
      ];

    if (!start || !end || !start2 || !end2) {
      setDisabled(false);
      return;
    }

    planeRef.current.features[0].geometry.coordinates =
      planeRouteRef.current.features[0].geometry.coordinates[counter];
    droneRef.current.features[0].geometry.coordinates =
      droneRouteRef.current.features[0].geometry.coordinates[counter];

    planeRef.current.features[0].properties.bearing = turf.bearing(
      turf.point(start),
      turf.point(end)
    );
    droneRef.current.features[0].properties.bearing = turf.bearing(
      turf.point(start2),
      turf.point(end2)
    );

    mapRef.current.getSource("plane").setData(planeRef.current);
    mapRef.current.getSource("drone").setData(droneRef.current);

    if (counter < steps) {
      requestAnimationFrame(animate);
    }

    counter = counter + 1;
  }

  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      // style: "mapbox://styles/mapbox/satellite-v9",
      center: [30, 50],
      zoom: 4,
      pitch: 40,
    });

    const origin = startCoords;
    originRef.current = origin;
    const destination = endCoords;

    const planeRoute = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [origin, destination],
          },
        },
      ],
    };
    planeRouteRef.current = planeRoute;

    const plane = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: origin,
          },
        },
      ],
    };
    planeRef.current = plane;

    const drone = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: origin,
          },
        },
      ],
    };
    droneRef.current = drone;

    const lineDistance = turf.length(planeRoute.features[0]);
    const arc = [];

    for (let i = 0; i < lineDistance; i += lineDistance / steps) {
      const segment = turf.along(planeRoute.features[0], i);
      arc.push(segment.geometry.coordinates);
    }

    planeRoute.features[0].geometry.coordinates = arc;

    const origin2 = [36.2304, 50.0055];
    const destination2 = [
      (origin[0] + destination[0]) / 2,
      (origin[1] + destination[1]) / 2,
    ];

    const droneRoute = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [origin2, destination2],
          },
        },
      ],
    };
    droneRouteRef.current = droneRoute;

    const lineDistance2 = turf.length(droneRoute.features[0]);
    const arc2 = [];

    for (let i = 0; i < lineDistance2; i += lineDistance2 / steps) {
      const segment = turf.along(droneRoute.features[0], i);
      arc2.push(segment.geometry.coordinates);
    }

    droneRoute.features[0].geometry.coordinates = arc2;

    mapRef.current.on("load", () => {
      mapRef.current.addSource("planeRoute", {
        type: "geojson",
        data: planeRoute,
      });

      mapRef.current.addSource("plane", {
        type: "geojson",
        data: plane,
      });

      mapRef.current.addSource("drone", {
        type: "geojson",
        data: drone,
      });

      mapRef.current.addSource("droneRoute", {
        type: "geojson",
        data: droneRoute,
      });

      mapRef.current.addLayer({
        id: "planeRoute",
        source: "planeRoute",
        type: "line",
        paint: {
          "line-width": 2,
          "line-color": "#007cbf",
        },
      });

      mapRef.current.addLayer({
        id: "plane",
        source: "plane",
        type: "symbol",
        layout: {
          "icon-image": "rocket",
          "icon-size": 1.2,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      mapRef.current.addLayer({
        id: "drone",
        source: "drone",
        type: "symbol",
        layout: {
          "icon-image": "rocket",
          "icon-size": 1.0,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-color": "#ff0000",
        },
      });

      mapRef.current.addLayer({
        id: "droneRoute",
        source: "droneRoute",
        type: "line",
        paint: {
          "line-width": 2,
          "line-color": "#bf0000",
        },
      });

      animate(counter);
    });

    // Cleanup function
    return () => mapRef.current.remove();
  }, [startCoords, endCoords]);

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        position: "relative",
      }}
    >
      <div
        ref={mapContainerRef}
        style={{
          height: "100%",
          width: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "10px",
          borderRadius: "5px",
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: "5px" }}>
            Start coordinates:
          </label>
          <input
            type="text"
            placeholder="longitude"
            value={startCoords[0]}
            onChange={(e) =>
              setStartCoords([parseFloat(e.target.value), startCoords[1]])
            }
            style={{ width: "80px", background: "black" }}
          />
          <input
            type="text"
            placeholder="latitude"
            value={startCoords[1]}
            onChange={(e) =>
              setStartCoords([startCoords[0], parseFloat(e.target.value)])
            }
            style={{ width: "80px", background: "black" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px" }}>
            End coordinates:
          </label>
          <input
            type="text"
            placeholder="longitude"
            value={endCoords[0]}
            onChange={(e) =>
              setEndCoords([parseFloat(e.target.value), endCoords[1]])
            }
            style={{ width: "80px", background: "black" }}
          />
          <input
            type="text"
            placeholder="latitude"
            value={endCoords[1]}
            onChange={(e) =>
              setEndCoords([endCoords[0], parseFloat(e.target.value)])
            }
            style={{ width: "80px", background: "black" }}
          />
        </div>

        <button
          disabled={disabled}
          style={{
            backgroundColor: disabled ? "#f5f5f5" : "#3386c0",
            color: disabled ? "#c3c3c3" : "#fff",
            display: "inline-block",
            margin: "0",
            padding: "10px 20px",
            border: "none",
            cursor: "pointer",
            borderRadius: "3px",
          }}
          onClick={handleClick}
          id="replay"
        >
          Replay
        </button>
      </div>
    </div>
  );
};

export default MapboxExample;
