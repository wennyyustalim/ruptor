import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation


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


def visualize_time_simulation(p1, v1, p2, q, v2, intercept, max_time, time_steps=50):

    # Normalize the direction vector q
    q = q / np.linalg.norm(q)

    # Precompute bomb trajectory
    t_values = np.linspace(0, max_time, time_steps)  # High resolution for smooth trajectory
    p2_trajectory = [p2 + t * q * v2 for t in t_values]
    p2_trajectory = np.array(p2_trajectory)

    # Calculate plot limits based on bounding box of p1, p2, and intercept
    key_coordinates = np.array([p1, p2, intercept])
    x_min, y_min, z_min = key_coordinates.min(axis=0)
    x_max, y_max, z_max = key_coordinates.max(axis=0)

    # Add padding for better visualization
    padding = 0.2 * max(x_max - x_min, y_max - y_min, z_max - z_min)

    # Set up the figure
    fig = plt.figure(figsize=(10, 7))
    ax = fig.add_subplot(111, projection='3d')
    ax.set_xlim(x_min - padding, x_max + padding)
    ax.set_ylim(y_min - padding, y_max + padding)
    ax.set_zlim(z_min - padding, z_max + padding)
    rescale_axes(ax, scale=1e3)  # km
    # rescale_axes(ax, scale=1.60934e3) # miles

    # Ensure equal axis scaling
    set_aspect_equal_3d(ax)

    ax.set_title("Time Evolution: Radial Expansion and Linear Movement")
    ax.set_xlabel("X (km)")
    ax.set_ylabel("Y (km)")
    ax.set_zlabel("Z (km)")

    # Continue with the rest of your visualization code...

    # Plot initial points
    p1_marker, = ax.plot([], [], [], 'ro', label="Drone origin")
    p2_marker, = ax.plot([], [], [], 'bo', label="Bomb location")

    # Placeholder for expanding radial wave
    radial_sphere = None

    # Simulation parameters
    dt = max_time / time_steps  # Time step size

    # Initialize the plot
    def init():
        nonlocal radial_sphere
        p1_marker.set_data([], [])
        p1_marker.set_3d_properties([])
        p2_marker.set_data([], [])
        p2_marker.set_3d_properties([])
        # Create an empty wireframe with placeholder values
        x_placeholder = np.zeros((2, 2))
        y_placeholder = np.zeros((2, 2))
        z_placeholder = np.zeros((2, 2))
        radial_sphere = ax.plot_wireframe(x_placeholder, y_placeholder, z_placeholder, color='r', alpha=0.3,
                                          label="Radius of possible drone locations")
        return p1_marker, p2_marker, radial_sphere

    # Update function for animation
    def update(frame):
        nonlocal radial_sphere
        current_time = frame * dt

        # Calculate radius of the expanding wave
        radius = v1 * current_time

        # Calculate distance to intercept
        intercept_distance = np.linalg.norm(intercept - p1)

        # Stop animation if the radius exceeds or equals the intercept distance
        if radius >= intercept_distance:
            ani.event_source.stop()
            print(f"Animation stopped at frame {frame}, radius = {radius}, intercept distance = {intercept_distance}")

        # Update radial wave
        u = np.linspace(0, 2 * np.pi, 10)
        v = np.linspace(0, np.pi, 10)
        x = radius * np.outer(np.cos(u), np.sin(v)) + p1[0]
        y = radius * np.outer(np.sin(u), np.sin(v)) + p1[1]
        z = radius * np.outer(np.ones(np.size(u)), np.cos(v)) + p1[2]

        # Clear previous collections
        for collection in ax.collections:
            collection.remove()

        # Add new radial sphere of where the drone could be at time t
        radial_sphere = ax.plot_wireframe(x, y, z, color='r', alpha=0.3)

        time_idx = int(current_time/dt)
        bomb_trajectory = ax.plot(*[p2_trajectory[:time_idx,coord] for coord in range(3)], color='blue', alpha=0.3, linestyle="--")

        # Update drone marker location
        p1_marker.set_data([p1[0]], [p1[1]])
        p1_marker.set_3d_properties([p1[2]])

        # Update bomb marker location
        p2_current = p2 + v2 * current_time * q
        p2_marker.set_data([p2_current[0]], [p2_current[1]])
        p2_marker.set_3d_properties([p2_current[2]])

        return p1_marker, p2_marker, radial_sphere

    # Create animation
    ani = FuncAnimation(fig, update, frames=time_steps, init_func=init, blit=False, interval=50)

    # Show the plot
    plt.legend()
    plt.show()


if __name__ == "__main__":
    # Parameters for the simulation

    # Example Usage
    p1 = (0, 0, 5e3)  # drone coordinate at t=0 (m)
    v1 = 44  # ~100mph, drone speed (m/s)
    p2 = (20e3, 0, 5e3)  # bomb coordinate at t=0 (m)
    q = (-1, 0, -0.1)  # bomb direction (will be renormalized by function)
    v2 = 313  # ~700mph, bomb speed (m/s)

    # Find intercept location
    from intercept import find_interception
    intercept, intercept_time = find_interception(p1, v1, p2, q, v2)

    # Visualize the simulation
    visualize_time_simulation(p1, v1, p2, q, v2, intercept, max_time=intercept_time*1.5)