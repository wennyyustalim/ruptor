from fastapi import FastAPI
from pydantic import BaseModel
import random
import time
import math

app = FastAPI()

# Kharkiv approximate center coordinates
KHARKIV_LAT = 49.9935
KHARKIV_LNG = 36.2304
BASE_ALTITUDE = 100  # meters


class DronePosition(BaseModel):
    latitude: float
    longitude: float
    altitude: float


@app.get("/position", response_model=DronePosition)
async def get_drone_position():
    # Use timestamp to create pseudo-random movement
    timestamp = time.time()

    # Create a circular pattern with some randomness
    radius = 0.01  # Roughly 1km radius
    angle = math.radians(timestamp % 360)

    # Add some noise to make movement less predictable
    random.seed(timestamp)
    noise_lat = random.uniform(-0.001, 0.001)
    noise_lng = random.uniform(-0.001, 0.001)

    latitude = KHARKIV_LAT + (radius * math.cos(angle)) + noise_lat
    longitude = KHARKIV_LNG + (radius * math.sin(angle)) + noise_lng

    # Altitude varies between 80 and 120 meters
    altitude = BASE_ALTITUDE + math.sin(timestamp) * 20

    return DronePosition(
        latitude=round(latitude, 6),
        longitude=round(longitude, 6),
        altitude=round(altitude, 2),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
