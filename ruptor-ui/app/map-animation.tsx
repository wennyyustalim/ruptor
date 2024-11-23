"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";

const MapboxExample = () => {
  const mapContainerRef = useRef();
  const mapRef = useRef();
  const pointRef = useRef(null);
  const originRef = useRef(null);
  const routeRef = useRef(null);
  const point2Ref = useRef(null);
  const route2Ref = useRef(null);
  const [disabled, setDisabled] = useState(true);
  const steps = 500;
  let counter = 0;

  function handleClick() {
    pointRef.current.features[0].geometry.coordinates = originRef.current;
    point2Ref.current.features[0].geometry.coordinates = originRef.current;
    mapRef.current.getSource("point").setData(pointRef.current);
    mapRef.current.getSource("point2").setData(point2Ref.current);
    animate(0);
    setDisabled(true);
  }

  function animate() {
    const start =
      routeRef.current.features[0].geometry.coordinates[
        counter >= steps ? counter - 1 : counter
      ];
    const end =
      routeRef.current.features[0].geometry.coordinates[
        counter >= steps ? counter : counter + 1
      ];

    const start2 =
      route2Ref.current.features[0].geometry.coordinates[
        counter >= steps ? counter - 1 : counter
      ];
    const end2 =
      route2Ref.current.features[0].geometry.coordinates[
        counter >= steps ? counter : counter + 1
      ];

    if (!start || !end || !start2 || !end2) {
      setDisabled(false);
      return;
    }

    pointRef.current.features[0].geometry.coordinates =
      routeRef.current.features[0].geometry.coordinates[counter];
    point2Ref.current.features[0].geometry.coordinates =
      route2Ref.current.features[0].geometry.coordinates[counter];

    pointRef.current.features[0].properties.bearing = turf.bearing(
      turf.point(start),
      turf.point(end)
    );
    point2Ref.current.features[0].properties.bearing = turf.bearing(
      turf.point(start2),
      turf.point(end2)
    );

    mapRef.current.getSource("point").setData(pointRef.current);
    mapRef.current.getSource("point2").setData(point2Ref.current);

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
      center: [30, 50],
      zoom: 4,
      pitch: 40,
    });

    const origin = [-122.414, 37.776];
    originRef.current = origin;

    const destination = [-77.032, 38.913];

    const route = {
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
    routeRef.current = route;

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

    const point2 = {
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
    point2Ref.current = point2;

    const lineDistance = turf.length(route.features[0]);
    const arc = [];

    for (let i = 0; i < lineDistance; i += lineDistance / steps) {
      const segment = turf.along(route.features[0], i);
      arc.push(segment.geometry.coordinates);
    }

    route.features[0].geometry.coordinates = arc;

    const origin2 = [30.5234, 50.4501];
    const destination2 = [37.6173, 55.7558];

    const route2 = {
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
    route2Ref.current = route2;

    const lineDistance2 = turf.length(route2.features[0]);
    const arc2 = [];

    for (let i = 0; i < lineDistance2; i += lineDistance2 / steps) {
      const segment = turf.along(route2.features[0], i);
      arc2.push(segment.geometry.coordinates);
    }

    route2.features[0].geometry.coordinates = arc2;

    mapRef.current.on("load", () => {
      mapRef.current.addSource("route", {
        type: "geojson",
        data: route,
      });

      mapRef.current.addSource("point", {
        type: "geojson",
        data: point,
      });

      mapRef.current.addSource("point2", {
        type: "geojson",
        data: point2,
      });

      mapRef.current.addSource("route2", {
        type: "geojson",
        data: route2,
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

      mapRef.current.addLayer({
        id: "point2",
        source: "point2",
        type: "symbol",
        layout: {
          "icon-image": "car",
          "icon-size": 1.2,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      mapRef.current.addLayer({
        id: "route2",
        source: "route2",
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
  }, []);

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
        }}
      >
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
