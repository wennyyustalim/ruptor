import numpy as np
from scipy.optimize import differential_evolution

from intercept import find_interception

drone_azimuthal_spacing = 2 * np.pi / 10
detection_range = 10e3 # (m)
v1 = 44  # ~100mph, drone speed (m/s)
v2 = 313  # ~700mph, bomb speed (m/s)


def calculate_worst_intercept(orbit_radius, height):

    ## drones are equidistant, so we can consider a single drone and a distribution of incoming bombs
    p1 = np.array([orbit_radius, 0, height])

    ## initialize to find the worst intercept over all incoming bombs
    min_intercept_dist = np.nan

    for bomb_height_start in np.linspace(2e3,10e3,10):
        for bomb_azimuthal_start in np.linspace(0, drone_azimuthal_spacing/2, 10):
            p2 = np.array([
                detection_range * np.cos(bomb_azimuthal_start),
                detection_range * np.sin(bomb_azimuthal_start),
                bomb_height_start
            ])

            ## try deviations of objects
            q = -p2/np.linalg.norm(p2)

            try:
                intercept_coord, intercept_time = find_interception(p1, v1, p2, q, v2)
                intercept_dist = np.linalg.norm(intercept_coord)
                if intercept_coord[-1] <= 0:
                    # failed to intercept before impact - penalize by magnitude of failure
                    intercept_dist = -intercept_dist
                min_intercept_dist = np.nanmin([intercept_dist, min_intercept_dist])
            except ValueError as errmsg:
                # print("[Warning][calculate_worst_intercept] failed to intercept")
                # print(errmsg)
                return -np.inf

    return min_intercept_dist


# Optimization setup
def find_optimal_orbit_radius():
    """
    Finds the optimal orbit_radius to maximize the worst intercept distance.
    """

    # Use bounded minimization with negated version of calculate_worst_intercept
    # Run Differential Evolution
    result = differential_evolution(
        lambda x: -calculate_worst_intercept(x[0], x[1]),  # Negate to maximize
        bounds = [(0, detection_range), (0, 5e3)],
        strategy='best1bin',       # DE strategy
        maxiter=100,              # Maximum number of iterations
        tol=1e-6,                  # Convergence tolerance
        polish=True                # Refine the result using a local optimizer
    )


    if result.success:
        optimal_radius = result.x[0]
        optimal_height = result.x[1]
        worst_intercept_distance = -result.fun  # Negate again to get the original positive value
        return optimal_radius, optimal_height, worst_intercept_distance
    else:
        raise ValueError("[Error][find_optimal_orbit_radius] Optimization failed: \n" + str(result))


if __name__ ==  "__main__":
    optimal_radius, optimal_height, worst_intercept_distance = find_optimal_orbit_radius()
    print(f"Optimal orbit radius: {optimal_radius:.2f} m")
    print(f"Optimal orbit height: {optimal_height:.2f} m")
    print(f"Maximum worst intercept distance: {worst_intercept_distance:.2f} m")