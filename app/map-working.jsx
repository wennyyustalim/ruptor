"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";

// Speeds in m/s
const MULTIPLIER = 50;
const DRONE_SPEED = 45 * MULTIPLIER;
const PLANE_SPEED = 280 * MULTIPLIER;

const MapboxJsWorking = () => {
  const num_drones = 4;
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const originRef = useRef(null);
  const planeRef = useRef(null);
  const planeRouteRef = useRef(null);
  const dronesRef = useRef([]);
  const droneRoutesRef = useRef([]);
  const stepsRef = useRef(0);
  const counterRef = useRef(0);
  const droneHistoriesRef = useRef(
    Array(num_drones)
      .fill()
      .map(() => [])
  );
  const planeStartedRef = useRef(false);
  const dronesLaunchedRef = useRef(false);
  const droneLaunchCounterRef = useRef(0);
  // Belgorod
  const [startCoords, setStartCoords] = useState([36.5683, 50.5977]);
  // Kharkiv
  const [endCoords, setEndCoords] = useState([36.296784, 49.995023]);
  const [isStarted, setIsStarted] = useState(false);
  const circleAnimationRef = useRef(null);
  const [droneHits, setDroneHits] = useState(0);
  const [planeStarted, setPlaneStarted] = useState(false);
  const [dronesLaunched, setDronesLaunched] = useState(false);
  // Add new refs for the API-controlled drone
  const apiDroneRef = useRef(null);
  const apiDroneRouteRef = useRef(null);
  const apiDroneHistoryRef = useRef([]);
  const [isApiDroneTracking, setIsApiDroneTracking] = useState(false);
  // Add new state for controlling the interval
  const [fetchInterval, setFetchInterval] = useState(null);

  // Replace the powerPlants array with this:
  const powerPlants = Array.from({ length: num_drones }, (_, i) => {
    const radius = 0.18; // approximately 20km in degrees (doubled from 0.09)
    // Calculate angle for 120 degrees (2π/3 radians)
    const angle = Math.PI / 6 + (((2 * Math.PI) / 3) * i) / (num_drones - 1);
    // Kharkiv coordinates: [36.296784, 49.995023]
    return {
      name: `Border Point ${i + 1}`,
      coords: [
        36.296784 + radius * Math.cos(angle),
        49.995023 + radius * Math.sin(angle),
      ],
    };
  });

  // Kharkiv coordinates: [36.296784, 49.995023]
  // Moving 15km north means increasing latitude by ~0.135 degrees (1 degree ≈ 111km)
  const GROUND_STATION_COORDS = [36.296784, 49.995023 + 0.135];

  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  function handleStart() {
    planeStartedRef.current = true;
    setPlaneStarted(true);
    setIsApiDroneTracking(true);

    // Show the plane route
    mapRef.current.setLayoutProperty("planeRoute", "visibility", "visible");
    mapRef.current.getSource("planeRoute").setData(planeRouteRef.current);

    // Reset plane to starting position
    planeRef.current.features[0].geometry.coordinates = originRef.current;
    mapRef.current.getSource("plane").setData(planeRef.current);

    // Reset counter
    counterRef.current = 0;
  }

  function handleLaunchDrones() {
    dronesLaunchedRef.current = true;
    setDronesLaunched(true);
    droneLaunchCounterRef.current = counterRef.current;

    // Calculate new intercept paths from current positions
    dronesRef.current.forEach((drone, i) => {
      const currentPosition = drone.features[0].geometry.coordinates;

      // Find current plane position
      const planePosition = planeRef.current.features[0].geometry.coordinates;

      // Calculate remaining plane route from current position
      const remainingPlaneRoute =
        planeRouteRef.current.features[0].geometry.coordinates.slice(
          counterRef.current
        );

      // Find closest point on remaining plane route to drone
      const closestPoint = turf.nearestPointOnLine(
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: remainingPlaneRoute,
          },
        },
        turf.point(currentPosition)
      );

      // Calculate drone route to intercept point
      const interceptPoint = closestPoint.geometry.coordinates;
      const droneDistance =
        turf.distance(turf.point(currentPosition), turf.point(interceptPoint), {
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
              coordinates: [currentPosition, interceptPoint],
            },
          },
          (droneDistance * j) / droneSteps,
          { units: "meters" }
        );
        arc.push(segment.geometry.coordinates);
      }

      // Update drone route
      droneRoutesRef.current[i].features[0].geometry.coordinates = arc;
      mapRef.current
        .getSource(`droneRoute${i}`)
        .setData(droneRoutesRef.current[i]);
      mapRef.current.setLayoutProperty(
        `droneRoute${i}`,
        "visibility",
        "visible"
      );
    });
  }

  function animateCombined() {
    // Animate plane
    if (planeStartedRef.current) {
      const coordinates =
        planeRouteRef.current.features[0].geometry.coordinates;

      if (counterRef.current < coordinates.length - 1) {
        const start = coordinates[counterRef.current];
        const end = coordinates[counterRef.current + 1];

        // Update plane position
        planeRef.current.features[0].geometry.coordinates = start;
        planeRef.current.features[0].properties.bearing = turf.bearing(
          turf.point(start),
          turf.point(end)
        );
        mapRef.current.getSource("plane").setData(planeRef.current);

        // Check if plane is within ground station radius
        const distance = turf.distance(
          turf.point(start),
          turf.point(GROUND_STATION_COORDS),
          { units: "kilometers" }
        );

        // If plane is within 20km of ground station and drones haven't launched yet
        if (distance <= 20 && !dronesLaunchedRef.current) {
          handleLaunchDrones();
        }
      }
    }

    // Animate drones
    if (!dronesLaunchedRef.current) {
      // Continue circling animation
      const speedFactor = 0.2;
      const time = Date.now() * 0.001 * speedFactor;
      const radius = 0.01;

      dronesRef.current.forEach((drone, i) => {
        const centerPoint = powerPlants[i].coords;
        const x = centerPoint[0] + Math.cos(time) * radius;
        const y = centerPoint[1] + Math.sin(time) * radius;

        // Update drone position
        drone.features[0].geometry.coordinates = [x, y];
        drone.features[0].properties.bearing =
          (Math.atan2(Math.cos(time), -Math.sin(time)) * 180) / Math.PI;
        mapRef.current.getSource(`drone${i}`).setData(drone);

        // Update history with longer trail (changed from 100 to 1000)
        droneHistoriesRef.current[i].push([x, y]);
        if (droneHistoriesRef.current[i].length > 1000) {
          droneHistoriesRef.current[i].shift();
        }

        // Update the drone route to show the history
        droneRoutesRef.current[i].features[0].geometry.coordinates =
          droneHistoriesRef.current[i];
        mapRef.current
          .getSource(`droneRoute${i}`)
          .setData(droneRoutesRef.current[i]);
        mapRef.current.setLayoutProperty(
          `droneRoute${i}`,
          "visibility",
          "visible"
        );

        // Update the radius circle
        mapRef.current.getSource(`droneRadius${i}`).setData({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [x, y],
          },
          properties: {
            radius: 20000,
          },
        });
      });
    } else {
      // Animate drones along intercept paths
      const droneStep = counterRef.current - droneLaunchCounterRef.current; // Calculate steps since launch

      dronesRef.current.forEach((drone, i) => {
        const droneRoute = droneRoutesRef.current[i];
        const coordinates = droneRoute.features[0].geometry.coordinates;

        if (droneStep < coordinates.length) {
          const position = coordinates[droneStep];
          const nextPosition =
            coordinates[Math.min(droneStep + 1, coordinates.length - 1)];

          drone.features[0].geometry.coordinates = position;
          drone.features[0].properties.bearing = turf.bearing(
            turf.point(position),
            turf.point(nextPosition)
          );

          mapRef.current.getSource(`drone${i}`).setData(drone);
          mapRef.current.getSource(`droneRadius${i}`).setData({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: position,
            },
          });
        }
      });
    }

    // Increment counter and continue animation
    if (planeStartedRef.current) {
      counterRef.current++;
    }
    requestAnimationFrame(animateCombined);
  }

  function handleReplay() {
    if (!mapRef.current || !mapRef.current.loaded()) {
      console.warn("Map not yet loaded");
      return;
    }

    planeStartedRef.current = false;
    dronesLaunchedRef.current = false;
    setPlaneStarted(false);
    setDronesLaunched(false);
    setIsApiDroneTracking(false);
    counterRef.current = 0;

    // Clear drone histories
    droneHistoriesRef.current = Array(num_drones)
      .fill()
      .map(() => []);

    // Reset plane position but keep the route visible
    planeRef.current.features[0].geometry.coordinates = originRef.current;
    mapRef.current.getSource("plane").setData(planeRef.current);

    // Reset drones position and clear trails
    dronesRef.current.forEach((drone, i) => {
      // Reset drones to their fixed positions instead of circling
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

      // Update the radius position to match the fixed position
      mapRef.current.getSource(`droneRadius${i}`).setData({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: powerPlants[i].coords,
        },
      });
    });

    setDroneHits(0);
    dronesRef.current.forEach((drone) => {
      drone.features[0].properties.hasHit = false;
    });

    // Reset API drone
    if (apiDroneRef.current) {
      apiDroneRef.current.features[0].geometry.coordinates = [36.4, 50.3]; // Initial position
      mapRef.current.getSource("apiDrone").setData(apiDroneRef.current);
      apiDroneHistoryRef.current = [];
      mapRef.current.getSource("apiDroneRoute").setData({
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
    }
  }

  useEffect(() => {
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
          // Add text field for distance
          "text-field": ["get", "distance"],
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 1,
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
        // Find closest point on plane route to this power plant
        const closestPoint = turf.nearestPointOnLine(
          planeRoute.features[0],
          turf.point(plant.coords)
        );

        // Get the coordinates of the closest point
        const destination2 = closestPoint.geometry.coordinates;

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

        // Add a new source for the drone's radius
        mapRef.current.addSource(`droneRadius${i}`, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates:
                dronesRef.current[i].features[0].geometry.coordinates,
            },
          },
        });

        // Add the glowing circle layer
        mapRef.current.addLayer({
          id: `droneRadius${i}`,
          source: `droneRadius${i}`,
          type: "circle",
          paint: {
            "circle-radius": {
              stops: [
                [0, 0],
                [8, 10], // Adjust these values to control the circle size at different zoom levels
                [12, 30],
                [15, 50],
              ],
            },
            "circle-color": "#008000",
            "circle-opacity": 0.5,
            "circle-blur": 0.5,
          },
        });
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
            // Add text field for distance
            "text-field": ["get", "distance"],
            "text-offset": [0, 1],
            "text-anchor": "top",
            "text-size": 12,
          },
          paint: {
            "icon-color": "#ffffff",
            "text-color": "#ffffff",
            "text-halo-color": "#000000",
            "text-halo-width": 1,
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

      // Add ground station source
      mapRef.current.addSource("groundStation", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: GROUND_STATION_COORDS,
          },
        },
      });

      // Add ground station layer
      mapRef.current.addLayer({
        id: "groundStation",
        source: "groundStation",
        type: "symbol",
        layout: {
          "icon-image": "castle", // or "triangle" or another appropriate icon
          "icon-size": 1.5,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "text-field": "Ground Station",
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 1,
        },
      });

      // Add ground station radius (15km ≈ 0.135 degrees)
      mapRef.current.addSource("groundStationRadius", {
        type: "geojson",
        data: turf.circle(GROUND_STATION_COORDS, 20, { units: "kilometers" }),
      });

      mapRef.current.addLayer({
        id: "groundStationRadius",
        source: "groundStationRadius",
        type: "fill",
        paint: {
          "fill-color": "#800080",
          "fill-opacity": 0.2,
        },
      });

      // Initialize API-controlled drone
      const apiDrone = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: [36.4, 50.3], // Initial position
            },
          },
        ],
      };
      apiDroneRef.current = apiDrone;

      // Create API drone route
      const apiDroneRoute = {
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
      };
      apiDroneRouteRef.current = apiDroneRoute;

      // Add API drone sources and layers
      mapRef.current.addSource("apiDrone", {
        type: "geojson",
        data: apiDrone,
      });

      mapRef.current.addSource("apiDroneRoute", {
        type: "geojson",
        data: apiDroneRoute,
      });

      mapRef.current.addLayer({
        id: "apiDrone",
        source: "apiDrone",
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
          "icon-color": "#ffff00", // Yellow to distinguish from other drones
        },
      });

      mapRef.current.addLayer({
        id: "apiDroneRoute",
        source: "apiDroneRoute",
        type: "line",
        paint: {
          "line-width": 2,
          "line-color": "#ffff00",
        },
      });

      // Start the combined animation immediately
      animateCombined();
    });

    // Update cleanup
    return () => {
      cancelAnimationFrame(counterRef.current);
      mapRef.current?.remove();
    };
  }, [startCoords, endCoords]);

  // Add new useEffect to handle API polling
  useEffect(() => {
    if (isApiDroneTracking) {
      // Start polling every second
      const interval = setInterval(() => {
        fetch("/api/position")
          .then((response) => response.json())
          .then((data) => {
            const newCoords = [data.longitude, data.latitude];

            if (apiDroneRef.current) {
              // Update drone position
              apiDroneRef.current.features[0].geometry.coordinates = newCoords;

              // Calculate bearing if we have previous coordinates
              if (apiDroneHistoryRef.current.length > 0) {
                const prevCoords =
                  apiDroneHistoryRef.current[
                    apiDroneHistoryRef.current.length - 1
                  ];
                apiDroneRef.current.features[0].properties.bearing =
                  turf.bearing(turf.point(prevCoords), turf.point(newCoords));
              }

              mapRef.current.getSource("apiDrone").setData(apiDroneRef.current);

              // Update history trail
              apiDroneHistoryRef.current.push(newCoords);
              if (apiDroneHistoryRef.current.length > 1000) {
                apiDroneHistoryRef.current.shift();
              }

              // Update the route to show history
              apiDroneRouteRef.current.features[0].geometry.coordinates =
                apiDroneHistoryRef.current;
              mapRef.current
                .getSource("apiDroneRoute")
                .setData(apiDroneRouteRef.current);
            }
          })
          .catch((error) =>
            console.error("Error fetching drone position:", error)
          );
      }, 1000); // Poll every 1000ms (1 second)

      setFetchInterval(interval);

      // Cleanup function
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else if (fetchInterval) {
      clearInterval(fetchInterval);
      setFetchInterval(null);
    }
  }, [isApiDroneTracking]);

  return (
    <div className="relative h-screen w-full">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {/* Logo and Team Name */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-2.5 p-2.5 bg-black/50 rounded">
        <div className="flex flex-col">
          <div className="flex flex-row space-x-2">
            <img src="/logo.png" alt="Interruptor Logo" className="h-8 w-8" />
            <span className="text-white font-bold text-xl">R U P T O R</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-xl">
              Successful Intercepts: {droneHits}
            </span>
          </div>
          <div>
            <label className="block mb-1.5 text-white">
              Bomb start coordinates:
            </label>
            <div className="flex gap-2">
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
                className="w-24 bg-black/70 text-white px-2 py-1 rounded"
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
                className="w-24 bg-black/70 text-white px-2 py-1 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-white">
              Bomb end coordinates:
            </label>
            <div className="flex gap-2">
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
                className="w-24 bg-black/70 text-white px-2 py-1 rounded"
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
                className="w-24 bg-black/70 text-white px-2 py-1 rounded"
              />
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
              onClick={handleStart}
              disabled={planeStarted}
            >
              Launch Plane
            </button>

            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
              onClick={handleReplay}
            >
              Replay
            </button>
          </div>
        </div>
      </div>

      {/* Update the iframe container styling */}
      <div className="absolute top-3 right-3 z-50 bg-black/50 p-2 rounded">
        <iframe
          width="360"
          height="240"
          src="https://www.youtube.com/embed/n5NMjbaHu8c?enablejsapi=1&loop=1&playlist=n5NMjbaHu8c&autoplay=1&mute=1&controls=0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="rounded"
        ></iframe>
      </div>
    </div>
  );
};

export default MapboxJsWorking;
