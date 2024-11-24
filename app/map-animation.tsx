"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";

// Speeds in m/s
const MULTIPLIER = 5;
const DRONE_SPEED = 100 * MULTIPLIER;
const PLANE_SPEED = 280 * MULTIPLIER;

const MapboxExample = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const originRef = useRef<[number, number]>(null);
  const planeRef = useRef<GeoJSON.FeatureCollection>(null);
  const planeRouteRef = useRef<GeoJSON.FeatureCollection>(null);
  const dronesRef = useRef<GeoJSON.FeatureCollection[]>([]);
  const droneRoutesRef = useRef<GeoJSON.FeatureCollection[]>([]);
  const stepsRef = useRef(0);
  const counterRef = useRef(0);
  // Belgorod
  const [startCoords, setStartCoords] = useState([36.5683, 50.5977]);
  // Kharkiv
  const [endCoords, setEndCoords] = useState([36.296784, 49.995023]);
  const [isStarted, setIsStarted] = useState(false);
  const circleAnimationRef = useRef<number>();

  // Add power plant locations
  const powerPlants = [
    { name: "Border Point 1", coords: [36.15, 50.15] },
    { name: "Border Point 2", coords: [36.25, 50.1612] },
    { name: "Border Point 3", coords: [36.35, 50.1496] },
    { name: "Border Point 4", coords: [36.45, 50.1734] },
    { name: "Border Point 5", coords: [36.55, 50.1888] },
    { name: "Border Point 6", coords: [36.65, 50.151] },
  ];

  function handleStart() {
    setIsStarted(true);
    if (circleAnimationRef.current) {
      cancelAnimationFrame(circleAnimationRef.current);
    }

    // Show the complete plane route immediately
    mapRef.current.setLayoutProperty("planeRoute", "visibility", "visible");
    mapRef.current.getSource("planeRoute").setData(planeRouteRef.current);

    // Reset drone routes to empty initially
    powerPlants.forEach((_, i) => {
      mapRef.current.setLayoutProperty(
        `droneRoute${i}`,
        "visibility",
        "visible"
      );
      mapRef.current.getSource(`droneRoute${i}`).setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [],
            },
          },
        ],
      });
    });

    // Update the starting points of drone routes to their current positions
    dronesRef.current.forEach((drone, i) => {
      const currentPosition = drone.features[0].geometry.coordinates;
      const droneRoute = droneRoutesRef.current[i];
      const destination =
        droneRoute.features[0].geometry.coordinates[
          droneRoute.features[0].geometry.coordinates.length - 1
        ];

      // Create new route from current position
      const droneDistance =
        turf.distance(turf.point(currentPosition), turf.point(destination), {
          units: "kilometers",
        }) * 1000; // Convert to meters
      const droneTime = droneDistance / DRONE_SPEED;
      const droneSteps = Math.ceil(droneTime * 60); // 60 fps animation

      const arc = [];
      for (let j = 0; j <= droneSteps; j++) {
        const segment = turf.along(
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [currentPosition, destination],
            },
          },
          (droneDistance * j) / droneSteps,
          { units: "meters" }
        );
        arc.push(segment.geometry.coordinates);
      }

      // Pad the remaining points with the final coordinate
      while (arc.length <= stepsRef.current) {
        arc.push(destination);
      }

      droneRoute.features[0].geometry.coordinates = arc;
      mapRef.current.getSource(`droneRoute${i}`).setData(droneRoute);
    });

    // Start the main animation
    animate(0);
  }

  function animateCircling() {
    const speedFactor = 0.2; // Slower rotation speed (smaller number = slower)
    const time = Date.now() * 0.001 * speedFactor; // Apply speed factor to time
    const radius = 0.01; // Radius of the circle in degrees

    dronesRef.current.forEach((drone, i) => {
      const centerPoint = powerPlants[i].coords;
      // Calculate new position in a circle
      const x = centerPoint[0] + Math.cos(time) * radius;
      const y = centerPoint[1] + Math.sin(time) * radius;

      drone.features[0].geometry.coordinates = [x, y];
      // Update bearing to be tangent to the circle
      drone.features[0].properties.bearing =
        (Math.atan2(Math.cos(time), -Math.sin(time)) * 180) / Math.PI;

      mapRef.current.getSource(`drone${i}`).setData(drone);
    });

    // Continue the animation if not started
    if (!isStarted) {
      circleAnimationRef.current = requestAnimationFrame(animateCircling);
    }
  }

  function handleReplay() {
    setIsStarted(false);
    counterRef.current = 0;

    // Reset plane position and clear trail
    planeRef.current.features[0].geometry.coordinates = originRef.current;
    mapRef.current.getSource("planeRoute").setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      ],
    });
    mapRef.current.getSource("plane").setData(planeRef.current);

    // Reset drones position and clear trails
    dronesRef.current.forEach((drone, i) => {
      drone.features[0].geometry.coordinates = powerPlants[i].coords;
      mapRef.current.getSource(`droneRoute${i}`).setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [],
            },
          },
        ],
      });
      mapRef.current.getSource(`drone${i}`).setData(drone);
    });

    // Start circling animation instead of main animation
    animateCircling();
  }

  function animate() {
    const start =
      planeRouteRef.current.features[0].geometry.coordinates[
        counterRef.current >= stepsRef.current
          ? counterRef.current - 1
          : counterRef.current
      ];
    const end =
      planeRouteRef.current.features[0].geometry.coordinates[
        counterRef.current >= stepsRef.current
          ? counterRef.current
          : counterRef.current + 1
      ];

    // Update plane position (without modifying its route)
    planeRef.current.features[0].geometry.coordinates =
      planeRouteRef.current.features[0].geometry.coordinates[
        counterRef.current
      ];
    planeRef.current.features[0].properties.bearing = turf.bearing(
      turf.point(start),
      turf.point(end)
    );
    mapRef.current.getSource("plane").setData(planeRef.current);

    // Handle drone trails (keep the existing drone animation code)
    dronesRef.current.forEach((drone, i) => {
      const droneRoute = droneRoutesRef.current[i];
      const start =
        droneRoute.features[0].geometry.coordinates[
          counterRef.current >= stepsRef.current
            ? counterRef.current - 1
            : counterRef.current
        ];
      const end =
        droneRoute.features[0].geometry.coordinates[
          counterRef.current >= stepsRef.current
            ? counterRef.current
            : counterRef.current + 1
        ];

      if (start && end) {
        drone.features[0].geometry.coordinates =
          droneRoute.features[0].geometry.coordinates[counterRef.current];
        drone.features[0].properties.bearing = turf.bearing(
          turf.point(start),
          turf.point(end)
        );

        // Update drone trail
        const droneTrail = {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: droneRoute.features[0].geometry.coordinates.slice(
              0,
              counterRef.current + 1
            ),
          },
        };
        mapRef.current.getSource(`droneRoute${i}`).setData({
          type: "FeatureCollection",
          features: [droneTrail],
        });
        mapRef.current.getSource(`drone${i}`).setData(drone);
      }
    });

    if (counterRef.current < stepsRef.current) {
      requestAnimationFrame(animate);
    }

    counterRef.current = counterRef.current + 1;
  }

  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [36.4, 50.3],
      zoom: 8.5,
      pitch: 40,
    });

    const origin = startCoords;
    originRef.current = origin;
    const destination = endCoords;

    // Calculate total distance and time for plane route
    const planeDistance =
      turf.distance(turf.point(origin), turf.point(destination), {
        units: "kilometers",
      }) * 1000; // Convert to meters
    const planeTime = planeDistance / PLANE_SPEED; // Time in seconds
    stepsRef.current = Math.ceil(planeTime * 60); // 60 fps animation

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

    // Modify arc points calculation for plane
    const arc = [];
    for (let i = 0; i <= stepsRef.current; i++) {
      const segment = turf.along(
        planeRoute.features[0],
        (planeDistance * i) / stepsRef.current,
        { units: "meters" }
      );
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

      // Add plane route layer with initial visibility set to none
      mapRef.current.addLayer({
        id: "planeRoute",
        source: "planeRoute",
        type: "line",
        layout: {
          visibility: "none", // Hide initially
        },
        paint: {
          "line-width": 2,
          "line-color": "#ff0000",
        },
      });

      // Initialize multiple drones and their routes
      powerPlants.forEach((plant, i) => {
        // Calculate interception time based on distances and speeds
        const interceptPoint = Math.floor(
          (stepsRef.current * (i + 1)) / (powerPlants.length + 1)
        );
        const destination2 =
          planeRoute.features[0].geometry.coordinates[interceptPoint];

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

        // Calculate drone route with proper timing
        const droneDistance =
          turf.distance(turf.point(plant.coords), turf.point(destination2), {
            units: "kilometers",
          }) * 1000; // Convert to meters
        const droneTime = droneDistance / DRONE_SPEED;
        const droneSteps = Math.ceil(droneTime * 60); // 60 fps animation

        const arc = [];
        for (let j = 0; j <= droneSteps; j++) {
          const segment = turf.along(
            droneRoute.features[0],
            (droneDistance * j) / droneSteps,
            { units: "meters" }
          );
          arc.push(segment.geometry.coordinates);
        }

        // Pad the remaining points with the final coordinate
        while (arc.length <= stepsRef.current) {
          arc.push(destination2);
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

        // Update drone route layers with initial visibility set to none
        mapRef.current.addLayer({
          id: `droneRoute${i}`,
          source: `droneRoute${i}`,
          type: "line",
          layout: {
            visibility: "none", // Hide initially
          },
          paint: {
            "line-width": 2,
            "line-color": "#007cbf",
          },
        });
      });

      // Add this new code to show country borders
      mapRef.current.addLayer({
        id: "country-boundaries",
        source: {
          type: "vector",
          url: "mapbox://mapbox.country-boundaries-v1",
        },
        "source-layer": "country_boundaries",
        type: "line",
        paint: {
          "line-color": "#627BC1",
          "line-width": 1,
          "line-opacity": 0.7,
        },
      });

      // Start with circling animation instead of main animation
      animateCircling();
    });

    // Update cleanup
    return () => {
      if (circleAnimationRef.current) {
        cancelAnimationFrame(circleAnimationRef.current);
      }
      mapRef.current?.remove();
    };
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
            type="number"
            placeholder="longitude"
            value={startCoords[0]}
            onChange={(e) => {
              const lon = parseFloat(e.target.value);
              if (!isNaN(lon) && lon >= -180 && lon <= 180) {
                setStartCoords([lon, startCoords[1]]);
              }
            }}
            min="-180"
            max="180"
            step="0.0001"
            style={{ width: "80px", background: "black" }}
          />
          <input
            type="number"
            placeholder="latitude"
            value={startCoords[1]}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat) && lat >= -90 && lat <= 90) {
                setStartCoords([startCoords[0], lat]);
              }
            }}
            min="-90"
            max="90"
            step="0.0001"
            style={{ width: "80px", background: "black" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px" }}>
            End coordinates:
          </label>
          <input
            type="number"
            placeholder="longitude"
            value={endCoords[0]}
            onChange={(e) => {
              const lon = parseFloat(e.target.value);
              if (!isNaN(lon) && lon >= -180 && lon <= 180) {
                setEndCoords([lon, endCoords[1]]);
              }
            }}
            min="-180"
            max="180"
            step="0.0001"
            style={{ width: "80px", background: "black" }}
          />
          <input
            type="number"
            placeholder="latitude"
            value={endCoords[1]}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat) && lat >= -90 && lat <= 90) {
                setEndCoords([endCoords[0], lat]);
              }
            }}
            min="-90"
            max="90"
            step="0.0001"
            style={{ width: "80px", background: "black" }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={{
              backgroundColor: "#3386c0",
              color: "#fff",
              padding: "10px 20px",
              border: "none",
              cursor: "pointer",
              borderRadius: "3px",
            }}
            onClick={handleStart}
            disabled={isStarted}
          >
            Start
          </button>

          <button
            style={{
              backgroundColor: "#3386c0",
              color: "#fff",
              padding: "10px 20px",
              border: "none",
              cursor: "pointer",
              borderRadius: "3px",
            }}
            onClick={handleReplay}
          >
            Replay
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapboxExample;
