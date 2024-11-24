"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";

// Speeds in m/s
const MULTIPLIER = 50;
const DRONE_SPEED = 45 * MULTIPLIER;
const PLANE_SPEED = 280 * MULTIPLIER;

const MapboxJsIntegration = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const originRef = useRef(null);
  const planeRef = useRef(null);
  const planeRouteRef = useRef(null);
  const dronesRef = useRef([]);
  const droneRoutesRef = useRef([]);
  const stepsRef = useRef(0);
  const counterRef = useRef(0);
  // Belgorod
  const [startCoords, setStartCoords] = useState([36.5683, 50.5977]);
  // Kharkiv
  const [endCoords, setEndCoords] = useState([36.296784, 49.995023]);
  const [isStarted, setIsStarted] = useState(false);
  const circleAnimationRef = useRef(null);
  const [droneHits, setDroneHits] = useState(0);

  // Add power plant locations
  const powerPlants = [
    { name: "Border Point 1", coords: [36.15, 50.15] },
    { name: "Border Point 2", coords: [36.25, 50.1612] },
    { name: "Border Point 3", coords: [36.35, 50.1496] },
    { name: "Border Point 4", coords: [36.45, 50.1734] },
    { name: "Border Point 5", coords: [36.55, 50.1888] },
    { name: "Border Point 6", coords: [36.65, 50.151] },
  ];

  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

      // Update the radius position
      mapRef.current.getSource(`droneRadius${i}`).setData({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [x, y],
        },
      });
    });

    // Continue the animation if not started
    if (!isStarted) {
      circleAnimationRef.current = requestAnimationFrame(animateCircling);
    }
  }

  function handleReplay() {
    if (!mapRef.current || !mapRef.current.loaded()) {
      console.warn("Map not yet loaded");
      return;
    }

    setIsStarted(false);
    counterRef.current = 0;

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

    // Update plane position only if not at the end
    if (counterRef.current < stepsRef.current) {
      planeRef.current.features[0].geometry.coordinates =
        planeRouteRef.current.features[0].geometry.coordinates[
          counterRef.current
        ];
      planeRef.current.features[0].properties.bearing = turf.bearing(
        turf.point(start),
        turf.point(end)
      );
      mapRef.current.getSource("plane").setData(planeRef.current);
    }

    // Add distance calculation for plane
    if (counterRef.current < stepsRef.current) {
      const currentPlanePosition =
        planeRef.current.features[0].geometry.coordinates;
      const planeDestination = endCoords;
      const remainingDistance = turf
        .distance(
          turf.point(currentPlanePosition),
          turf.point(planeDestination),
          { units: "kilometers" }
        )
        .toFixed(1);

      planeRef.current.features[0].properties.distance = `${remainingDistance}km`;
      mapRef.current.getSource("plane").setData(planeRef.current);
    }

    // Handle drone trails (always continue)
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

        // Add distance calculation for each drone
        const droneDestination =
          droneRoutesRef.current[i].features[0].geometry.coordinates[
            droneRoutesRef.current[i].features[0].geometry.coordinates.length -
              1
          ];
        const remainingDistance = turf
          .distance(
            turf.point(drone.features[0].geometry.coordinates),
            turf.point(droneDestination),
            { units: "kilometers" }
          )
          .toFixed(1);

        drone.features[0].properties.distance = `${remainingDistance}km`;

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

        // Update the radius position
        mapRef.current.getSource(`droneRadius${i}`).setData({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: drone.features[0].geometry.coordinates,
          },
        });

        // Add collision detection
        const dronePosition = drone.features[0].geometry.coordinates;
        const planePosition = planeRef.current.features[0].geometry.coordinates;
        const distance = turf.distance(
          turf.point(dronePosition),
          turf.point(planePosition),
          { units: "kilometers" }
        );

        // Check if drone is within 0.1km of plane and hasn't already been counted
        if (distance < 0.1 && !drone.features[0].properties.hasHit) {
          drone.features[0].properties.hasHit = true;
          setDroneHits((prev) => prev + 1);
        }
      }
    });

    // Always continue the animation
    requestAnimationFrame(animate);
    counterRef.current = counterRef.current + 1;
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
    <div className="relative h-screen w-full">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {/* Logo and Team Name */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-2.5 p-2.5 bg-black/50 rounded">
        <img src="/logo.png" alt="Interruptor Logo" className="h-8 w-8" />
        <span className="text-white font-bold text-xl">Interruptor</span>
      </div>

      {/* Add hits counter */}
      <div className="absolute top-2.5 right-2.5 p-2.5 bg-black/50 rounded">
        <span className="text-white font-bold">
          Successful Intercepts: {droneHits}
        </span>
      </div>

      {/* Controls - moved down to accommodate logo */}
      <div className="absolute top-20 left-2.5 flex flex-col gap-2.5 p-2.5 bg-black/50 rounded">
        <div>
          <label className="block mb-1.5 text-white">Start coordinates:</label>
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
          <label className="block mb-1.5 text-white">End coordinates:</label>
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
            disabled={isStarted}
          >
            Start
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
  );
};

export default MapboxJsIntegration;
