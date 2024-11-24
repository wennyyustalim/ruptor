import os.path
from datetime import datetime

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from matplotlib.animation import PillowWriter
from moviepy.video.io.VideoFileClip import VideoFileClip


def set_aspect_equal_3d(ax):
    """
    Set equal scaling for a 3D plot.
    This ensures that the sphere looks spherical and axes are equally scaled.
    """
    x_limits = ax.get_xlim3d()
    y_limits = ax.get_ylim3d()
    z_limits = ax.get_zlim3d()

    # Find the range for each axis
    x_range = abs(x_limits[1] - x_limits[0])
    y_range = abs(y_limits[1] - y_limits[0])
    z_range = abs(z_limits[1] - z_limits[0])

    # Find the maximum range
    max_range = max(x_range, y_range, z_range)

    # Set the midpoints for each axis
    x_mid = np.mean(x_limits)
    y_mid = np.mean(y_limits)
    z_mid = np.mean(z_limits)

    # Update limits to ensure equal scaling
    ax.set_xlim3d([x_mid - max_range / 2, x_mid + max_range / 2])
    ax.set_ylim3d([y_mid - max_range / 2, y_mid + max_range / 2])
    ax.set_zlim3d([z_mid - max_range / 2, z_mid + max_range / 2])


from matplotlib.ticker import FuncFormatter


def rescale_axes(ax, scale):
    """
    Rescale the axis ticks of a 3D plot by a given scale.

    Parameters:
    - ax: The 3D axis object to modify.
    - scale: The factor by which to divide the axis tick labels (default is 1e3).
    """
    # Formatter function to divide tick labels by the scale
    def scale_formatter(value, _):
        return f"{value / scale:.1f}"

    # Apply the formatter to each axis
    ax.xaxis.set_major_formatter(FuncFormatter(scale_formatter))
    ax.yaxis.set_major_formatter(FuncFormatter(scale_formatter))
    ax.zaxis.set_major_formatter(FuncFormatter(scale_formatter))

    # Update axis labels to indicate the scale
    ax.set_xlabel(f"X (\u00d7 10^{int(np.log10(scale))})")
    ax.set_ylabel(f"Y (\u00d7 10^{int(np.log10(scale))})")
    ax.set_zlabel(f"Z (\u00d7 10^{int(np.log10(scale))})")

def visualize_time_simulation(p1_list, v1, p2, q, v2, intercepts, max_time, output_file, time_steps=200):
    """
    Visualizes the evolution of time with multiple drones (p1_list) attempting to intercept a single bomb.
    """
    # Normalize the direction vector q
    q = q / np.linalg.norm(q)

    # Precompute bomb trajectory
    t_values = np.linspace(0, max_time, time_steps)  # High resolution for smooth trajectory
    p2_trajectory = [p2 + t * q * v2 for t in t_values]
    p2_trajectory = np.array(p2_trajectory)

    # Filter out None values from intercepts
    valid_intercepts = [i for i in intercepts if i is not None]

    # Calculate plot limits based on bounding box of all p1, p2, and valid intercepts
    all_coordinates = np.vstack([p1_list, [p2], valid_intercepts])
    x_min, y_min, z_min = all_coordinates.min(axis=0)
    x_max, y_max, z_max = all_coordinates.max(axis=0)

    # Add padding for better visualization
    padding = 0.2 * max(x_max - x_min, y_max - y_min, z_max - z_min)

    # Set up the figure
    fig = plt.figure(figsize=(10, 7))
    ax = fig.add_subplot(111, projection='3d')
    ax.set_xlim(x_min - padding, x_max + padding)
    ax.set_ylim(y_min - padding, y_max + padding)
    ax.set_zlim(z_min - padding, z_max + padding)
    rescale_axes(ax, scale=1e3)  # km

    # Ensure equal axis scaling
    set_aspect_equal_3d(ax)

    ax.set_title("bomb interception by airborne drones")
    ax.set_xlabel("X (km)")
    ax.set_ylabel("Y (km)")
    ax.set_zlabel("Z (km)")

    # Create markers and placeholders for each drone
    p1_markers = []
    radial_spheres = []
    intercept_markers = []
    intercept_status = np.array([False] * len(p1_list))  # Track if each drone has intercepted
    frozen_radii = [None] * len(p1_list)  # Store the frozen radii for each drone

    for idx, p1 in enumerate(p1_list):
        marker, = ax.plot([], [], [], 'ro', label=f"Drone {idx + 1}")
        p1_markers.append(marker)
        radial_spheres.append(None)  # Placeholder for each sphere
        intercept_markers.append(None)  # Placeholder for intercept markers

    # Plot for bomb
    p2_marker, = ax.plot([], [], [], 'bo', label="Bomb")

    # Simulation parameters
    dt = max_time / time_steps

    # Initialize the plot
    def init():
        nonlocal radial_spheres, intercept_markers
        for marker in p1_markers:
            marker.set_data([], [])
            marker.set_3d_properties([])
        p2_marker.set_data([], [])
        p2_marker.set_3d_properties([])

        # Create empty wireframes for each drone
        for i in range(len(p1_list)):
            x_placeholder = np.zeros((2, 2))
            y_placeholder = np.zeros((2, 2))
            z_placeholder = np.zeros((2, 2))
            radial_spheres[i] = ax.plot_wireframe(x_placeholder, y_placeholder, z_placeholder, color='r', alpha=0.3)
            intercept_markers[i], = ax.plot([], [], [], 'kx', markersize=10, label=f"Intercept {i}")

        return p1_markers + [p2_marker] + radial_spheres + intercept_markers


    def update(frame):
        nonlocal radial_spheres, intercept_status, frozen_radii
        current_time = frame * dt

        # Check if all drones with intercepts are done
        if frame == time_steps - 1:
            print("Final frame reached. Freezing visualization.")
            ani.event_source.stop()
            return

        # Clear only non-frozen wireframes
        for i in range(len(p1_list)):
            if not intercept_status[i]:
                try:
                    radial_spheres[i].remove()  # Remove active sphere
                except AttributeError:
                    pass  # Handle gracefully if sphere cannot be removed


        # Calculate radius of the expanding wave
        radius = v1 * current_time

        # Update radial waves and markers for each drone
        for i, p1 in enumerate(p1_list):

            if not (intercepts[i] is None):
                # Check if this drone has intercepted
                intercept_distance = np.linalg.norm(intercepts[i] - p1)
                if (radius >= intercept_distance) and not intercept_status[i]:
                    intercept_status[i] = True
                    frozen_radii[i] = radius  # Freeze the sphere at this radius
                    intercept_markers[i].set_data([intercepts[i][0]], [intercepts[i][1]])
                    intercept_markers[i].set_3d_properties([intercepts[i][2]])
                    # print(f"Drone {i} intercepted at {intercepts[i]}")

                    u = np.linspace(0, 2 * np.pi, 10)
                    v = np.linspace(0, np.pi, 10)
                    x = frozen_radii[i] * np.outer(np.cos(u), np.sin(v)) + p1[0]
                    y = frozen_radii[i] * np.outer(np.sin(u), np.sin(v)) + p1[1]
                    z = frozen_radii[i] * np.outer(np.ones(np.size(u)), np.cos(v)) + p1[2]
                    radial_spheres[i] = ax.plot_wireframe(x, y, z, color='g', alpha=0.3)
                    continue

            if (not intercept_status[i]) or (intercepts[i] is None):
                # Create sphere for this drone
                u = np.linspace(0, 2 * np.pi, 10)
                v = np.linspace(0, np.pi, 10)
                x = radius * np.outer(np.cos(u), np.sin(v)) + p1[0]
                y = radius * np.outer(np.sin(u), np.sin(v)) + p1[1]
                z = radius * np.outer(np.ones(np.size(u)), np.cos(v)) + p1[2]

                # Update radial wave
                radial_spheres[i] = ax.plot_wireframe(x, y, z, color='r', alpha=0.3)

                # Update drone marker
                p1_markers[i].set_data([p1[0]], [p1[1]])
                p1_markers[i].set_3d_properties([p1[2]])

        # Update bomb marker
        p2_current = p2 + v2 * current_time * q
        p2_marker.set_data([p2_current[0]], [p2_current[1]])
        p2_marker.set_3d_properties([p2_current[2]])

        time_idx = int(current_time/dt)
        bomb_trajectory = ax.plot(*[p2_trajectory[:time_idx,coord] for coord in range(3)], color='blue', alpha=0.1, linestyle="--")

        return p1_markers + [p2_marker] + radial_spheres + intercept_markers

    # Create animation
    ani = FuncAnimation(fig, update, frames=time_steps, init_func=init, blit=False, interval=50)

    if output_file is not None:
        # Save the animation as a video
        # writer = FFMpegWriter(fps=20, metadata={"artist": "Matplotlib"}, bitrate=1800)
        # ani.save(output_file, writer=writer)
        # Save the animation as a GIF
        gif_file = os.path.splitext(output_file)[0] + ".gif"
        writer = PillowWriter(fps=20)
        ani.save(gif_file, writer=writer)
        print(f"Animation saved to {gif_file}")

        # Convert the GIF to MP4 using moviepy
        clip = VideoFileClip(gif_file)
        clip.write_videofile(output_file, codec="libx264")
        print(f"Animation converted to MP4 and saved to {output_file}")
    else:

        plt.legend()
        plt.show()


if __name__ == "__main__":

    orbit_radius = 3e3
    orbit_height = 1e3
    orbit_density = 2*np.pi/20
    p1_list = [ ]
    for drone_pos in np.linspace(-2,2,5):
        p1_list.append(
            np.array([
                orbit_radius * np.cos(orbit_density * drone_pos),
                orbit_radius * np.sin(orbit_density * drone_pos),
                orbit_height
            ])
        )

    bomb_detect_radius = 10e3
    bomb_height = np.random.uniform(2e3, 10e3)
    bomb_pos = np.random.uniform(-1, 1)

    p2 = np.array([
        bomb_detect_radius * np.cos(orbit_density * bomb_pos),
        bomb_detect_radius * np.sin(orbit_density * bomb_pos),
        bomb_height
    ])

    # bomb is targeting the origin
    target_location = np.array([
        np.random.uniform(-2e3,2e3),
        np.random.uniform(-2e3,2e3),
        0])
    q = target_location-p2
    q = q/np.linalg.norm(q)

    v1 = 44  # ~100mph, drone speed (m/s)
    v2 = 313  # ~700mph, bomb speed (m/s)

    # Find intercepts for all drones
    from intercept import find_interception
    intercepts = []
    max_time = 0
    for p1 in p1_list:
        try:
            intercept_coord, intercept_time = find_interception(p1, v1, p2, q, v2)
            intercepts.append(intercept_coord)
            max_time = max(max_time, intercept_time)
        except Exception as errmsg:
            print("No intercept for this drone:", errmsg)
            intercepts.append(None)

    for drone_idx, intercept_coord in enumerate(intercepts):
        if intercept_coord is not None:
            dist_to_target = np.linalg.norm(intercept_coord - target_location)
            print(f"drone-{drone_idx+1} intercepted bomb at {dist_to_target*1e-3:.1f} km from target")

    # Add a timestamp to the output filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")  # e.g., "20231123_1345"
    output_file = f"animation_{timestamp}.mp4"

    visualize_time_simulation(p1_list, v1, p2, q, v2, intercepts, max_time*1.5, output_file)



