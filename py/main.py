import mediapipe as mp
import cv2
import numpy as np

def get_hand_rotation_vector(hand_landmarks, image_width, image_height):
    """
    Calculates the 3D rotation vector (rvec) of the hand using OpenCV solvePnP.
    """
    object_points = np.array([
        [ 0.0,  0.0,  0.0],  # 0: Wrist
        [-4.0, -5.0,  2.0],  # 5: Index finger base (MCP)
        [ 4.0, -5.0,  2.0]   # 17: Pinky finger base (MCP)
    ], dtype=np.float64)

    image_points = np.array([
        [hand_landmarks[0].x * image_width, hand_landmarks[0].y * image_height],   # Wrist
        [hand_landmarks[5].x * image_width, hand_landmarks[5].y * image_height],   # Index MCP
        [hand_landmarks[17].x * image_width, hand_landmarks[17].y * image_height]  # Pinky MCP
    ], dtype=np.float64)

    focal_length = image_width
    center = (image_width / 2, image_height / 2)
    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1]
    ], dtype=np.float64)

    dist_coeffs = np.zeros((4, 1))

    success, rvec, tvec = cv2.solvePnP(
        object_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
    )

    if success:
        return rvec, tvec
    return None, None

# Setup MediaPipe Tasks options
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path='./hand_landmarker.task',
        delegate=BaseOptions.Delegate.CPU  # Bypasses Metal GPU crash on Mac
    ),
    running_mode=VisionRunningMode.IMAGE
)

# Open Webcam
cap = cv2.VideoCapture(0)

print("Starting hand tracking. Press 'q' to exit.")

with HandLandmarker.create_from_options(options) as landmarker:
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            print("Ignoring empty camera frame.")
            continue

        height, width, _ = frame.shape

        # 1. Convert OpenCV BGR frame to MediaPipe Image format
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        # 2. Detect hands using the Tasks API
        results = landmarker.detect(mp_image)

        # 3. Extract XYZ coordinates if hands are detected
        if results.hand_landmarks:
            for hand_landmarks in results.hand_landmarks:

                # Example: Get Wrist (Index 0) XYZ values
                wrist = hand_landmarks[0]
                print(f"Wrist XYZ -> x: {wrist.x:.3f}, y: {wrist.y:.3f}, z: {wrist.z:.3f}")

                # 4. Pass landmarks into your rotation vector function
                rvec, tvec = get_hand_rotation_vector(hand_landmarks, width, height)
                if rvec is not None:
                    # Print flattened rotation vector
                    print("Rotation Vector (rvec):", rvec.ravel())

        # Display the live camera feed
        cv2.imshow('Hand Tracking XYZ & Rotation', frame)

        if cv2.waitKey(5) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()
