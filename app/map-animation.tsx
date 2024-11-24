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
  const dronesRef = useRef<GeoJSON.FeatureCollection[]>([]);
  const droneRoutesRef = useRef<GeoJSON.FeatureCollection[]>([]);
  const [disabled, setDisabled] = useState(true);
  const steps = 500;
  const counterRef = useRef(0);
  const [startCoords, setStartCoords] = useState([37.6173, 55.7558]);
  const [endCoords, setEndCoords] = useState([30.5234, 50.4501]);

  // Add power plant locations
  const powerPlants = [
    { name: "Kharkiv", coords: [35.9544, 50.1627] },
    { name: "Zaporizhzhia", coords: [34.575, 47.5083] },
    { name: "South Ukraine", coords: [31.2333, 47.8] },
    { name: "Rivne", coords: [25.875, 51.325] },
    { name: "Khmelnytskyi", coords: [26.6333, 50.3] },
    { name: "Burshtyn", coords: [24.6333, 49.25] },
  ];

  function handleReplay() {
    counterRef.current = 0;
    planeRef.current.features[0].geometry.coordinates = originRef.current;
    dronesRef.current.forEach((drone, i) => {
      drone.features[0].geometry.coordinates = powerPlants[i].coords;
      mapRef.current.getSource(`drone${i}`).setData(drone);
    });
    mapRef.current.getSource("plane").setData(planeRef.current);
    animate(0);
    setDisabled(true);
  }

  function animate() {
    const start =
      planeRouteRef.current.features[0].geometry.coordinates[
        counterRef.current >= steps ? counterRef.current - 1 : counterRef.current
      ];
    const end =
      planeRouteRef.current.features[0].geometry.coordinates[
        counterRef.current >= steps ? counterRef.current : counterRef.current + 1
      ];

    if (!start || !end) {
      setDisabled(false);
      return;
    }

    planeRef.current.features[0].geometry.coordinates =
      planeRouteRef.current.features[0].geometry.coordinates[counterRef.current];

    planeRef.current.features[0].properties.bearing = turf.bearing(
      turf.point(start),
      turf.point(end)
    );

    mapRef.current.getSource("plane").setData(planeRef.current);

    // Handle multiple drones
    dronesRef.current.forEach((drone, i) => {
      const droneRoute = droneRoutesRef.current[i];
      const start =
        droneRoute.features[0].geometry.coordinates[
          counterRef.current >= steps ? counterRef.current - 1 : counterRef.current
        ];
      const end =
        droneRoute.features[0].geometry.coordinates[
          counterRef.current >= steps ? counterRef.current : counterRef.current + 1
        ];

      if (start && end) {
        drone.features[0].geometry.coordinates =
          droneRoute.features[0].geometry.coordinates[counterRef.current];
        drone.features[0].properties.bearing = turf.bearing(
          turf.point(start),
          turf.point(end)
        );
        mapRef.current.getSource(`drone${i}`).setData(drone);
      }
    });

    if (counterRef.current < steps) {
      requestAnimationFrame(animate);
    }

    counterRef.current = counterRef.current + 1;
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

    // Create plane route with arc
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

    // Calculate arc points for plane route
    const lineDistance = turf.length(planeRoute.features[0]);
    const arc = [];
    for (let i = 0; i < lineDistance; i += lineDistance / steps) {
      const segment = turf.along(planeRoute.features[0], i);
      arc.push(segment.geometry.coordinates);
    }
    planeRoute.features[0].geometry.coordinates = arc;
    planeRouteRef.current = planeRoute;

    // Create plane point
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

    mapRef.current.on("load", () => {
      // Add plane sources and layers first
      mapRef.current.addSource("planeRoute", {
        type: "geojson",
        data: planeRoute,
      });

      mapRef.current.addSource("plane", {
        type: "geojson",
        data: plane,
      });

      // Add plane layer
      mapRef.current.addLayer({
        id: "plane",
        source: "plane",
        type: "symbol",
        layout: {
          "icon-image": "airport", // Using a built-in Mapbox icon
          "icon-size": 1.5,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // Add plane route layer
      mapRef.current.addLayer({
        id: "planeRoute",
        source: "planeRoute",
        type: "line",
        paint: {
          "line-width": 2,
          "line-color": "#ff0000",
        },
      });

      // Initialize multiple drones and their routes
      powerPlants.forEach((plant, i) => {
        // Calculate intercept point (midpoint between plant and plane destination)
        const destination2 = [
          (plant.coords[0] + destination[0]) / 2,
          (plant.coords[1] + destination[1]) / 2,
        ];

        // Create drone
        const drone = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Point",
                coordinates: plant.coords,
              },
            },
          ],
        };
        dronesRef.current[i] = drone;

        // Create drone route
        const droneRoute = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [plant.coords, destination2],
              },
            },
          ],
        };

        // Calculate arc points for smooth animation
        const lineDistance = turf.length(droneRoute.features[0]);
        const arc = [];
        for (let i = 0; i < lineDistance; i += lineDistance / steps) {
          const segment = turf.along(droneRoute.features[0], i);
          arc.push(segment.geometry.coordinates);
        }
        droneRoute.features[0].geometry.coordinates = arc;
        droneRoutesRef.current[i] = droneRoute;
      });

      // Add sources and layers for each drone
      powerPlants.forEach((_, i) => {
        mapRef.current.addSource(`drone${i}`, {
          type: "geojson",
          data: dronesRef.current[i],
        });

        mapRef.current.addSource(`droneRoute${i}`, {
          type: "geojson",
          data: droneRoutesRef.current[i],
        });

        mapRef.current.addLayer({
          id: `drone${i}`,
          source: `drone${i}`,
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
            "icon-color": `#ffffff`,
          },
        });

        mapRef.current.addLayer({
          id: `droneRoute${i}`,
          source: `droneRoute${i}`,
          type: "line",
          paint: {
            "line-width": 2,
            // Blue
            "line-color": "#007cbf",
          },
        });
      });

      animate(counterRef.current);
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
          onClick={handleReplay}
          id="replay"
        >
          Replay
        </button>
      </div>
    </div>
  );
};

export default MapboxExample;
