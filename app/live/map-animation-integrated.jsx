"use client";
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";

const MapboxJsIntegration = () => {
  const mapContainerRef = useRef();
  const mapRef = useRef();
  const pointRef = useRef(null);
  const originRef = useRef(null);
  const routeRef = useRef(null);
  const [disabled, setDisabled] = useState(true);
  const [coordinates, setCoordinates] = useState([]);
  const [isTracking, setIsTracking] = useState(false);

  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  function handleClick() {
    pointRef.current.features[0].geometry.coordinates = originRef.current;
    mapRef.current.getSource("point").setData(pointRef.current);
    setDisabled(true);
  }

  function handleStartTracking() {
    setIsTracking(true);
  }

  function handleStopTracking() {
    setIsTracking(false);
  }

  async function handleIntercept() {
    try {
      const response = await fetch("/api/waypoint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: 51.5,
          longitude: 36.5,
          altitude: 100,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Waypoint set:", data);
    } catch (error) {
      console.error("Error setting waypoint:", error);
    }
  }

  useEffect(() => {
    const fetchCoordinates = async () => {
      try {
        const response = await fetch("/api/position", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();
        console.log("Received coordinates:", data);
        const newCoords = [data.longitude, data.latitude];
        setCoordinates((prev) => [...prev, newCoords]);

        if (mapRef.current && mapRef.current.loaded()) {
          console.log("Updating point position to:", newCoords);
          console.log(
            "Point source exists:",
            mapRef.current.getSource("point") !== undefined
          );

          pointRef.current.features[0].geometry.coordinates = newCoords;
          if (coordinates.length > 0) {
            const prevCoords = coordinates[coordinates.length - 1];
            pointRef.current.features[0].properties.bearing = turf.bearing(
              turf.point(prevCoords),
              turf.point(newCoords)
            );
          }

          mapRef.current.getSource("point").setData(pointRef.current);

          mapRef.current.easeTo({
            center: newCoords,
            duration: 1000,
          });
        } else {
          console.log("Map or source not ready");
        }
      } catch (error) {
        console.error("Error fetching coordinates:", error);
      }
    };

    let intervalId;
    if (isTracking) {
      fetchCoordinates();
      intervalId = setInterval(fetchCoordinates, 50);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTracking]);

  useEffect(() => {
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [36.15, 50.15],
      zoom: 3,
      pitch: 40,
    });

    const origin = [36.15, 50.15];
    originRef.current = origin;

    const point = {
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
    pointRef.current = point;

    mapRef.current.on("load", () => {
      mapRef.current.addSource("route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [origin, origin],
              },
            },
          ],
        },
      });

      mapRef.current.addSource("point", {
        type: "geojson",
        data: point,
      });

      mapRef.current.addLayer({
        id: "route",
        source: "route",
        type: "line",
        paint: {
          "line-width": 2,
          "line-color": "#007cbf",
        },
      });

      mapRef.current.addLayer({
        id: "point",
        source: "point",
        type: "symbol",
        layout: {
          "icon-image": "airport",
          "icon-size": 1.5,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
    });

    return () => mapRef.current.remove();
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.loaded() || coordinates.length < 2)
      return;

    const route = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: coordinates,
          },
        },
      ],
    };
    routeRef.current = route;
    mapRef.current.getSource("route").setData(route);
  }, [coordinates]);

  return (
    <div className="relative h-screen w-full">
      <div ref={mapContainerRef} className="h-full w-full" />
      <div className="absolute top-3 left-3 flex gap-2">
        <button
          disabled={disabled}
          className={`rounded px-5 py-2.5 ${
            disabled
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-blue-500 text-white cursor-pointer hover:bg-blue-600"
          }`}
          onClick={handleClick}
          id="replay"
        >
          Replay
        </button>
        <button
          className={`rounded px-5 py-2.5 ${
            isTracking
              ? "bg-red-500 text-white cursor-pointer hover:bg-red-600"
              : "bg-green-500 text-white cursor-pointer hover:bg-green-600"
          }`}
          onClick={isTracking ? handleStopTracking : handleStartTracking}
        >
          {isTracking ? "Stop Tracking" : "Start Tracking"}
        </button>
        <button
          className={`rounded px-5 py-2.5 ${
            isTracking
              ? "bg-red-500 text-white cursor-pointer hover:bg-red-600"
              : "bg-green-500 text-white cursor-pointer hover:bg-green-600"
          }`}
          onClick={handleIntercept}
        >
          Intercept
        </button>
      </div>
      <div className="absolute top-3 right-3 z-10">
        <iframe
          width="360"
          height="240"
          src="https://www.youtube.com/embed/n5NMjbaHu8c?enablejsapi=1&loop=1&playlist=n5NMjbaHu8c&autoplay=1&mute=1&controls=0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
};

export default MapboxJsIntegration;
