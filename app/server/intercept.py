import numpy as np
from scipy.optimize import minimize_scalar


def find_interception(p1 : np.array, v1, p2 : np.array, q  : np.array, v2):

    """
    Method to find the interception coordinate of a drone and a bomb based on minimizing the time error between where
    the drone could be at time t and the expected location of the bomb at time t.


    Parameters:
    - p1: (x1, y1, z1) - Coordinates of drone at t=0
    - v1: Speed of drone
    - p2: (x2, y2, z2) - Coordinates of bomb at t=0
    - q: (qx, qy, qz) - Direction of bomb
    - v2: Speed of bomb

    Returns:
    - interception_point: (x, y, z) - Coordinates of the interception point
    """

    # Normalize direction vector q
    q_norm = q / np.linalg.norm(q)


    def interception_time_error(t):

        # location of the bomb at time t
        p2_t = p2 + t * q_norm * v2

        # Distance between bomb at time t and starting location (t=0) of drone
        distance_from_p1 = np.linalg.norm(p2_t - p1)

        # time it would take the drone reach the location of bomb at time t
        t1 = distance_from_p1 / v1

        return np.abs(t1 - t)

    # Use a numerical solver to find the time t where interception_time_error(t) == 0
    try:
        solution = minimize_scalar(
            interception_time_error,
            bounds=(0, 1e3),
            method='bounded',
        )
    except Exception as errmsg:
        raise Exception("[Error][find_interception] uncontrolled error:", errmsg)

    if not solution.success:
        raise ValueError("[Warning][find_interception] interception error")

    # get the time at which the interception occurs
    t_intercept = solution.x

    # confirm that it's close enough to be an intercept
    if abs(solution.fun * v1) > 1:
        raise ValueError("[Warning][find_interception] interception failed")

    # Calculate the interception point based on the bomb trajectory at time t
    interception_point = p2 + t_intercept * q_norm * v2

    return interception_point, t_intercept



if __name__ == "__main__":

    # Example Usage
    p1 = (0, 0, 0)  # drone coordinate at t=0 (m)
    v1 = 44  # ~100mph, drone speed (m/s)
    p2 = (20e3, 0, 0)  # bomb coordinate at t=0 (m)
    q = (-1, 0, 0)  # bomb direction (will be renormalized by function)
    v2 = 313  # ~700mph, bomb speed (m/s)

    intercept, t_intercept = find_interception(p1, v1, p2, q, v2)
    print("[Info] interception point:", intercept)
    print("[Info] interception time:", t_intercept)
